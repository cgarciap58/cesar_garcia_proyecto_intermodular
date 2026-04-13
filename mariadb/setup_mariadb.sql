-- Create database and user
CREATE USER 'django'@'%' IDENTIFIED BY 'admin'; 
GRANT ALL PRIVILEGES ON db_proyecto_final.* TO 'django'@'localhost';
FLUSH PRIVILEGES;


-- DATABASES = {
--     "default": {
--         "ENGINE": "django.db.backends.mysql",
--         "NAME": 'db_proyecto_final',
--         "USER": 'django',
--         "PASSWORD": 'admin',
--         "HOST": "localhost",
--         "PORT": "",
--     }
-- }
