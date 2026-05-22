/**
 * verify-otp — checks the user-entered code against MSG91 for `phone` (E.164).
 * Pair with `send-otp`; both use `../_shared/msg91.ts`.
 */
import { errorMessage, jsonResponse } from "../_shared/http.ts";
import { msg91VerifyOtp, toMsg91Mobile } from "../_shared/msg91.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || typeof phone !== "string") {
      return jsonResponse(
        { success: false, message: "Phone number required" },
        400,
      );
    }

    const otpStr = otp != null ? String(otp).trim() : "";
    if (!/^\d{4,8}$/.test(otpStr)) {
      return jsonResponse(
        { success: false, message: "Valid OTP code required" },
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

    const { ok, status, data } = await msg91VerifyOtp(mobile, otpStr);

    // MSG91 returns type "success" when the code matches.
    const verified =
      ok &&
      (data?.type === "success" ||
        data?.message === "OTP verified success" ||
        data?.message === "OTP verified successfully");

    if (!verified) {
      return jsonResponse(
        {
          success: false,
          verified: false,
          message: "Invalid or expired OTP",
          msg91: data,
        },
        status >= 400 ? status : 400,
      );
    }

    return jsonResponse({
      success: true,
      verified: true,
      msg91: data,
    });
  } catch (error) {
    return jsonResponse(
      { success: false, error: errorMessage(error) },
      500,
    );
  }
});
