const ALLOWED_NAME_CHARACTERS_REGEX = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ-]+$/;
const ALLOWED_MESSAGE_CHARACTERS_REGEX = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s.,!?()-]+$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export const SIGN_UP_API_FIELD_NAMES = {
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  role: 'role',
  password: 'password',
  confirmPassword: 'confirmPassword',
  license_number: 'license_number',
  country_code: 'country_code',

};
export const SIGN_UP_FIELD_KEYS = [
  ...Object.values(SIGN_UP_API_FIELD_NAMES),
  'password2',
  'license_country',
];
export const SIGN_UP_PSYCHOLOGIST_FIELD_KEYS = [
  SIGN_UP_API_FIELD_NAMES.license_number,
  SIGN_UP_API_FIELD_NAMES.country_code,
  'license_country',
];

export function validateSignUpValues(values = {}) {
  const errors = {};

  validateRequired(values.first_name, 'First name is required.', errors, 'first_name');
  if (!errors.first_name && hasDisallowedNameCharacters(values.first_name)) {
    errors.first_name = 'First name can only contain letters and hyphens.';
  }

  validateRequired(values.last_name, 'Last name is required.', errors, 'last_name');
  if (!errors.last_name && hasDisallowedNameCharacters(values.last_name)) {
    errors.last_name = 'Last name can only contain letters and hyphens.';
  }

  validateRequired(values.email, 'Email is required.', errors, 'email');
  if (!errors.email && !isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  validateRequired(values.email, 'Email is required.', errors, 'email');
  if (!errors.email && !isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  validateRequired(values.role, 'Role is required.', errors, 'role');

  validateRequired(values.password, 'Password is required.', errors, 'password');
  if (!errors.password && !hasValidPasswordLength(values.password)) {
    errors.password = 'Password must be at least 8 characters.';
  }

  validateRequired(values.confirmPassword, 'Please confirm your password.', errors, 'confirmPassword');
  if (!errors.confirmPassword && !passwordsMatch(values.password, values.confirmPassword)) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function mapSignUpValuesToPayload(values = {}) {
  return {
    [SIGN_UP_API_FIELD_NAMES.first_name]: sanitizeText(values.first_name),
    [SIGN_UP_API_FIELD_NAMES.last_name]: sanitizeText(values.last_name),
    [SIGN_UP_API_FIELD_NAMES.email]: sanitizeEmail(values.email),
    [SIGN_UP_API_FIELD_NAMES.role]: values.role || '',
    [SIGN_UP_API_FIELD_NAMES.password]: values.password || '',
    [SIGN_UP_API_FIELD_NAMES.confirmPassword]: values.confirmPassword || '',
    [SIGN_UP_API_FIELD_NAMES.license_number]: sanitizeText(values.license_number),
    [SIGN_UP_API_FIELD_NAMES.country_code]: sanitizeText(values.country_code),
  };
}

export function hasDisallowedNameCharacters(value = '') {
  return !ALLOWED_NAME_CHARACTERS_REGEX.test(String(value || '').trim());
}

export function hasDisallowedMessageCharacters(value = '') {
  return !ALLOWED_MESSAGE_CHARACTERS_REGEX.test(value);
}

export function getPasswordStrength(password = '') {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-yellow-500' };
  if (score === 3) return { score, label: 'Good', color: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

function validateRequired(value, message, errors, key) {
  if (!String(value || '').trim()) {
    errors[key] = message;
  }
}

function hasValidPasswordLength(password = '') {
  return password.length >= 8;
}

function isValidEmail(email = '') {
  return EMAIL_REGEX.test(String(email || '').trim());
}

function passwordsMatch(password = '', confirmPassword = '') {
  return password === confirmPassword;
}

function sanitizeText(value = '') {
  return String(value || '').trim();
}

function sanitizeEmail(value = '') {
  return sanitizeText(value).toLowerCase();
}