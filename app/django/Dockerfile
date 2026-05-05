FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /django
COPY requirements.txt requirements.txt
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
RUN pip install -r requirements.txt
COPY . .
CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]
