# core/views.py
from django.http import JsonResponse
import socket
import os

def test_api(request):
    return JsonResponse({
        "host": socket.gethostname()
    })

