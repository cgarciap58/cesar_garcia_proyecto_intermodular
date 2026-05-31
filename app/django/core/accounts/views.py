"""
accounts/views.py
─────────────────
Public re-export shim.  urls.py imports from here — no changes needed there.

All logic lives in:
  • views_auth.py    — register, login, get_user, logout
  • views_profile.py — update_profile, add_credits, upload_profile_picture
  • utils.py         — validators, helpers, user_payload serializer
"""

from .views_auth import register_user, login_user, get_user, logout_user  # noqa: F401
from .views_profile import update_profile, add_credits, upload_profile_picture  # noqa: F401
