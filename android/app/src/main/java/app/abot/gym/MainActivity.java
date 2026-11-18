package app.abot.gym;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** ABOT is on screen. Read by LiveWorkoutReceiver, which rings the rest-over alarm only when not. */
    static volatile boolean inForeground = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins register before the bridge starts.
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(LiveWorkoutPlugin.class);
        registerPlugin(AppPermissionsPlugin.class);
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(AppIconPlugin.class);
        super.onCreate(savedInstanceState);
        // A full load of a deep route (/permissions/) shows that route, not Home.
        getBridge().setWebViewClient(new RoutePageClient(getBridge()));
        reopenPageAfterRestart(savedInstanceState);
        // The rest timer beeps from a timer, not a tap; the WebView would otherwise mute it.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        // The TikTok and YouTube players run in an iframe from their own site, so their cookies are
        // third-party here, which WebView refuses by default (Chrome does not). Without its cookie
        // the TikTok player shows "Unable to load player".
        CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        openWorkoutIfAsked(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openWorkoutIfAsked(intent);
    }

    /** The page on screen, kept for the case below. */
    private static final String STATE_PAGE = "abot.page";

    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        String url = webView == null ? null : webView.getUrl();
        if (url != null) outState.putString(STATE_PAGE, url);
    }

    /**
     * Android stops ABOT's process while it is in the background, for instance when the lifter turns
     * a permission off in Android's settings, and recreates the activity when they come back. The
     * bridge always starts on Home, so they would lose the page they left (the permissions page,
     * where they had just tapped "Open Android settings"). Reopen it; RoutePageClient serves the
     * route's own page. Only a page of ABOT's own origin, and never on a plain start from the icon
     * (no saved state then).
     */
    private void reopenPageAfterRestart(Bundle savedInstanceState) {
        if (savedInstanceState == null) return;
        String saved = savedInstanceState.getString(STATE_PAGE);
        if (saved == null) return;
        Uri page = Uri.parse(saved);
        Uri app = Uri.parse(getBridge().getAppUrl());
        String path = page.getPath();
        boolean ownOrigin = app.getScheme() != null && app.getScheme().equals(page.getScheme()) && app.getAuthority() != null && app.getAuthority().equals(page.getAuthority());
        if (!ownOrigin || path == null || path.isEmpty() || path.equals("/")) return;
        getBridge().getWebView().loadUrl(saved);
    }

    /** A tap on the workout notification: the app opens the workout page (NativeShell). */
    private void openWorkoutIfAsked(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(LiveWorkoutPlugin.EXTRA_OPEN_WORKOUT, false)) return;
        intent.removeExtra(LiveWorkoutPlugin.EXTRA_OPEN_WORKOUT);
        LiveWorkoutPlugin.dispatch(this, "open");
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
    }

    @Override
    public void onPause() {
        inForeground = false;
        super.onPause();
    }
}
