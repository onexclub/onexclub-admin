/**
 * send-otp — triggers MSG91 to deliver a 6-digit OTP to `phone` (E.164).
 * Uses built-in Deno.serve (no deno.land/std import — fixes IDE "Cannot find module" errors).
 *
 * Reused helpers: `../_shared/http.ts`, `../_shared/msg91.ts`
 */
import { errorMessage, jsonResponse } from "../_shared/http.ts";
import { msg91SendOtp, toMsg91Mobile } from "../_shared/msg91.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return jsonResponse(
        { success: false, message: "Phone number required" },
        400,
      );
    }

    const mobile = toMsg91Mobile(phone);
    if (mobile.length < 10) {
      return jsonResponse(
        { success: false, message: "Invalid phone number" },
        400,
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const { ok, status, data } = await msg91SendOtp(mobile, otp);

    if (!ok) {
      return jsonResponse(
        {
          success: false,
          message: "Failed to send OTP",
          msg91: data,
        },
        status >= 400 ? status : 502,
      );
    }

    return jsonResponse({
      success: true,
      otpSent: true,
      msg91: data,
    });
  } catch (error) {
    return jsonResponse(
      { success: false, error: errorMessage(error) },
      500,
    );
  }
});
