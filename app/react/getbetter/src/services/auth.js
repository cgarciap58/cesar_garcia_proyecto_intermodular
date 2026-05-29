import { buildUrl, parseResponse } from './http'
import { mapSignUpValuesToPayload, SIGN_UP_FIELD_KEYS } from '../utils/validate'

// Maps machine-readable backend error codes → i18n keys in the 'auth' namespace.
const BACKEND_CODE_MAP = {
  required:             'validation.fieldRequired',
  name_invalid:         'validation.nameInvalid',
  invalid_role:         'validation.roleRequired',
  password_too_short:   'validation.passwordTooShort',
  passwords_mismatch:   'validation.confirmPasswordMismatch',
  email_already_exists: 'validation.emailAlreadyExists',
  invalid_credentials:  'validation.invalidCredentials',
}

// Converts { errors: { field: "code" } } → localised UI error state.
// Always produces at least errors.form if nothing else matches.
const mapBackendErrors = (rawErrors = {}, t) => {
  const errors = {}
  for (const [field, code] of Object.entries(rawErrors)) {
    const key = BACKEND_CODE_MAP[code]
    const message = (t && key) ? t(key) : code
    if (field === 'form' || field === 'non_field_errors') {
      errors.form = message
    } else {
      errors[field] = message
    }
  }
  // Ensure there is always a form-level fallback
  if (!errors.form && Object.keys(errors).length === 0) {
    errors.form = t ? t('validation.genericError') : 'Something went wrong.'
  }
  return errors
}

// Handles legacy { error: "..." } or unexpected shapes from the backend.
const toFieldErrors = (payload, knownFields = [], t) => {
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
    errors.form = t ? t('validation.genericError') : 'Something went wrong. Please try again.'
  }

  return errors
}

export const signIn = async ({ email, password }, t) => {
  const response = await fetch(buildUrl('/api/auth/login/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    // New structured shape: { errors: { field: "code" } }
    if (payload.errors && typeof payload.errors === 'object') {
      return { ok: false, errors: mapBackendErrors(payload.errors, t) }
    }
    // Legacy shape: { error: "..." }
    return { ok: false, errors: toFieldErrors(payload, ['email', 'password'], t) }
  }
  return { ok: true, data: payload }
}

export const signUp = async (values, t) => {
  const response = await fetch(buildUrl('/api/auth/register/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(mapSignUpValuesToPayload(values)),
  })
  const payload = await parseResponse(response)
  if (!response.ok) {
    if (payload.errors && typeof payload.errors === 'object') {
      return { ok: false, errors: mapBackendErrors(payload.errors, t) }
    }
    return { ok: false, errors: toFieldErrors(payload, SIGN_UP_FIELD_KEYS, t) }
  }
  return { ok: true, data: payload }
}
