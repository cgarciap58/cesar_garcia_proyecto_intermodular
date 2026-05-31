from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from core.settings import env

def test_upload(request):

    default_storage.save(
        "prueba.txt",
        ContentFile(f"Hola desde Django")
    )

    return HttpResponse(f"Archivo subido, {env.bool("AWS_S3")}")