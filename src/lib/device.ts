import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

const DEVICE_COOKIE_NAME = "nmms_device_lock";
const BRTE_DEVICE_COOKIE_NAME = "nmms_brte_device_lock";

// We want the cookie to expire at midnight of the local timezone (IST, typically)
// For simplicity, we can set it to 24 hours, but ideally it expires at end of day.
// Let's set it to 24 hours.
const MAX_AGE = 60 * 60 * 24;

export async function checkAndSetDeviceLock(udise: string): Promise<{ allowed: boolean; error?: string }> {
  const store = await cookies();
  const existingCookie = store.get(DEVICE_COOKIE_NAME)?.value;
  
  if (existingCookie) {
    // Cookie format: {deviceId}:{udise}
    const [deviceId, boundUdise] = existingCookie.split(":");
    
    if (boundUdise !== udise) {
      // Trying to log in with a different UDISE code on a locked device
      return { 
        allowed: false, 
        error: `This device is already locked to UDISE code (${boundUdise}) today. Only one UDISE code login per device per day is permitted.` 
      };
    }
    
    // Same UDISE code logging in again, allowed
    return { allowed: true };
  }
  
  // First login of the day on this device, lock it to this UDISE code
  const newDeviceId = uuidv4();
  const cookieValue = `${newDeviceId}:${udise}`;
  
  // Lock duration for 16 hours
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

export async function checkAndSetBrteDeviceLock(emisId: string): Promise<{ allowed: boolean; error?: string }> {
  const store = await cookies();
  const existingCookie = store.get(BRTE_DEVICE_COOKIE_NAME)?.value;

  if (existingCookie) {
    // Cookie format: {deviceId}:{emisId}
    const [, boundEmis] = existingCookie.split(":");

    if (boundEmis !== emisId) {
      return {
        allowed: false,
        error: `This device is already locked to BRTE EMIS ID (${boundEmis}) today. Only one BRTE login per device per day is permitted.`,
      };
    }

    // Same EMIS ID logging in again — allowed
    return { allowed: true };
  }

  // First BRTE login of the day on this device
  const newDeviceId = uuidv4();
  const cookieValue = `${newDeviceId}:${emisId}`;

  // Lock duration for 16 hours
  const lockDuration = 60 * 60 * 16;

  store.set(BRTE_DEVICE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: lockDuration,
    path: "/",
  });

  return { allowed: true };
}
