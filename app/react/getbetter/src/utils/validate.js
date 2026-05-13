const ALLOWED_NAME_CHARACTERS_REGEX = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ-]+$/;
const ALLOWED_MESSAGE_CHARACTERS_REGEX = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s\.,!?()\-]+$/;

export function validateSignUpForm(formData) {
  return {
    fullName: validateFullName(formData.fullName),
    email: validateEmail(formData.email),
    concerns: validateMessage(formData.concerns),
  };
}

export function validateFullName(fullName = "") {
  const errors = [];
  const min_length = 5;

  if (fullName.length < min_length) {
    errors.push(`Name must have at least ${min_length} characters`);
  }

  if (hasDisallowedNameCharacters(fullName)) {
    errors.push(
      "Name has disallowed characters. If this a mistake, contact the administrator."
    );
  }

  return errors;
}

export function validateEmail(email = "") {
  const errors = [];
  const min_length = 6;

  if (email.length < min_length) {
    errors.push(`E-mail must have at least ${min_length} characters`);
  }

  return errors;
}

export function validateMessage(message = "") {
  const errors = [];

  if (hasDisallowedMessageCharacters(message)) {
    errors.push("Message has disallowed characters.");
  }

  return errors;
}


export function hasDisallowedNameCharacters(value = "") {
  return !ALLOWED_NAME_CHARACTERS_REGEX.test(value);
}

export function hasDisallowedMessageCharacters(value = "") {
  return !ALLOWED_MESSAGE_CHARACTERS_REGEX.test(value);
}

function getPasswordStrength(password = "") {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}