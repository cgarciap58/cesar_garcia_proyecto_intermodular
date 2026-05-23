import { buildUrl, parseResponse } from './http'

// ─── Slots (psychologist-facing) ──────────────────────────────────────────────

export const getSlots = async () => {
  const response = await fetch(buildUrl('/api/appointments/slots/'), {
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch slots' }
  return { ok: true, data: payload }
}

export const createSlots = async (startTimes) => {
  const response = await fetch(buildUrl('/api/appointments/slots/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ start_times: startTimes }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to create slots' }
  return { ok: true, data: payload }
}

export const deleteSlot = async (slotId) => {
  const response = await fetch(buildUrl(`/api/appointments/slots/${slotId}/`), {
    method: 'DELETE',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to delete slot' }
  return { ok: true }
}

// ─── Available slots (patient-facing) ────────────────────────────────────────
//
// Returns { psychologists: [ { id, first_name, last_name, session_price,
//   session_duration_minutes, is_verified, verification_status, slots: [...] } ] }
// Already grouped by psychologist, ready to render one card each.

export const getAvailableSlots = async () => {
  const response = await fetch(buildUrl('/api/appointments/slots/available/'), {
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch available slots' }
  return { ok: true, data: payload }
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export const getAppointments = async () => {
  const response = await fetch(buildUrl('/api/appointments/'), {
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch appointments' }
  return { ok: true, data: payload }
}

export const bookAppointment = async (slotId) => {
  const response = await fetch(buildUrl('/api/appointments/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ slot_id: slotId }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to book appointment' }
  return { ok: true, data: payload }
}

export const confirmAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/confirm/`), {
    method: 'PATCH',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to confirm appointment' }
  return { ok: true, data: payload }
}

export const cancelAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/cancel/`), {
    method: 'PATCH',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to cancel appointment' }
  return { ok: true, data: payload }
}

export const getAppointmentHistory = async (withUserId) => {
  const response = await fetch(
    buildUrl(`/api/appointments/history/?with=${withUserId}`),
    { credentials: 'include' },
  )
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch history' }
  return { ok: true, data: payload }
}
