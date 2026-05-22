/**
 * Central registry label for transactional mail + optional audit row (`email_logs` — see migration
 * `021_email_logs.sql`). When you add e.g. `staff_invite`, extend this union and add a sender in
 * `send-welcome-emails.ts` or a sibling module under `src/lib/email/`.
 */
export type TransactionalEmailPurpose =
  | "gym_owner_welcome"
  | "customer_welcome";
