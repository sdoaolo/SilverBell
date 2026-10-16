-- 시연용 복지관과 확정된 신청 기간
--
-- ▶ 시연일이 바뀌면 아래 demo_day 한 줄의 날짜만 고친 뒤 다시 실행하세요.
--   - 시연복지관 가: 시연일에 신청 시작 (시작일 자동 발송 시연)
--   - 시연복지관 나: 시연일 3일 뒤 신청 시작 (D-3 자동 발송 시연)
--   - 시연복지관 다: 이미 신청이 끝남 (발송되지 않아야 함)
--   - 시연복지관 라: 기간 없음 ("지금 확인" 크롤링 시연용)
--
-- ▶ 이름·지역·전화·홈페이지·공지 URL의 'TODO'는 사람이 실제 값으로 채웁니다.
--   (값이 TODO인 항목은 문자에서 자동으로 빠집니다)
--
-- 여러 번 실행해도 됩니다. 복지관은 slug 기준으로 갱신되고,
-- 이 파일이 넣은 기간(notice_id 없음 + 아래 라벨)만 지우고 다시 넣습니다.

do $$
declare
  demo_day date := date '2026-10-16';   -- ◀ 시연일
  c_ga uuid; c_na uuid; c_da uuid;
begin
  insert into centers (slug, name, sido, sigungu, phone, homepage, notice_url, is_active)
  values
    ('demo-ga', '시연복지관 가', '서울특별시', 'TODO', 'TODO', 'TODO', 'TODO', true),
    ('demo-na', '시연복지관 나', '서울특별시', 'TODO', 'TODO', 'TODO', 'TODO', true),
    ('demo-da', '시연복지관 다', '서울특별시', 'TODO', 'TODO', 'TODO', 'TODO', true),
    ('demo-ra', '시연복지관 라', '서울특별시', 'TODO', 'TODO', 'TODO', 'TODO', true)
  on conflict (slug) do update set
    name = excluded.name, sido = excluded.sido, sigungu = excluded.sigungu,
    phone = excluded.phone, homepage = excluded.homepage,
    notice_url = excluded.notice_url, is_active = excluded.is_active;

  select id into c_ga from centers where slug = 'demo-ga';
  select id into c_na from centers where slug = 'demo-na';
  select id into c_da from centers where slug = 'demo-da';

  delete from periods
  where notice_id is null
    and center_id in (c_ga, c_na, c_da)
    and label in ('2026년 하반기 프로그램', '2026년 겨울학기 프로그램', '2026년 가을학기 프로그램');

  insert into periods (center_id, label, apply_start, apply_end, method, status, confidence, confirmed_at)
  values
    (c_ga, '2026년 하반기 프로그램',  demo_day,      demo_day + 6,  '복지관 방문 접수', 'confirmed', 1, now()),
    (c_na, '2026년 겨울학기 프로그램', demo_day + 3,  demo_day + 9,  '복지관 방문 접수', 'confirmed', 1, now()),
    (c_da, '2026년 가을학기 프로그램', demo_day - 20, demo_day - 10, '복지관 방문 접수', 'confirmed', 1, now());
end $$;
