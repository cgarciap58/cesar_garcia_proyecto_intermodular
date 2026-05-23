import { buildUrl, parseResponse } from './http'
import { mapSignUpValuesToPayload, SIGN_UP_FIELD_KEYS } from '../utils/validate'

const toFieldErrors = (payload, knownFields = []) => {
  const errors = {}
  const knownFieldSet = new Set(knownFields)

  Object.entries(payload || {}).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value.join(' ') : String(value)
    if (knownFieldSet.has(key)) {
      errors[key] = message
      return
    }
    if (key === 'non_field_errors' || key === 'detail' || key === 'error') {
      errors.form = message
    }
  })

  if (!errors.form && Object.keys(errors).length === 0) {
    errors.form = 'Something went wrong. Please try again.'
  }

  return errors
}

export const signIn = async ({ email, password }) => {
  const response = await fetch(buildUrl('/api/auth/login/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    return { ok: false, errors: toFieldErrors(payload, ['email', 'password']) }
  }
  return { ok: true, data: payload }
}

export const signUp = async (values) => {
  const response = await fetch(buildUrl('/api/auth/register/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(mapSignUpValuesToPayload(values)),
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    return { ok: false, errors: toFieldErrors(payload, SIGN_UP_FIELD_KEYS) }
  }
  return { ok: true, data: payload }
}
