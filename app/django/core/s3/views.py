from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from core.settings import env

def test_upload(request):
    default_storage.save(
        "prueba.txt",
        ContentFile("Hola desde Django")
    )
    return HttpResponse(f"Archivo subido. AWS_S3={env.bool('AWS_S3')}")


def test_list(request):
    # Lists all files in the bucket root (or prefix if given)
    dirs, files = default_storage.listdir("")
    file_list = "<br>".join(files) or "No files found"
    return HttpResponse(f"<b>Files in bucket:</b><br>{file_list}")


def test_read(request):
    filename = "prueba.txt"
    if not default_storage.exists(filename):
        return HttpResponse(f"'{filename}' does not exist in storage.", status=404)

    with default_storage.open(filename, "r") as f:
        content = f.read()

    return HttpResponse(f"<b>Content of {filename}:</b><br>{content}")