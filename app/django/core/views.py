# core/views.py
from django.http import JsonResponse
import socket
import os

def test_api(request):
    return JsonResponse({
        "host": socket.gethostname()
    })

# views.py

def session_test(request):
    counter = request.session.get("counter", 0)
    counter += 1
    request.session["counter"] = counter

    return JsonResponse({
        "counter": counter,
        "session_key": request.session.session_key,
    })