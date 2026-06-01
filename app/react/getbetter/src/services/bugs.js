import { buildUrl, parseResponse } from './http'

// POST /api/bugs/
// Auth optional — if logged in, report is associated with user; otherwise anonymous.
export const submitBugReport = async (description) => {
  const response = await fetch(buildUrl('/api/bugs/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ description }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to submit bug report' }
  return { ok: true, data: payload }
}

// GET /api/bugs/list/
// Admin → { bugs: [...], developers: [...] }
// Developer → { bugs: [...] }
export const getBugReports = async () => {
  const response = await fetch(buildUrl('/api/bugs/list/'), { credentials: 'include' })
  const payload  = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to fetch bug reports' }
  return { ok: true, data: payload }
}

// PATCH /api/bugs/<id>/assign/
// Body: { developer_id: <int> | null }
export const assignBugReport = async (bugId, developerId) => {
  const response = await fetch(buildUrl(`/api/bugs/${bugId}/assign/`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ developer_id: developerId }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to assign bug report' }
  return { ok: true, data: payload }
}
