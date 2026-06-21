/**
 * Filters internal catalogue/seed copy from member-facing plan UI.
 *
 * **Reuse:** Program cards, plan detail modal — not for admin template editing.
 * DB descriptions may stay verbose for moderators; UI hides them here.
 */

const INTERNAL_UI_TEXT =
  /north\s*india|punjab|delhi\s*ncr|himachal|haryana|eggetarian day|anda in breakfast|catalogue|seed helper|pending trainer review|placeholder while|trainer is preparing|home-style anda|staple delhi|gym-friendly|moderator|reuse for catalogue/i;

/** Returns null when text is internal boilerplate — safe to omit from cards/modals. */
export function textForPlanUi(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (INTERNAL_UI_TEXT.test(trimmed)) return null;
  return trimmed;
}

/** Plan template blurb under the title — often null for auto-seeded templates. */
export function formatPlanDescriptionForDisplay(description: string | null | undefined): string | null {
  return textForPlanUi(description);
}
