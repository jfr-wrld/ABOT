package app.abot.gym;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;

/**
 * Serves each exported route's own page on a full load (a reload, an in-app update, location.assign).
 *
 * Capacitor's local server (html5mode) answers every path without a "." with the root index.html, so
 * /permissions/ got Home's HTML and RSC payload: React threw hydration error #418 and Home stayed on screen.
 * The static export (trailingSlash) writes public/permissions/index.html, so a main-frame load of an app
 * page is answered with that file when it exists. Everything else, and any route without one, goes to
 * Capacitor as before.
 */
class RoutePageClient extends BridgeWebViewClient {

    private final Bridge bridge;

    RoutePageClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse page = routePage(request);
        return page != null ? page : super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse routePage(WebResourceRequest request) {
        if (!request.isForMainFrame() || !"GET".equals(request.getMethod())) return null;
        Uri url = request.getUrl();
        Uri app = Uri.parse(bridge.getAppUrl());
        if (!equal(url.getScheme(), app.getScheme()) || !equal(url.getAuthority(), app.getAuthority())) return null;

        String path = url.getPath();
        if (path == null) return null;
        while (path.endsWith("/")) path = path.substring(0, path.length() - 1);
        // "/" is Home, which Capacitor already serves; a last segment with a "." is a file.
        if (path.isEmpty() || path.substring(path.lastIndexOf('/') + 1).contains(".") || path.contains("..")) return null;

        // Bundled assets only; a server path set at runtime (live update) keeps Capacitor's handling.
        String base = bridge.getLocalServer().getBasePath();
        if (!Bridge.DEFAULT_WEB_ASSET_DIR.equals(base)) return null;

        InputStream html;
        try {
            html = bridge.getContext().getAssets().open(base + path + "/index.html");
        } catch (IOException notARoute) {
            return null;
        }
        return new WebResourceResponse("text/html", "utf-8", bridge.getLocalServer().getJavaScriptInjectedStream(html));
    }

    private static boolean equal(String a, String b) {
        return a != null && a.equalsIgnoreCase(b);
    }
}
