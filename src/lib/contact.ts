export const SUPPORT_PHONE = "5491165942709";
export const DATA_CONTROLLER = "Anamaria Quiroga Fernández";
export const LEGAL_VERSION = "2026-09-28";

export function normalizeWhatsApp(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function whatsappUrl(phone: string, message: string): string | null {
  const digits = normalizeWhatsApp(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export const SUPPORT_URL = whatsappUrl(SUPPORT_PHONE, "Hola, necesito ayuda con Padel ID.")!;
