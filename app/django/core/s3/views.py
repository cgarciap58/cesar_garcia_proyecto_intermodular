from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
import boto3
import traceback


def _s3_client():
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        aws_session_token=settings.AWS_SESSION_TOKEN,
        region_name=settings.AWS_S3_REGION_NAME,
    )


def test_upload(request):
    try:
        path = default_storage.save("test/prueba.txt", ContentFile(b"Hola desde Django"))
        url = default_storage.url(path)
        return HttpResponse(f"✅ default_storage SAVE OK<br>path: {path}<br>url: {url}")
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)


def test_list(request):
    try:
        s3 = _s3_client()
        response = s3.list_objects_v2(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
        files = [obj['Key'] for obj in response.get('Contents', [])]
        file_list = "<br>".join(files) or "Bucket vacío"
        return HttpResponse(f"✅ Files in S3:<br>{file_list}")
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)


def test_read(request):
    try:
        s3 = _s3_client()
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key="test/prueba.txt")
        content = obj['Body'].read().decode('utf-8')
        return HttpResponse(f"✅ Content of test/prueba.txt:<br>{content}")
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)