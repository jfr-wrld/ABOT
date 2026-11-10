#!/usr/bin/env bash
# Makes ABOT's private release key, once, on your own computer. Never commit the .jks file.
#
#   bash scripts/make-release-keystore.sh
#
# It asks for a password, writes ~/abot-release/abot-release.jks, and prints the four values to
# add as secrets of the "release" environment in GitHub (Settings > Environments > release):
# ABOT_KEYSTORE_B64, ABOT_KEYSTORE_PASSWORD, ABOT_KEY_ALIAS, ABOT_KEY_PASSWORD.
# Keep a copy of the .jks and the password somewhere safe (a password manager): a lost key means
# no more updates for installed apps; a leaked key lets someone else publish "updates".
set -euo pipefail
command -v keytool >/dev/null || { echo "keytool not found: install a JDK (17 or newer)." >&2; exit 1; }
DIR="$HOME/abot-release"
KS="$DIR/abot-release.jks"
ALIAS="abot"
mkdir -p "$DIR"
chmod 700 "$DIR"
if [ -e "$KS" ]; then echo "$KS already exists; not overwriting it." >&2; exit 1; fi
read -r -s -p "Password for the release key (at least 12 characters): " PASS; echo
[ "${#PASS}" -ge 12 ] || { echo "Too short." >&2; exit 1; }
keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 4096 \
  -validity 10000 -storepass "$PASS" -keypass "$PASS" -dname "CN=ABOT, O=ABOT"
chmod 600 "$KS"
echo
echo "Add these to GitHub > Settings > Environments > release > Environment secrets:"
echo "  ABOT_KEY_ALIAS          = $ALIAS"
echo "  ABOT_KEYSTORE_PASSWORD  = (the password you just typed)"
echo "  ABOT_KEY_PASSWORD       = (the same password)"
echo "  ABOT_KEYSTORE_B64       = the contents of $DIR/abot-release.jks.b64 (written now)"
base64 < "$KS" | tr -d '\n' > "$DIR/abot-release.jks.b64"
chmod 600 "$DIR/abot-release.jks.b64"
echo
echo "Certificate SHA-256 (the fingerprint of every genuine ABOT release):"
keytool -list -v -keystore "$KS" -storepass "$PASS" -alias "$ALIAS" | grep -i "SHA256"
echo
echo "Delete $DIR/abot-release.jks.b64 once the secret is saved."
