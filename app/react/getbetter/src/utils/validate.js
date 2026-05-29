// ─── Canonical validation regexes ────────────────────────────────────────────

export const NAME_RE         = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'-]+$/
export const EMAIL_RE        = /^[a-zA-Z0-9@._-]+$/
export const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE        = /^[0-9+\-]+$/
export const DATE_RE         = /^[0-9/\-]+$/

// ─── Live keystroke filters ───────────────────────────────────────────────────

export const filterName  = (v) => v.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s'-]/g, '')
export const filterEmail = (v) => v.replace(/[^a-zA-Z0-9@._-]/g, '')
export const filterPhone = (v) => v.replace(/[^0-9+\-]/g, '')

// ─── DOB age helper ───────────────────────────────────────────────────────────

// Returns true if the ISO date string represents someone aged ≥ minAge today.
export function isOldEnough(isoDate, minAge = 16) {
  if (!isoDate) return false
  const dob      = new Date(`${isoDate}T12:00:00`)
  const today    = new Date()
  const cutoff   = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate())
  return dob <= cutoff
}

// ─── Field-key maps ───────────────────────────────────────────────────────────

export const SIGN_UP_API_FIELD_NAMES = {
  first_name:      'first_name',
  last_name:       'last_name',
  email:           'email',
  role:            'role',
  dob:             'dob',
  password:        'password',
  confirmPassword: 'confirmPassword',
  license_number:  'license_number',
  country_code:    'country_code',
}

export const SIGN_UP_FIELD_KEYS = [
  ...Object.values(SIGN_UP_API_FIELD_NAMES),
  'license_country',
]

export const SIGN_UP_PSYCHOLOGIST_FIELD_KEYS = [
  SIGN_UP_API_FIELD_NAMES.license_number,
  SIGN_UP_API_FIELD_NAMES.country_code,
  'license_country',
]

// ─── Sign-up validation ───────────────────────────────────────────────────────

export function validateSignUpValues(values = {}, t) {
  const tr = t ? (key) => t(`validation.${key}`) : (key) => key
  const errors = {}

  const fn = String(values.first_name || '').trim()
  if (!fn)                    errors.first_name = tr('firstNameRequired')
  else if (!NAME_RE.test(fn)) errors.first_name = tr('firstNameInvalid')

  const ln = String(values.last_name || '').trim()
  if (!ln)                    errors.last_name  = tr('lastNameRequired')
  else if (!NAME_RE.test(ln)) errors.last_name  = tr('lastNameInvalid')

  const em = String(values.email || '').trim()
  if (!em)                            errors.email = tr('emailRequired')
  else if (!EMAIL_FORMAT_RE.test(em)) errors.email = tr('emailInvalid')

  // DOB: required + must be ≥ 16 years old
  if (!values.dob) {
    errors.dob = tr('dobRequired')
  } else if (!isOldEnough(values.dob, 16)) {
    errors.dob = tr('dobTooYoung')
  }

  if (!String(values.role || '').trim()) errors.role = tr('roleRequired')

  const pw = String(values.password || '')
  if (!pw)               errors.password = tr('passwordRequired')
  else if (pw.length < 8) errors.password = tr('passwordTooShort')

  const cpw = String(values.confirmPassword || '')
  if (!cpw)          errors.confirmPassword = tr('confirmPasswordRequired')
  else if (cpw !== pw) errors.confirmPassword = tr('confirmPasswordMismatch')

  return errors
}

// ─── Payload mapper ───────────────────────────────────────────────────────────

export function mapSignUpValuesToPayload(values = {}) {
  return {
    [SIGN_UP_API_FIELD_NAMES.first_name]:      sanitizeText(values.first_name),
    [SIGN_UP_API_FIELD_NAMES.last_name]:       sanitizeText(values.last_name),
    [SIGN_UP_API_FIELD_NAMES.email]:           sanitizeEmail(values.email),
    [SIGN_UP_API_FIELD_NAMES.role]:            values.role || '',
    [SIGN_UP_API_FIELD_NAMES.dob]:             values.dob  || '',
    [SIGN_UP_API_FIELD_NAMES.password]:        values.password || '',
    [SIGN_UP_API_FIELD_NAMES.confirmPassword]: values.confirmPassword || '',
    [SIGN_UP_API_FIELD_NAMES.license_number]:  sanitizeText(values.license_number),
    [SIGN_UP_API_FIELD_NAMES.country_code]:    sanitizeText(values.country_code),
  }
}

// ─── Password strength ────────────────────────────────────────────────────────

export function getPasswordStrength(password = '') {
  let score = 0
  if (password.length >= 8)                               score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password))  score += 1
  if (/\d/.test(password))                                score += 1
  if (/[^A-Za-z0-9]/.test(password))                     score += 1

  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500'    }
  if (score === 2) return { score, label: 'Fair',   color: 'bg-yellow-500' }
  if (score === 3) return { score, label: 'Good',   color: 'bg-blue-500'   }
  return             { score, label: 'Strong', color: 'bg-green-500'   }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function sanitizeText(value = '') {
  return String(value || '').trim()
}

function sanitizeEmail(value = '') {
  return sanitizeText(value).toLowerCase()
}
