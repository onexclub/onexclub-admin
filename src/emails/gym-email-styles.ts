/**
 * Shared layout tokens for React Email templates under `src/emails/`.
 * Reuse across templates so onboarding / customer / future transactional emails stay visually aligned.
 */

export const body = {
  backgroundColor: "#f4f4f5",
  fontFamily: "Inter, Arial, sans-serif",
  margin: "0",
  padding: "40px 0",
};

export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  overflow: "hidden" as const,
  boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
};

export const header = {
  background: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
  padding: "32px 40px",
  textAlign: "center" as const,
};

export const headerLogo = {
  color: "#ffffff",
  fontSize: "26px",
  fontWeight: 700,
  margin: "0 0 4px",
  letterSpacing: "-0.5px",
};

export const headerTagline = {
  color: "#94a3b8",
  fontSize: "13px",
  margin: 0,
};

export const hero = { padding: "40px 40px 0", textAlign: "center" as const };
export const emoji = { fontSize: "48px", margin: "0 0 8px", display: "block" };
export const h1 = {
  fontSize: "28px",
  color: "#1a1a2e",
  fontWeight: 700,
  margin: "0 0 12px",
  lineHeight: "1.3",
};

export const subtitle = {
  color: "#52525b",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 32px",
};

export const card = {
  margin: "0 40px 32px",
  background: "#f8fafc",
  borderRadius: "12px",
  padding: "24px",
  border: "1px solid #e2e8f0",
};

export const cardLabel = {
  color: "#94a3b8",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.5px",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
};

export const cardValue = {
  color: "#1a1a2e",
  fontSize: "18px",
  fontWeight: 700,
  margin: "0 0 4px",
};

export const cardSub = { color: "#64748b", fontSize: "14px", margin: 0 };
export const cardDivider = { borderColor: "#e2e8f0", margin: "16px 0" };

export const stepsSection = { padding: "0 40px 32px" };

export const stepsTitle = {
  color: "#1a1a2e",
  fontSize: "16px",
  fontWeight: 700,
  margin: "0 0 20px",
};

export const stepRow = { marginBottom: "16px" };
export const stepNumCol = { width: "40px", verticalAlign: "top" as const };
export const stepNum = {
  width: "32px",
  height: "32px",
  backgroundColor: "#eef2ff",
  color: "#6366f1",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 700,
  textAlign: "center" as const,
  lineHeight: "32px",
  margin: 0,
};

export const stepTextCol = { verticalAlign: "top" as const, paddingLeft: "12px" };
export const stepTitle = { color: "#1a1a2e", fontSize: "14px", fontWeight: 600, margin: "4px 0 2px" };
export const stepDesc = { color: "#71717a", fontSize: "13px", margin: 0, lineHeight: "20px" };

export const featureRow = { color: "#374151", fontSize: "14px", lineHeight: "22px", margin: "0 0 12px" };

export const ctaSection = { padding: "0 40px 32px", textAlign: "center" as const };
export const ctaButton = {
  backgroundColor: "#6366f1",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "14px 36px",
  fontSize: "16px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

export const divider = { borderColor: "#e4e4e7", margin: "0" };
export const footer = { padding: "24px 40px", backgroundColor: "#fafafa", textAlign: "center" as const };
export const footerText = { color: "#71717a", fontSize: "13px", margin: "0 0 6px" };
export const footerMuted = { color: "#a1a1aa", fontSize: "11px", margin: 0, lineHeight: "18px" };

export const link = { color: "#6366f1", textDecoration: "none" };
