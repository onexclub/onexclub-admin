/**
 * ONE X CLUB member-facing email palette — matches admin UI (`globals.css`, `BrandLogo`).
 * Reuse in customer transactional templates under `src/emails/`.
 */
export const ONEX_WEBSITE_URL = "https://onexclub.in";

export const colors = {
  primary: "#ea580c",
  primaryHover: "#c2410c",
  primarySoft: "#fff7ed",
  accent: "#f97316",
  ink: "#18181b",
  inkMuted: "#52525b",
  subtle: "#71717a",
  border: "#e4e4e7",
  surface: "#fafafa",
  white: "#ffffff",
};

export const headerGradient = `linear-gradient(135deg, ${colors.ink} 0%, #27272a 100%)`;
export const accentBar = `linear-gradient(90deg, ${colors.primary} 0%, ${colors.accent} 100%)`;
export const planCardGradient = `linear-gradient(135deg, ${colors.ink} 0%, #431407 100%)`;
