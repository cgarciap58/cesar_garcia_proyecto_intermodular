import { buildUrl, parseResponse } from './http'

export const updateProfile = async (fields) => {
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
