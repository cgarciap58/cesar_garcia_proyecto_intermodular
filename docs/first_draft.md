I want you to go through the project, assuming deployment in AWS. I need help documenting. Do NOT use emojis, icons, arrows or otherwise special characters.

Use of .md notation is preferred.

I want you to explain and document:

1) What the project is about (surface level, a website for psychologists and pacients with hopes to specialize in pacients with behavioural addictions). Simply a bit of context, I will expand this.

2) Web-App. The stack for the project (Debian hosts, Services: Nginx proxy, Nginx+ReactJS build + Django backend, MariaDB database, Redis for cache, S3 for persistent image storage).

3) Database. The database relationship models. Look profoundly at the objects/tables created in django and show some example of correlational use. Explain django admin panel as a UI that interfaces with the database. Mention backup_db.sh and read_or_unzip_backups.sh

4) Arquitecture. The architecture of the AWS deployment. Highlight the traffic flow LB -> alternating front+backend -> DB / Redis / S3 . Highlight scalability of architecture. Built-in security via security groups and ACLs.

5) Orchestration. Mention each setup_{service}.sh file in the project, briefly explain their job. Explain setup_or_deploy_EC2_aws.sh, update_lb.sh, app_deploy.sh

6) Operating systems and services for on premise. Mention DHCP, DNS, FTP on a Windows Server 2022. In the domain, GPOs (corporate desktop, powershell blocked), Users, Groups. Will be further expanded by me.

7) Security. Risk analysis, mention tripled deployment with AWS availability zones, maximum physical access protection, data is sentitive, importance of following GDPR and "Esquema Nacional de Seguridad" (Spain's regulation).

8) Web-app (software development). Utilization of Python/Django framework and ReactJS library. Scripting in Bash. Validation of input fields, use of i18n for multilingual support, pre-loading GIF while ReactJS loads. Hashed passwords during signup.

9) Future improvements. Improve security even further (GDPR, ENS, pentesting). Incorporate APIs (Stripe for payment, Google Meets, OAuth for signin).  Incorporate built-in AWS features such as ALB and Route 53. Create additional app that feeds user data to the app for psych to monitor patients (parental control style).

