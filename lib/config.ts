// 숫자 설정은 모두 여기에 모은다.

// 자동 작업 (Vercel 함수 1회 실행 제한 60초 안에서)
export const JOB_TIME_BUDGET_MS = 50_000;
export const CRAWL_BATCH = 10;
export const SEND_BATCH = 200;

// 자동 발송 시각 (Vercel Cron "0 0 * * *" = 한국 오전 9시). 화면 표시용.
export const DAILY_SEND_TIME_KST = "09:00";
// 신청 시작 며칠 전에 미리 알릴지
export const REMIND_DAYS_BEFORE = 3;

// 목록 페이지네이션
export const PAGE_SIZE = 50;

// 보호자
export const MAX_GUARDIANS_PER_SENIOR = 5;

// OTP
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_COOLDOWN_MS = 60_000;
export const OTP_HOURLY_LIMIT = 5;
export const OTP_MAX_ATTEMPTS = 5;

// 세션
export const SESSION_DAYS = 7;

// 보호자 "지금 한 번 더 알리기": 어르신당 1분 1회
export const MANUAL_NOTIFY_COOLDOWN_MS = 60_000;

// 전화번호 암호화 키 버전 (키 교체 시 올림)
export const CURRENT_PHONE_KEY_VERSION = 1;

// 게시판 확인·분석
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_BOARD_LINKS = 50;
export const MAX_NOTICE_CANDIDATES = 3;
export const MAX_ANALYZE_IMAGES = 4;
export const MAX_TEXT_FIRST_IMAGES = 2;
export const MAX_ANALYZE_TEXT_CHARS = 8_000;
export const TEXT_ENOUGH_CHARS = 200;
export const MIN_IMAGE_PX = 100;
export const CRAWL_USER_AGENT =
  "Mozilla/5.0 (compatible; WelfareAlertBot/1.0; +notice-period-checker)";

// 음성 문구 최대 바이트 (Solapi VOICE)
export const VOICE_MAX_BYTES = 980;
