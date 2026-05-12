const DISALLOWED_SPECIAL_CHARACTERS_REGEX = /[\[\]{}=-]/;

export function hasDisallowedCharacters(value = "") {
  return DISALLOWED_SPECIAL_CHARACTERS_REGEX.test(value);
}

export function validateFullName(fullName = "") {
  const errors = [];
  const min_length = 5

  if (fullName.length < min_length) {
    const message = "El nombre de tener al menos " + min_length + " caracteres";
    errors.push(message);
  }

  if (hasDisallowedCharacters(fullName)) {
    errors.push("El nombre no puede incluir caracteres especiales.");
  }

  return errors;
}

export function validateEmail(email = "") {
  const errors = [];
  const min_length = 6

  if (email.length < min_length) {
    const message = "El e-mail debe tener al menos " + min_length + " caracteres";
    errors.push(message);
  }

  return errors;
}

export function validateMessage(message = "") {
  const errors = [];

  if (hasDisallowedCharacters(message)) {
    errors.push("El mensaje no puede incluir caracteres especiales.");
  }

  return errors;
}

export function validateSignUpForm(formData) {
  return {
    fullName: validateFullName(formData.fullName),
    email: validateEmail(formData.email),
    concerns: validateMessage(formData.concerns),
  };
}
