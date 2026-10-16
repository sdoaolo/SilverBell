-- 이미 schema.sql을 실행한 프로젝트에서 "permission denied for table ..."가 날 때 한 번 실행.
-- 서버(service_role)에만 테이블 권한을 준다. anon·authenticated(브라우저)에는 주지 않는다.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
