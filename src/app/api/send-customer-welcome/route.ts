import { sendCustomerWelcome } from "@/lib/email/send-welcome-emails";
import { NextResponse } from "next/server";

/** Internal-only (Edge Function / webhook) — verifies `x-internal-key` matches env. */
export async function POST(req: Request) {
  const internalKey = req.headers.get("x-internal-key");
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected || internalKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { profileId?: string };
  try {
    body = (await req.json()) as { profileId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = body.profileId?.trim();
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  const result = await sendCustomerWelcome(profileId);
  return NextResponse.json(result);
}
