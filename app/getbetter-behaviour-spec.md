# GetBetter — Behaviour Specification

> **Purpose:** Single source of truth for how the app behaves. Use this before writing tests, touching components, or making changes. If code contradicts this document, the code is wrong.

---

## 1. Roles

| Role | Can do |
|---|---|
| `patient` | Register, browse slots at `/book`, request appointments, withdraw pending requests, cancel confirmed appointments, view history |
| `psychologist` | Register, manage slots at `/slots`, confirm/reject pending requests, cancel confirmed appointments, write private notes, view history |

---

## 2. Appointment Status Model

### Stored statuses (persisted in DB)
| Status | Meaning |
|---|---|
| `pending_request` | Patient requested; awaiting psychologist action |
| `confirmed` | Psychologist confirmed this patient |
| `rejected` | Psychologist rejected this specific request; slot stays/returns open |
| `withdrawn` | Patient withdrew their own pending request; credits refunded |
| `cancelled` | A confirmed appointment was cancelled by either party |

### Computed statuses (derived at read-time, never stored)
| Status | Condition |
|---|---|
| `in_progress` | stored=`confirmed` AND `now >= start_time AND now < start_time + duration` |
| `done` | stored=`confirmed` AND `now >= start_time + duration` |

**Client** (`computedStatus()` in `appointmentFormatters.js`) derives these too, so the UI updates between API fetches without requiring a reload.

### Slot statuses
| Status | Meaning |
|---|---|
| `open` | Visible on `/book`, requestable, deletable (if no active pending requests) |
| `confirmed` | Has one confirmed appointment; cannot be deleted until that appointment is cancelled |
| `deleted` | Soft-deleted; hidden from UI, kept in DB for audit |

---

## 3. Credit System

- Credit cost = `ceil(duration_minutes / 55)` — a 55-minute session costs 1 credit.
- Credits are deducted from the patient at booking time (when `pending_request` is created).
- Credits are refunded when: psychologist rejects, patient withdraws, either party cancels a `confirmed` appointment **before** it starts (`in_progress` cancellations are NOT refunded).

---

## 4. Appointment Lifecycle & Allowed Transitions

```
pending_request
  ├─→ confirmed    (psychologist confirms; all other pending_requests on same slot → rejected + refunded)
  ├─→ rejected     (psychologist rejects this one; slot stays open)
  └─→ withdrawn    (patient withdraws; credits refunded; slot reopens if no more active requests)

confirmed
  ├─→ in_progress  (computed; no stored change)
  ├─→ done         (computed; no stored change)
  └─→ cancelled    (either party; credits refunded unless in_progress)
```

No other transitions are valid. The API returns `409` if an invalid transition is attempted.

---

## 5. Pages & Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with hero, testimonials, footer |
| `/auth` | Public (redirects if logged in) | Login / Register tabs |
| `/dashboard` | Authenticated | Renders `PatientDashboard` or `PsychologistDashboard` based on role |
| `/book` | Patient only | Browse psychologists and available slots |
| `/slots` | Psychologist only | Manage recurring schedule and upcoming slots |
| `/profile` | Authenticated | Edit personal info, timezone, role-specific fields |

---

## 6. Patient Dashboard (`PatientDashboard`)

### Layout
- Left sidebar: `DashboardSidebar` with name, role label, credit balance, "Add credits" button, "Book appointment" link.
- Main area: appointments panel + optional detail panel (stacked vertically).

### Appointment grouping
- **Active** (`pending_request`, `confirmed`, `in_progress`): shown in main `AppointmentsPanel`.
- **Archive** (`withdrawn`, `rejected`, `cancelled`, `done`): collapsed by default; toggle shows them in a second panel.

### Selecting an appointment
- Click a card → fetches fresh data via `GET /api/appointments/<id>/` → shows `AppointmentDetail` below.
- Second click on the same card → deselects (hides detail panel).
- Selecting a different card → replaces detail panel.

### Actions available by status
| Status | Actions |
|---|---|
| `pending_request` | "Withdraw request" |
| `confirmed` | "Cancel appointment" |
| `in_progress` | "Cancel appointment" (no credit refund) |
| `done`, `rejected`, `withdrawn`, `cancelled` | None |

### AppointmentDetail — patient view
- Shows counterpart as "Dr. {lastName}" (no firstName shown in avatar label for psychologist).
- **Previous sessions** label: `"Previous sessions with Dr. {lastName}"` (translation key: `patient.previousSessionsWith`).
- For `done` appointments: shows session notes from psychologist (`patient_notes` field) under "Notes from your psychologist".
- For `confirmed`/`in_progress`: shows "Go to session" / "Join now — session in progress" button → opens `SessionModal`.

---

## 7. Psychologist Dashboard (`PsychologistDashboard`)

### Layout
- Left sidebar: `DashboardSidebar` with name ("Dr." prefix), role label, "Manage slots" link.
- Main area: appointments panel + optional detail panel.

### Appointment grouping
- **Active** (`pending_request`, `confirmed`, `in_progress`): shown in main panel.
- **Rejected**: collapsed toggle, shown separately.
- **Resolved** (`cancelled`, `done`, `withdrawn`): collapsed toggle, shown separately.

### Selecting an appointment
- Same behaviour as patient: click to select, second click to deselect, fetches fresh data.

### Actions available by status
| Status | Actions |
|---|---|
| `pending_request` | "Confirm" + "Reject request" |
| `confirmed` | "Cancel appointment" |
| `in_progress` | "Cancel appointment" (no credit refund) |
| `done`, `rejected`, `withdrawn`, `cancelled` | None |

### Confirm side effect (auto-rejection notice)
When a psychologist confirms one `pending_request`, all other pending requests on the same slot are automatically rejected and their patients refunded. The dashboard displays an amber banner listing the auto-rejected patients' first names. The banner is dismissible.

### AppointmentDetail — psychologist view
- Shows counterpart with no prefix (patient has no "Dr." title).
- **Previous sessions** label: `"Previous sessions with {firstName} {lastName}"` (translation key: `psychologist.previousSessionsWith`). **Both `firstName` and `lastName` must be passed to the translation function.**
- For `done` appointments: shows session notes (`patient_notes`) and private notes (`private_notes`) in separate cards.
- For `confirmed`/`in_progress`: shows "Go to session" / "Join now — session in progress" button → opens `SessionModal`.

---

## 8. Session Modal (`SessionModal`)

Opened from `AppointmentDetail` when status is `confirmed` or `in_progress`.

- Shows counterpart avatar, full display name, date/time, duration.
- **Countdown behaviour:**
  - `> 1 day` until start: "Starts in N days"
  - `1h–24h`: "Starts in Nh Nm"
  - `< 1h`: live ticking MM:SS countdown in amber monospace
  - `in_progress`: pulsing blue dot + "In progress · N min remaining"
  - after end: "Session has ended"
- **Meet link:** Generated by the backend when the appointment is fetched within 30 minutes of start time. If not yet generated, the modal uses a deterministic mock link (stable per appointment ID within a session). Clicking "Go now" / "Go to session" opens the meet link in a new tab.
- Closes on: Escape key, clicking the backdrop, clicking the X button.
- Prevents body scroll while open.

---

## 9. Booking Page (`/book`)

- Only accessible to patients.
- Shows credit balance and cost reminder ("Each 55-minute session costs 1 credit").
- Lists psychologists with their open slots, grouped by date in the patient's timezone.
- Psychologist card is collapsed by default; click to expand slots.
- "Request" button: deducts credit optimistically, sends `POST /api/appointments/`, shows success/error inline.
- After a successful request: the slot is removed from the local list (prevents double-request) and the credit balance in the parent is updated.
- Error cases: insufficient credits (show message linking to dashboard), already requested (show specific message).

---

## 10. Slots Page (`/slots`) — Psychologist only

- Two panels: "Session duration override" and "Recurring schedule".
- **Duration override:** changes duration for all newly created slots (not the profile default). Must be 15–180 minutes.
- **Recurring schedule:** select days of week + time window + date range → previews N slots to add or remove. Apply button executes the batch. Reports created/skipped or removed/could-not-delete counts.
- **Upcoming slots:** list of open and confirmed slots from today. Confirmed slots are locked (cannot be deleted until the appointment is cancelled).

---

## 11. Profile Page (`/profile`)

- Sections: Personal info, Timezone, Role info (psychologist only), Password (not shown in current implementation).
- Fields for all users: first name, last name, city, country, profile picture URL.
- Fields for psychologists only: license number, session duration (default), session price, verification status badge (read-only).
- Timezone selector: affects how dates/times are displayed across the app.
- Save triggers `PATCH /api/auth/profile/`; shows success/error feedback for 3.5 seconds.

---

## 12. Previous Sessions (`PreviousSessions` component)

- Fetches last 3 completed (`done`) appointments with the counterpart via `GET /api/appointments/history/?with={userId}`.
- Each entry is a collapsible row showing date + duration.
- Expanded: shows "Session notes" (from `patient_notes`) and, for psychologists, "Private notes" (from `private_notes`).
- Empty states differ by role: "No previous sessions with this psychologist." vs "No previous sessions with this patient."
- Loading state: 2 skeleton rows.

---

## 13. i18n

- Languages: `es` (default), `en`.
- Language stored in `localStorage('lang')`.
- Namespaces: `common`, `auth`, `dashboard`, `appointments`, `book`, `profile`.
- `<html lang>` is kept in sync with the active language.

### Key interpolation contracts (do not break these)

| Key | Namespace | Required variables |
|---|---|---|
| `patient.previousSessionsWith` | dashboard | `lastName` |
| `psychologist.previousSessionsWith` | dashboard | `firstName`, `lastName` |
| `psychologist.autoRejectedBody` | dashboard | `names` (string), `count` (number) |
| `patient.showArchive` | dashboard | `count` |
| `psychologist.showRejected` | dashboard | `count` |
| `psychologist.showResolved` | dashboard | `count` |
| `slots.durationHint` | appointments | `default` |
| `slots.applyCreate` | appointments | `count` |
| `slots.applyRemove` | appointments | `count` |
| `slots.noSlotsPreview` | appointments | `duration` |

---

## 14. API Endpoints Summary

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/auth/me/` | Any | Current user info |
| POST | `/api/auth/register/` | Public | Register |
| POST | `/api/auth/login/` | Public | Login |
| POST | `/api/auth/logout/` | Any | Logout |
| PATCH | `/api/auth/profile/` | Authenticated | Update profile |
| POST | `/api/auth/credits/add/` | Patient | Add credits |
| GET | `/api/appointments/slots/` | Psychologist | Own slots |
| POST | `/api/appointments/slots/` | Psychologist | Batch create slots |
| DELETE | `/api/appointments/slots/<id>/` | Psychologist | Delete open slot |
| GET | `/api/appointments/slots/available/` | Patient | Open slots grouped by psychologist |
| GET | `/api/appointments/` | Any | Own appointments |
| POST | `/api/appointments/` | Patient | Request a slot |
| GET | `/api/appointments/<id>/` | Owner | Single appointment (triggers meet_link if within 30 min) |
| PATCH | `/api/appointments/<id>/confirm/` | Psychologist | Confirm; auto-rejects siblings |
| PATCH | `/api/appointments/<id>/reject/` | Psychologist | Reject one request |
| PATCH | `/api/appointments/<id>/withdraw/` | Patient | Withdraw pending request |
| PATCH | `/api/appointments/<id>/cancel/` | Either | Cancel confirmed appointment |
| GET | `/api/appointments/history/?with=<userId>` | Any | Last 3 done appointments with a user |

---

## 15. Known Constraints & Rules

- Multiple patients can request the same slot simultaneously. Confirming one rejects the rest.
- A slot with active `pending_request` appointments cannot be deleted. The API returns `409`.
- A `confirmed` slot cannot be deleted. Cancel the appointment first.
- `in_progress` cancellations do NOT refund credits.
- Meet links are generated lazily (on `GET /api/appointments/<id>/`) within a 30-minute window before start. The generation is idempotent (select_for_update prevents duplicates). The frontend falls back to a deterministic mock link if none is present yet.
- Appointment history returns at most the last **3** completed sessions.
- Credit cost is `ceil(duration / 55)`. A 110-minute session costs 2 credits.
