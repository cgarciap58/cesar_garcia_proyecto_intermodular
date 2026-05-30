-- =============================================================
-- grant_test_db.sql
-- Run this once on your MariaDB instance (locally and on the
-- cloud host) to allow the Django test runner to create and
-- drop its temporary test database.
--
-- Usage (local docker):
--   docker exec -i <mariadb-container> \
--     mariadb -u root -p"<ROOT_PASS>" < grant_test_db.sql
--
-- Usage (cloud host — adjust host/socket as needed):
--   mariadb -h <host> -u root -p"<ROOT_PASS>" < grant_test_db.sql
--
-- What it does:
--   1. Creates the test DB if it doesn't already exist so the
--      grant is valid immediately (MariaDB requires the DB to
--      exist for some privilege checks).
--   2. Grants the minimum privileges the Django test runner
--      needs: CREATE, DROP, and full DML on test_getbetterDB.
--   3. Does NOT touch the production database or its grants.
-- =============================================================

-- Replace 'django' and 'secret' with your actual DB user/password
-- from .env.runtime  (DJANGO_DB_USER / DJANGO_DB_PASS).
-- The host wildcard '%' matches the same pattern already used for
-- the production grant.

CREATE DATABASE IF NOT EXISTS `test_getbetterDB`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `test_getbetterDB`.* TO 'django'@'%';

FLUSH PRIVILEGES;