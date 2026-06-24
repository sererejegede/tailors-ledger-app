export function formatPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+234') && digits.startsWith('234') && digits.length === 13) {
    const nationalNumber = digits.slice(3);
    return `+234 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  }

  const isNG =
    digits.startsWith('080') ||
    digits.startsWith('090') ||
    digits.startsWith('070') ||
    digits.startsWith('081');
  if (isNG && digits.length === 11) {
    // +234 802 345 6789 or 0802 345 6789
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return phone;
}