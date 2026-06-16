/**
 * Client-safe constants for working-branch selection.
 *
 * **Reuse:** server session helpers (`active-branch-session.ts`), choose-branch UI,
 * and header switcher — keep cookie name + sentinel in sync everywhere.
 */
export const ACTIVE_BRANCH_COOKIE = "onex_active_outlet_id";

/** Cookie value when the gym admin works across all managed branches. */
export const ACTIVE_BRANCH_ALL = "__all__";
