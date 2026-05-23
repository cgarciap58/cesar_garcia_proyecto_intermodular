import { buildUrl, parseResponse } from './http'

// PATCH /api/auth/profile/
// Accepts any subset of the user's profile fields.
// Returns the full updated user payload (same shape as /api/auth/me/).
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

// POST /api/auth/credits/add/
// Mock endpoint — adds 10 credits to the patient's balance.
// Returns { credits: <new_total>, added: 10 }.
// Will be replaced by a Stripe checkout session in the future.
export const addCredits = async () => {
  const response = await fetch(buildUrl('/api/auth/credits/add/'), {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to add credits' }
  return { ok: true, data: payload }
}
