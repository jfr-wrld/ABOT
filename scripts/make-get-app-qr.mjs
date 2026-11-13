// Writes public/get-app-qr.svg: a QR code for the stable Android download link, shown on desktop
// in the "Get the app" sheet. Made once here so the app ships a plain SVG and calls nothing.
// Run again only if the link changes: node scripts/make-get-app-qr.mjs
import { writeFileSync } from "node:fs";
import QRCode from "qrcode";

const LINK = "https://github.com/jfr-wrld/ABOT/releases/latest/download/abot.apk";
const svg = await QRCode.toString(LINK, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#09090b", light: "#ffffff" } });
writeFileSync(new URL("../public/get-app-qr.svg", import.meta.url), svg);
console.log("public/get-app-qr.svg for", LINK);
