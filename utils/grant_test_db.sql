-- =============================================================
-- utils/grant_test_db.sql
--
-- Otorga al usuario Django los privilegios mínimos para que
-- el test runner pueda crear y destruir su base de datos
-- temporal (test_<DJANGO_DB_NAME>).
--
-- Error que resuelve:
--   (1044, "Access denied for user 'django'@'%'
--           to database 'test_getbetterDB'")
--
-- Cómo lanzarlo:
--   Local:  ./utils/run_db_query.sh local  utils/grant_test_db.sql
--   Cloud:  ./utils/run_db_query.sh cloud  utils/grant_test_db.sql
--
-- Qué hace:
--   1. Crea test_getbetterDB si no existe (misma codificación que prod)
--   2. Concede ALL PRIVILEGES sobre ella al usuario 'django'@'%'
--   3. FLUSH PRIVILEGES para que MariaDB los aplique en caliente
--
-- Nota: no toca la base de datos de producción ni sus grants.
-- =============================================================

CREATE DATABASE IF NOT EXISTS `test_getbetterDB`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `test_getbetterDB`.* TO 'django'@'%';

FLUSH PRIVILEGES;

-- Verificación: confirma que el grant se aplicó
SELECT
    User,
    Host,
    Db,
    Grant_priv
FROM mysql.db
WHERE User = 'django'
  AND Db = 'test_getbetterDB';