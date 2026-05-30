"""
appointments/views.py
─────────────────────
Public re-export shim.  urls.py imports from here — no changes needed there.

All logic lives in:
  • utils.py                — auth, credits, status, serializers, meet-link
  • views_slots.py          — slots_list, slot_detail, available_slots
  • views_appointments.py   — appointments_list, appointment_detail, appointment_history
  • views_actions.py        — confirm, reject, withdraw, cancel
"""

from .views_slots import slots_list, slot_detail, available_slots              # noqa: F401
from .views_appointments import (                                               # noqa: F401
    appointments_list,
    appointment_detail,
    appointment_history,
)
from .views_actions import (                                                    # noqa: F401
    appointment_confirm,
    appointment_reject,
    appointment_withdraw,
    appointment_cancel,
)
