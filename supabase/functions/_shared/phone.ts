export function normalizePhone(phoneNumber: string) {
  return phoneNumber.replace(/\s+/g, '').replace(/^\+251/, '0');
}

export function toE164(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  if (normalized.startsWith('09')) {
    return `+251${normalized.slice(1)}`;
  }
  if (normalized.startsWith('9')) {
    return `+251${normalized}`;
  }
  if (normalized.startsWith('+251')) {
    return normalized;
  }
  throw new Error('Phone number must be a valid Ethiopian mobile number.');
}
