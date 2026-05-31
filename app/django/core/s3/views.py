from django.http import HttpResponse, StreamingHttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.utils import timezone
from django.views.decorators.http import require_http_methods
import boto3
import botocore.exceptions
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

# Only serve files from these S3 key prefixes — prevents the proxy from
# being used to read arbitrary bucket contents.
_ALLOWED_PREFIXES = ('profiles/',)

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

    Caching:
      - Cache-Control: no-store so the browser never caches profile pictures.
        This is intentional: it prevents a stale image from showing after a
        re-upload, and prevents one user's picture from leaking into another
        user's session via the browser cache.
    """
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    if '..' in path:
        return HttpResponse(status=400)

    if not any(path.startswith(prefix) for prefix in _ALLOWED_PREFIXES):
        return HttpResponse(status=404)

    # Local dev fallback (S3 not configured).
    if not getattr(settings, 'USE_S3', False):
        try:
            f = default_storage.open(path)
            ext = path.rsplit('.', 1)[-1].lower()
            content_type = _MIME_TYPES.get(ext, 'application/octet-stream')
            response = StreamingHttpResponse(f, content_type=content_type)
            response['Cache-Control'] = 'no-store'
            return response
        except FileNotFoundError:
            return HttpResponse(status=404)

    # Fetch from S3.
    try:
        s3  = _s3_client()
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=path)
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] in ('NoSuchKey', '404'):
            return HttpResponse(status=404)
        return HttpResponse(status=502)
    except Exception:
        return HttpResponse(status=502)

    ext          = path.rsplit('.', 1)[-1].lower()
    content_type = _MIME_TYPES.get(ext, obj['ContentType'])

    body = obj['Body']

    def _stream():
        while True:
            chunk = body.read(65536)
            if not chunk:
                break
            yield chunk

    response = StreamingHttpResponse(_stream(), content_type=content_type)
    response['Content-Length'] = obj['ContentLength']
    # no-store: never cache — prevents stale avatars after re-upload and
    # cross-account picture bleed via the browser cache.
    response['Cache-Control'] = 'no-store'
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
