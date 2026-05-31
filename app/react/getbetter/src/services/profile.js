import { buildUrl, parseResponse } from './http'

// PATCH /api/auth/profile/
// Success: full user payload (same shape as /api/auth/me/).
// Field errors: { ok: false, fieldErrors: { field: "error_code" } }
// Generic error: { ok: false, error: "message" }
export const updateProfile = async (fields) => {
  const response = await fetch(buildUrl('/api/auth/profile/'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fields),
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    // New structured shape: { errors: { field: "code" } }
    if (payload.errors && typeof payload.errors === 'object') {
      return { ok: false, fieldErrors: payload.errors }
    }
    // Legacy / unexpected shape: { error: "message" }
    return { ok: false, error: payload.error || 'Failed to update profile' }
  }
  return { ok: true, data: payload }
}

// POST /api/auth/credits/add/
export const addCredits = async () => {
  const response = await fetch(buildUrl('/api/auth/credits/add/'), {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await parseResponse(response)
  if (!response.ok) return { ok: false, error: payload.error || 'Failed to add credits' }
  return { ok: true, data: payload }
}

// POST /api/auth/profile/picture/
// Sends the file as multipart/form-data — DO NOT set Content-Type manually;
// the browser sets it (with the correct boundary) when using FormData.
// Success: { profile_picture_url: "https://..." }
// Error:   { ok: false, error: "error_code" }
export const uploadProfilePicture = async (file) => {
  const formData = new FormData()
  formData.append('profile_picture', file)

  const response = await fetch(buildUrl('/api/auth/profile/picture/'), {
    method: 'POST',
    credentials: 'include',
    // No Content-Type header — let the browser set multipart/form-data + boundary
    body: formData,
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    return { ok: false, error: payload.error || 'upload_failed' }
  }
  return { ok: true, data: payload }
}
