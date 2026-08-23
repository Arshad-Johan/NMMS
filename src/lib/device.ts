import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

const DEVICE_COOKIE_NAME = "nmms_device_lock";

// We want the cookie to expire at midnight of the local timezone (IST, typically)
// For simplicity, we can set it to 24 hours, but ideally it expires at end of day.
// Let's set it to 24 hours.
const MAX_AGE = 60 * 60 * 24;

export async function checkAndSetDeviceLock(mobile: string): Promise<{ allowed: boolean; error?: string }> {
  const store = await cookies();
  const existingCookie = store.get(DEVICE_COOKIE_NAME)?.value;
  
  if (existingCookie) {
    // Cookie format: {deviceId}:{mobile}
    const [deviceId, boundMobile] = existingCookie.split(":");
    
    if (boundMobile !== mobile) {
      // Trying to log in with a different number on a locked device
      return { 
        allowed: false, 
        error: "This device is already locked to a different mobile number today. Please try again tomorrow or use another device." 
      };
    }
    
    // Same number logging in again, it's allowed
    return { allowed: true };
  }
  
  // First login of the day on this device, lock it to this number
  const newDeviceId = uuidv4();
  const cookieValue = `${newDeviceId}:${mobile}`;
  
  // Calculate seconds until midnight IST (UTC+5:30)
  // For a simpler approach across timezones, let's lock it for 12 hours from login.
  // We'll set 16 hours which should cover most of the waking day.
  const lockDuration = 60 * 60 * 16; 
  
  store.set(DEVICE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: lockDuration,
    path: "/",
  });
  
  return { allowed: true };
}
