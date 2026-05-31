from django.http import HttpResponse, StreamingHttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.utils import timezone
from django.views.decorators.http import require_http_methods
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


# ── Media proxy ───────────────────────────────────────────────────────────────

# Allowed prefixes — only serve files from these S3 key prefixes.
# This prevents the proxy from being used to read arbitrary bucket contents.
_ALLOWED_PREFIXES = ('profiles/',)

# MIME type map for the content types we store.
_MIME_TYPES = {
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
    'gif':  'image/gif',
    'webp': 'image/webp',
    'bmp':  'image/bmp',
}


@require_http_methods(["GET"])
def serve_media(request, path):
    """
    GET /api/media/<path>

    Authenticated proxy for private S3 objects.  The browser never talks to
    S3 directly — it requests this endpoint, Django fetches the object using
    its IAM credentials, and streams the bytes back.

    Security:
      - Must be logged in (401 otherwise).
      - Only paths under _ALLOWED_PREFIXES are served (404 otherwise).
      - Path traversal attempts (containing '..') are rejected.
    """
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    # Reject any path traversal attempt.
    if '..' in path:
        return HttpResponse(status=400)

    # Only serve from allowed prefixes.
    if not any(path.startswith(prefix) for prefix in _ALLOWED_PREFIXES):
        return HttpResponse(status=404)

    # If S3 is not configured (local dev), fall back to Django's default
    # storage (local filesystem) so the proxy works in all environments.
    if not getattr(settings, 'USE_S3', False):
        try:
            f = default_storage.open(path)
            ext = path.rsplit('.', 1)[-1].lower()
            content_type = _MIME_TYPES.get(ext, 'application/octet-stream')
            return StreamingHttpResponse(f, content_type=content_type)
        except FileNotFoundError:
            return HttpResponse(status=404)

    # Fetch from S3 using boto3 (same credentials used everywhere else).
    try:
        s3  = _s3_client()
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=path)
    except s3.exceptions.NoSuchKey:
        return HttpResponse(status=404)
    except Exception:
        return HttpResponse(status=502)

    ext          = path.rsplit('.', 1)[-1].lower()
    content_type = _MIME_TYPES.get(ext, obj['ContentType'])

    # Stream in 64 KB chunks — avoids loading the whole image into memory.
    body = obj['Body']

    def _stream():
        while True:
            chunk = body.read(65536)
            if not chunk:
                break
            yield chunk

    response = StreamingHttpResponse(_stream(), content_type=content_type)
    response['Content-Length'] = obj['ContentLength']
    # Cache in the browser for 10 minutes — pictures don't change often, but
    # we don't want stale avatars to linger after an upload.
    response['Cache-Control'] = 'private, max-age=600'
    return response


# ── Test views (unchanged) ────────────────────────────────────────────────────

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
