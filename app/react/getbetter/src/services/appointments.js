import { buildUrl, parseResponse } from './http'

// ─── Slots (psychologist-facing) ──────────────────────────────────────────────

export const getSlots = async () => {
  const response = await fetch(buildUrl('/api/appointments/slots/'), { credentials: 'include' })
  const payload  = await parseResponse(response)
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

// ─── Available slots (patient-facing /book) ───────────────────────────────────

export const getAvailableSlots = async () => {
  const response = await fetch(buildUrl('/api/appointments/slots/available/'), { credentials: 'include' })
  const payload  = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch available slots' }
  return { ok: true, data: payload }
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export const getAppointments = async () => {
  const response = await fetch(buildUrl('/api/appointments/'), { credentials: 'include' })
  const payload  = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch appointments' }
  return { ok: true, data: payload }
}

/** Fetch a single appointment by id. Triggers meet_link generation on backend
 *  if the appointment is confirmed and within the 30-minute window. */
export const getAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/`), {
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch appointment' }
  return { ok: true, data: payload }
}

/** Patient requests a slot. */
export const bookAppointment = async (slotId) => {
  const response = await fetch(buildUrl('/api/appointments/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ slot_id: slotId }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to request appointment' }
  return { ok: true, data: payload }
}

/** Psychologist confirms one pending_request. */
export const confirmAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/confirm/`), {
    method: 'PATCH',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to confirm appointment' }
  return { ok: true, data: payload }
}

/** Psychologist rejects one specific pending_request (slot stays open). */
export const rejectAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/reject/`), {
    method: 'PATCH',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to reject request' }
  return { ok: true, data: payload }
}

/** Patient withdraws their own pending_request before psych acts. */
export const withdrawAppointment = async (appointmentId) => {
  const response = await fetch(buildUrl(`/api/appointments/${appointmentId}/withdraw/`), {
    method: 'PATCH',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to withdraw request' }
  return { ok: true, data: payload }
}

/** Cancel a confirmed appointment (either role). */
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
