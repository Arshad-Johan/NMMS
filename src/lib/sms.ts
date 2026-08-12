/**
 * Production SMS Dispatcher for NMMS Portal OTPs
 */
export async function sendSmsOtp(mobile: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const cleanedMobile = mobile.replace(/\D/g, "").slice(-10);

  // 1. Check configured SMS Provider in environment
  const provider = process.env.SMS_PROVIDER?.toLowerCase() || "dev";

  console.log(`[SMS DISPATCH] Sending OTP ${otp} to +91 ${cleanedMobile} via provider [${provider}]`);

  try {
    // A. Fast2SMS Integration (Quick SMS Route bypasses website verification requirement)
    if (provider === "fast2sms" && process.env.FAST2SMS_API_KEY) {
      const apiKey = process.env.FAST2SMS_API_KEY.trim();
      const messageText = `Your NMMS Portal verification code is ${otp}. Valid for 10 minutes.`;
      const message = encodeURIComponent(messageText);
      const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${message}&language=english&flash=0&numbers=${cleanedMobile}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const data = await response.json().catch(() => ({}));
      console.log(`\n================ FAST2SMS GATEWAY RESPONSE ================`);
      console.log(`HTTP Status:`, response.status);
      console.log(`Response Body:`, JSON.stringify(data, null, 2));
      console.log(`===========================================================\n`);

      if (data.return === true || data.status_code === 200) {
        return { success: true };
      }
      const errMsg = Array.isArray(data.message) ? data.message.join(", ") : (data.message || "Fast2SMS dispatch failed");
      return { success: false, error: errMsg };
    }

    // B. MSG91 Integration (Official DLT Compliant SMS Gateway for India)
    if (provider === "msg91" && process.env.MSG91_AUTH_KEY) {
      const authKey = process.env.MSG91_AUTH_KEY.trim();
      const templateId = (process.env.MSG91_TEMPLATE_ID || "").trim();
      const senderId = process.env.MSG91_SENDER_ID?.trim();
      const useFlowApi = process.env.MSG91_API_TYPE === "flow";

      let response: Response;
      let data: any;

      if (useFlowApi) {
        response = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            authkey: authKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: templateId,
            short_url: "0",
            recipients: [
              {
                mobiles: `91${cleanedMobile}`,
                otp: otp,
                VAR1: otp,
                code: otp,
              },
            ],
          }),
        });
      } else {
        const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=91${cleanedMobile}&authkey=${authKey}&otp=${otp}${senderId ? `&sender=${senderId}` : ""}`;

        response = await fetch(url, {
          method: "POST",
          headers: {
            authkey: authKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            otp: otp,
            template_id: templateId,
            mobile: `91${cleanedMobile}`,
          }),
        });
      }

      data = await response.json().catch(() => ({}));
      console.log(`\n================ MSG91 GATEWAY RESPONSE ================`);
      console.log(`HTTP Status:`, response.status);
      console.log(`Response Body:`, JSON.stringify(data, null, 2));
      console.log(`========================================================\n`);

      if (data.type === "success" || response.ok) {
        return { success: true };
      }
      return { success: false, error: data.message || "MSG91 dispatch failed" };
    }

    // C. Twilio Integration
    if (provider === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const bodyParams = new URLSearchParams({
        To: `+91${cleanedMobile}`,
        From: fromPhone || "",
        Body: `Your NMMS Portal verification code is ${otp}. Valid for 10 minutes.`,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );

      const data = await response.json();
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: data.message || "Twilio dispatch failed" };
    }

    // D. 2Factor.in Integration
    if (provider === "2factor" && process.env.TWOFACTOR_API_KEY) {
      const apiKey = process.env.TWOFACTOR_API_KEY;
      const response = await fetch(
        `https://2factor.in/API/V1/${apiKey}/SMS/+91${cleanedMobile}/${otp}/NMMS_OTP`,
        { method: "GET" }
      );
      const data = await response.json();
      if (data.Status === "Success") {
        return { success: true };
      }
      return { success: false, error: data.Details || "2Factor dispatch failed" };
    }

    // Default / Dev / Fallback Console Logging
    console.log(`\n======================================================`);
    console.log(`[SMS SENT VIA PROVIDER: ${provider}] To: +91 ${cleanedMobile} | Code: ${otp}`);
    console.log(`======================================================\n`);

    return { success: true };
  } catch (err: any) {
    console.error("[SMS DISPATCH ERROR]", err);
    return { success: false, error: err.message || "Failed to connect to SMS gateway" };
  }
}
