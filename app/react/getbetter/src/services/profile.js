// services/profile.js
// Thin wrapper around the PATCH /api/auth/profile/ endpoint.
 
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const buildUrl = (path) => `${API_BASE_URL}${path}`
 
const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return {}
  try { return await response.json() } catch { return {} }
}
 
export const updateProfile = async (fields) => {
  // fields: { session_duration_minutes?: number, timezone?: string }
  const response = await fetch(buildUrl('/api/auth/profile/'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fields),
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to update profile' }
  return { ok: true, data: payload }
}
 
