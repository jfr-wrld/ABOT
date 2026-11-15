#!/usr/bin/env node
// Prints a new ES256 key pair for ABOT's signed licences. Nothing is written to disk.
//   private half -> Supabase secret LICENSE_PRIVATE_JWK (never commit it, never put it in the app)
//   public half  -> NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY on Vercel and in the repo's Actions variables
// A new pair makes every licence issued with the old one stop working until the app is online.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = await crypto.subtle.exportKey("jwk", publicKey);
const priv = await crypto.subtle.exportKey("jwk", privateKey);
const strip = (k) => { const out = { ...k }; delete out.key_ops; delete out.ext; return out; };
console.log("Private key (Supabase secret):\n");
console.log(`supabase secrets set LICENSE_PRIVATE_JWK='${JSON.stringify(strip(priv))}'\n`);
console.log("Public key (NEXT_PUBLIC_ABOT_LICENSE_PUBLIC_KEY):\n");
console.log(JSON.stringify(strip(pub)));
