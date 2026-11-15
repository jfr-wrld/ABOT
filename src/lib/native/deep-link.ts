/**
 * A full load of any page but Home in the Android app. Capacitor's local server answers every
 * path without a file extension with the root index.html (html5mode; its native bridge is only
 * injected there), so /permissions/ arrives as Home's page. React then fails to hydrate (#418) and
 * Home stays on screen at the wrong address. Android build only:
 *
 * 1. DEEP_LINK_SCRIPT runs in <head> before React: it parks the real route in sessionStorage and
 *    puts the address back on "/", the page that was actually served, so hydration matches.
 * 2. Once the app is up, DeepLinkRestore opens the parked route with the Next router.
 */

export const DEEP_LINK_KEY = "abot.deep-link";

export const DEEP_LINK_SCRIPT = `try{var p=location.pathname;if(p&&p!=="/"){sessionStorage.setItem("${DEEP_LINK_KEY}",p+location.search+location.hash);history.replaceState(history.state,"","/")}}catch(e){}`;

/** The parked route, once; only a path inside the app ("/x", never "//host" or a full URL). */
export function takeDeepLink(storage: Pick<Storage, "getItem" | "removeItem"> | null): string | null {
  try {
    const to = storage?.getItem(DEEP_LINK_KEY) ?? null;
    if (to === null) return null;
    storage!.removeItem(DEEP_LINK_KEY);
    return to.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : null;
  } catch {
    return null;
  }
}
