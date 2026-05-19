const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const buildUrl = (path) => `${API_BASE_URL}${path}`

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return {}
  try {
    return await response.json()
  } catch {
    return {}
  }
}

// \u2500\u2500\u2500 Slots \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export const getSlots = async () => {
  const response = await fetch(buildUrl('/api/appointments/slots/'), {
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch slots' }
  return { ok: true, data: payload }
}

export const createSlots = async (startTimes) => {
  // startTimes: string[] of ISO datetime strings
  // e.g. ['2026-05-21T10:00:00Z', '2026-05-22T14:00:00Z']
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

// \u2500\u2500\u2500 Appointments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
    { credentials: 'include' }
  )
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch history' }
  return { ok: true, data: payload }
}