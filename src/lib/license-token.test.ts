import { describe, expect, it } from "vitest";
import { licensePayload, signLicense } from "../../supabase/functions/_shared/license";
import { parsePublicKey, verifyLicense } from "./license-token";

async function keyPair() {
  const k = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { priv: await crypto.subtle.exportKey("jwk", k.privateKey), pub: await crypto.subtle.exportKey("jwk", k.publicKey) };
}

const NOW = Date.parse("2026-11-15T00:00:00Z");
const nowSec = NOW / 1000;

describe("licence tokens", () => {
  it("builds the payload from the account row", () => {
    expect(licensePayload({ tier: "lifetime", pro_expires_at: null }, "u1", nowSec)).toEqual({ v: 1, sub: "u1", tier: "lifetime", pro_until: null, iat: nowSec, exp: nowSec + 2592000 });
    expect(licensePayload({ tier: "pro", pro_expires_at: "2027-01-01T00:00:00Z" }, "u1", nowSec).pro_until).toBe("2027-01-01T00:00:00Z");
    expect(licensePayload(null, "u1", nowSec).tier).toBe("free");
    expect(licensePayload({ tier: "weird", pro_expires_at: null }, "u1", nowSec).tier).toBe("free");
  });

  it("verifies its own signature and refuses edits, other keys and junk", async () => {
    const a = await keyPair();
    const b = await keyPair();
    const token = await signLicense(licensePayload({ tier: "lifetime", pro_expires_at: null }, "u1", nowSec), a.priv);
    expect(await verifyLicense(token, a.pub, NOW)).toEqual({ sub: "u1", tier: "lifetime", proUntil: null, exp: (nowSec + 2592000) * 1000 });
    expect(await verifyLicense(token, b.pub, NOW)).toBeNull();
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, sub: "u2", tier: "lifetime", pro_until: null, iat: nowSec, exp: nowSec + 9e9 })).toString("base64url");
    expect(await verifyLicense(`${h}.${forged}.${s}`, a.pub, NOW)).toBeNull();
    for (const junk of ["", "a.b", "a.b.c", "....", `${h}.${forged}`]) expect(await verifyLicense(junk, a.pub, NOW)).toBeNull();
  });

  it("refuses an expired token, a token from the future, and another algorithm or type", async () => {
    const a = await keyPair();
    const token = await signLicense(licensePayload({ tier: "lifetime", pro_expires_at: null }, "u1", nowSec), a.priv);
    expect(await verifyLicense(token, a.pub, NOW + 2592000 * 1000)).toBeNull();
    expect(await verifyLicense(token, a.pub, NOW - 11 * 60 * 1000)).toBeNull();
    expect(await verifyLicense(token, a.pub, NOW - 5 * 60 * 1000)).not.toBeNull();
    const [, p, s] = token.split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "ABOT-LICENSE" })).toString("base64url");
    expect(await verifyLicense(`${none}.${p}.${s}`, a.pub, NOW)).toBeNull();
  });

  it("reads the public key from the build variable", async () => {
    const { pub } = await keyPair();
    expect(parsePublicKey(JSON.stringify(pub))).toMatchObject({ kty: "EC", crv: "P-256" });
    expect(parsePublicKey(undefined)).toBeNull();
    expect(parsePublicKey("not json")).toBeNull();
    expect(parsePublicKey(JSON.stringify({ kty: "RSA" }))).toBeNull();
    expect(parsePublicKey(JSON.stringify({ ...pub, d: "secret" }))).toBeNull();
  });
});
