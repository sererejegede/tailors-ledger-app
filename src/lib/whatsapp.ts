/**
 * WhatsApp needs the number in international form, digits only (wa.me/2348035550142).
 * Phones are stored as the tailor typed them, so a local Nigerian number ("0803 555 0142")
 * gets +234 in place of its leading 0. Numbers already written with + or 00 keep their own
 * country code. Anything else can't be dialled abroad, so there's no link for it.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const trimmed = (phone ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let intl: string | null = null;
  if (trimmed.startsWith('+')) intl = digits;
  else if (digits.startsWith('00')) intl = digits.slice(2);
  else if (digits.startsWith('234') && digits.length === 13) intl = digits;
  else if (digits.startsWith('0') && digits.length === 11) intl = `234${digits.slice(1)}`;
  else if (/^[789]/.test(digits) && digits.length === 10) intl = `234${digits}`;

  // E.164 numbers are at most 15 digits; a few short ones are still real.
  return intl && intl.length >= 8 && intl.length <= 15 ? intl : null;
}

/** The chat link for a client's phone, or null when the number can't be used. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}` : null;
}
