-- 복지관 신청기간 알림 서비스 스키마
-- Supabase SQL Editor에서 그대로 실행한다.
-- 모든 테이블 RLS 활성화 + 정책 없음 = 브라우저(anon) 접근 전부 차단, 서버의 service role만 접근.

create extension if not exists "pgcrypto";

-- 계정
-- 전화번호는 평문으로 저장하지 않는다.
--   phone_hash: HMAC-SHA256(숫자만 번호, PHONE_HASH_KEY) hex → 검색·중복 방지용
--   phone_enc : AES-256-GCM 암호문(base64: iv + tag + ciphertext) → 발송할 때만 복호화
--   phone_last4: 화면 마스킹 표시용 뒤 4자리
create table users (
  id uuid primary key default gen_random_uuid(),
  phone_hash text unique not null,
  phone_enc text not null,
  phone_last4 text not null,
  key_version int not null default 1,
  name text,
  created_at timestamptz default now(),
  last_login_at timestamptz
);

-- 복지관 (user_roles가 참조하므로 먼저 만든다)
create table centers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- 'jungnang'
  name text not null,
  sido text,                                  -- '서울특별시' (지역 필터용)
  sigungu text,                               -- '중랑구'
  phone text,
  homepage text,
  notice_url text,                            -- 공지사항 게시판 목록 URL
  is_active boolean not null default true,    -- 끄면 크롤링·발송 대상에서 제외
  last_checked_at timestamptz,                -- 크롤링 배치 순서용
  last_check_error text,
  created_at timestamptz default now()
);
create index on centers (is_active, last_checked_at nulls first);
create index on centers (sido, sigungu);

-- 역할 (관리자 여러 명, 복지관별 담당자 대비)
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('super_admin','admin','center_manager')),
  center_id uuid references centers(id) on delete cascade,   -- center_manager만 사용
  granted_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  check ((role = 'center_manager') = (center_id is not null))
);
create unique index user_roles_unique
  on user_roles (user_id, role, coalesce(center_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index on user_roles (user_id);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,                   -- 번호 원문은 저장하지 않음 (발송은 요청 받은 번호로 즉시)
  purpose text not null check (purpose in ('login','senior_verify','guardian_invite')),
  code_hash text not null,                    -- sha256(phone + code + OTP_PEPPER)
  expires_at timestamptz not null,            -- 5분
  attempts int not null default 0,            -- 5회 넘으면 무효
  used_at timestamptz,
  created_at timestamptz default now()
);
create index on otp_codes (phone_hash, created_at desc);

-- 어르신
create table seniors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_hash text not null,
  phone_enc text not null,
  phone_last4 text not null,
  key_version int not null default 1,
  self_user_id uuid references users(id) on delete set null,  -- 어르신 본인 계정이 있으면
  senior_channel text not null default 'voice' check (senior_channel in ('sms','voice','both')),
  verified_at timestamptz,                    -- 어르신 번호 확인 완료
  agreed_at timestamptz not null,             -- 개인정보 동의
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);
create index on seniors (phone_hash);

-- 어르신 ↔ 보호자 (1:N)
create table senior_guardians (
  senior_id uuid not null references seniors(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  relation text not null default 'owner' check (relation in ('owner','member')),
  channel text not null default 'sms' check (channel in ('sms','voice','both','none')),
  verified_at timestamptz,                    -- 보호자 번호 확인 완료 (owner는 로그인으로 확인됨 → 생성 시각)
  added_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (senior_id, user_id)
);
create index on senior_guardians (user_id);

create table notices (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id) on delete cascade,
  url text not null,
  title text,
  posted_at date,
  source text check (source in ('text','image','mixed','pdf')),  -- AI가 무엇을 읽고 추출했는지
  fetched_at timestamptz default now(),
  unique (center_id, url)
);

create table periods (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id) on delete cascade,
  notice_id uuid references notices(id) on delete set null,
  label text not null,                        -- '2026년 하반기'
  apply_start date not null,
  apply_end date,
  method text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confidence real,
  confirmed_by uuid references users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  unique (center_id, apply_start, label)
);
create index on periods (status, apply_start);

create table subscriptions (
  senior_id uuid references seniors(id) on delete cascade,
  center_id uuid references centers(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (senior_id, center_id)
);
create index on subscriptions (center_id);

-- 발송 기록 (수신자가 어르신이든 보호자 누구든 recipient_key 하나로 구분)
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid references seniors(id) on delete cascade,
  period_id uuid references periods(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('senior','guardian','admin')),
  recipient_key text not null,                -- 'senior:<id>' | 'user:<id>'
  channel text not null check (channel in ('sms','voice')),
  kind text not null check (kind in ('d-3','d-day','manual','admin-alert','test')),
  provider text not null default 'solapi',
  status text not null default 'queued' check (status in ('queued','sent','failed','demo','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);
-- 자동 발송은 같은 사람·같은 기간·같은 방법·같은 종류로 한 번만
create unique index notification_once
  on notification_logs (period_id, recipient_key, channel, kind)
  where kind in ('d-3','d-day','admin-alert');
create index on notification_logs (period_id, created_at desc);

-- 관리 행동 기록
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,                       -- 'admin.grant', 'center.delete', 'period.confirm' ...
  target_type text,
  target_id text,
  detail jsonb,                               -- 전화번호는 마스킹해서
  created_at timestamptz default now()
);
create index on audit_logs (created_at desc);

-- 자동 작업 실행 기록
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                          -- 'daily'
  triggered_by text not null,                 -- 'cron' | 'user:<id>'
  started_at timestamptz default now(),
  finished_at timestamptz,
  summary jsonb,                              -- 확인한 복지관 수, 새 공지 수, 발송 성공/실패 수, 남은 작업 여부
  error text
);

alter table users enable row level security;
alter table user_roles enable row level security;
alter table otp_codes enable row level security;
alter table seniors enable row level security;
alter table senior_guardians enable row level security;
alter table centers enable row level security;
alter table notices enable row level security;
alter table periods enable row level security;
alter table subscriptions enable row level security;
alter table notification_logs enable row level security;
alter table audit_logs enable row level security;
alter table job_runs enable row level security;

-- 서버(service_role)에만 테이블 권한을 준다. anon·authenticated(브라우저)에는 주지 않는다.
-- (최근 Supabase 프로젝트는 SQL로 만든 테이블에 API 역할 권한을 자동으로 주지 않음)
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
