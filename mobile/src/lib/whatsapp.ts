/** Digits-only number for WhatsApp (country code, no +). Kept for client-side checks. */
export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    digits = `92${digits.slice(1)}`;
  }

  return digits.length >= 8 ? digits : null;
}
