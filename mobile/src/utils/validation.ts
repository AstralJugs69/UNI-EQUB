const ETHIOPIAN_MOBILE_RE = /^(?:\+251|0)?9\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const NAME_RE = /^[\p{L}][\p{L} .'-]{1,78}$/u;

export function normalizeEthiopianPhone(value: string) {
  const compact = value.replace(/[\s-]/g, '');
  if (compact.startsWith('+251')) {
    return `0${compact.slice(4)}`;
  }
  if (compact.startsWith('251')) {
    return `0${compact.slice(3)}`;
  }
  if (compact.startsWith('9')) {
    return `0${compact}`;
  }
  return compact;
}

export function validateEthiopianPhone(value: string, required = true) {
  const compact = value.replace(/[\s-]/g, '');
  if (!compact && !required) {
    return '';
  }
  if (!ETHIOPIAN_MOBILE_RE.test(compact)) {
    return 'Enter a valid Ethiopian mobile number, for example 0911 00 00 00.';
  }
  return '';
}

export function validateEmail(value: string, required = true) {
  const trimmed = value.trim();
  if (!trimmed && !required) {
    return '';
  }
  if (!EMAIL_RE.test(trimmed)) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function validateFullName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Enter your full name.';
  }
  if (!NAME_RE.test(trimmed) || /\d/.test(trimmed)) {
    return 'Full name can only contain letters, spaces, apostrophes, hyphens, and periods.';
  }
  if (trimmed.split(' ').filter(Boolean).length < 2) {
    return 'Enter first and last name.';
  }
  return '';
}

export function validatePassword(value: string) {
  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return '';
}
