import { create } from "zustand";
import { parsePublicKey, verifyLicense, type VerifiedLicense } from "@/lib/license-token";

/**
 * The verified licence, in memory only: it is worked out again from the stored token on every
 * start, so editing storage cannot plant a "verified" result. resolveEntitlement reads it.
 */
interface LicenseState {
  license: VerifiedLicense | null;
  /** The token the result above belongs to. */
  token: string | null;
}

export const useLicense = create<LicenseState>()(() => ({ license: null, token: null }));

const PUBLIC_KEY = parsePublicKey(process.env.NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY);

/** Checks the stored token against the built-in public key and keeps the result. */
export async function verifyStoredLicense(token: string | null | undefined, now = Date.now()): Promise<void> {
  const t = token ?? null;
  if (useLicense.getState().token === t && t !== null) return;
  const license = t && PUBLIC_KEY ? await verifyLicense(t, PUBLIC_KEY, now) : null;
  useLicense.setState({ license, token: t });
}
