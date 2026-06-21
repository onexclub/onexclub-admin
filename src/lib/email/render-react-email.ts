import { render } from "@react-email/render";
import type { ReactNode } from "react";

/**
 * Renders React Email templates to HTML before Resend send.
 *
 * Resend's `react:` prop dynamically requires `@react-email/render`, which often fails
 * in Next.js server bundles — we render explicitly and pass `html` instead.
 *
 * **Reuse:** {@link ../send-welcome-emails.ts} and any future React Email + Resend sender.
 */
export async function renderReactEmail(element: ReactNode): Promise<string> {
  return render(element);
}
