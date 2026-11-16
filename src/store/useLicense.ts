import { create } from "zustand";
import { licenseFor, parsePublicKey, verifyLicense, type VerifiedLicense } from "@/lib/license-token";

/**
 * The verified licence, in memory only: it is worked out again from the stored token on every
 * start, so editing storage cannot plant a "verified" result. resolveEntitlement reads it.
 */
interface LicenseState {
  verified: VerifiedLicense | null;
  /** The token the result above belongs to. */
  token: string | null;
  /** The account signed in on this device, once a sync has seen it; null when unknown or signed out. */
  userId: string | null;
}

export const useLicense = create<LicenseState>()(() => ({ verified: null, token: null, userId: null }));

/** The licence that opens PRO: verified, and for the account signed in here (if any). */
export const selectLicense = (s: LicenseState) => licenseFor(s.verified, s.userId);

const PUBLIC_KEY = parsePublicKey(process.env.NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY);

let latest = 0;

const CLOCK_KEY = "abot.clock-hw";

/**
 * The latest time this device has seen. A licence expires against it, so turning the phone's
 * clock back does not keep an expired token alive offline.
 */
function seenNow(now: number): number {
  try {
    const seen = Number(localStorage.getItem(CLOCK_KEY) ?? 0);
    const at = Math.max(now, Number.isFinite(seen) ? seen : 0);
    if (at > seen) localStorage.setItem(CLOCK_KEY, String(at));
    return at;
  } catch {
    return now;
  }
}

/** Checks the stored token against the built-in public key and keeps the result. */
export async function verifyStoredLicense(token: string | null | undefined, now = Date.now()): Promise<void> {
  const t = token ?? null;
  const s = useLicense.getState();
  // A token already verified stays verified; a refused one is checked again (the clock may be fixed).
  if (s.token === t && s.verified !== null) return;
  const call = ++latest;
  const verified = t && PUBLIC_KEY ? await verifyLicense(t, PUBLIC_KEY, seenNow(now)) : null;
  // A slower, older check never overwrites a newer one.
  if (call === latest) useLicense.setState({ verified, token: t });
}

/** Called by the account sync with the signed-in user, or null after signing out. */
export function bindLicenseUser(userId: string | null): void {
  if (useLicense.getState().userId !== userId) useLicense.setState({ userId });
}
