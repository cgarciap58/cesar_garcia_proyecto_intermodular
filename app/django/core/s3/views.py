from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.utils import timezone
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
    """
    Uploads a timestamped .txt to S3 via default_storage.
    Each call creates a NEW file, proving both app nodes write to the same bucket.
    """
    try:
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        filename = f"demo/upload_{timestamp}.txt"
        content = (
            f"Uploaded at: {timestamp}\n"
            f"Bucket: {settings.AWS_STORAGE_BUCKET_NAME}\n"
            f"Storage backend: {settings.STORAGES['default']['BACKEND']}\n"
        )
        path = default_storage.save(filename, ContentFile(content.encode()))
        url = default_storage.url(path)
        return HttpResponse(
            f"✅ Upload OK<br><br>"
            f"<b>Path in S3:</b> {path}<br>"
            f"<b>URL:</b> <a href='{url}'>{url}</a><br><br>"
            f"<a href='/test/s3/list/'>→ See all files in bucket</a>"
        )
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)


def test_list(request):
    """
    Lists all files in the bucket directly via boto3.
    Both app nodes should see the exact same list.
    """
    try:
        s3 = _s3_client()
        response = s3.list_objects_v2(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
        objects = response.get('Contents', [])

        if not objects:
            body = "Bucket is empty."
        else:
            rows = "".join(
                f"<tr><td>{obj['Key']}</td><td>{obj['Size']} bytes</td><td>{obj['LastModified']}</td></tr>"
                for obj in sorted(objects, key=lambda x: x['LastModified'], reverse=True)
            )
            body = f"<table border='1' cellpadding='6'><tr><th>Key</th><th>Size</th><th>Last Modified</th></tr>{rows}</table>"

        return HttpResponse(
            f"✅ <b>{len(objects)} file(s) in bucket '{settings.AWS_STORAGE_BUCKET_NAME}':</b><br><br>{body}<br><br>"
            f"<a href='/test/s3/upload/'>→ Upload a new file</a>"
        )
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)


def test_read(request):
    """
    Reads the most recently uploaded file from the bucket.
    """
    try:
        s3 = _s3_client()
        response = s3.list_objects_v2(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Prefix="demo/")
        objects = response.get('Contents', [])

        if not objects:
            return HttpResponse("No files found in demo/ prefix. Upload one first.", status=404)

        latest = sorted(objects, key=lambda x: x['LastModified'], reverse=True)[0]
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=latest['Key'])
        content = obj['Body'].read().decode('utf-8')

        return HttpResponse(
            f"✅ <b>Most recent file:</b> {latest['Key']}<br><br>"
            f"<pre>{content}</pre>"
            f"<a href='/test/s3/list/'>→ See all files</a>"
        )
    except Exception:
        return HttpResponse(f"❌ ERROR:<br><pre>{traceback.format_exc()}</pre>", status=500)