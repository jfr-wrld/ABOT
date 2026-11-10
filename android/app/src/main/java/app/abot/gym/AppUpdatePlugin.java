package app.abot.gym;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Downloads a newer ABOT APK with Android's own DownloadManager and hands it to the package
 * installer. Opening the APK link in the browser instead left the download to Chrome, which on
 * some phones sat at 100% while it checked the file, with nothing ABOT could see or retry. Here
 * the app follows the download itself (progress, failure) and opens the install screen when it
 * lands. The file goes to the app's own folder, so no storage permission is needed; installing
 * needs "Install unknown apps" for ABOT once, and the settings page for it opens when missing.
 *
 * Security (audit 2026-11-11): only ABOT's own release URL is downloaded, and before the install
 * screen opens the file is copied into the app's private storage (no other app can swap it) and
 * checked: it must be this app's package, signed by the same key as the installed app, and a
 * newer version. Anything else is refused, whatever the JavaScript side asked for.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String FILE = "abot-update.apk";
    private static final String APK_TYPE = "application/vnd.android.package-archive";
    /** ABOT's release assets, and nothing else. */
    private static final Pattern RELEASE_URL =
        Pattern.compile("^https://github\\.com/jfr-wrld/ABOT/releases/download/abot-\\d+/[A-Za-z0-9._-]+\\.apk$");

    private File apkFile() {
        return new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), FILE);
    }

    private DownloadManager manager() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        // Only ABOT's own releases: the URL comes from the GitHub API answer.
        if (url == null || !RELEASE_URL.matcher(url).matches() || url.contains("..")) {
            call.reject("Not a GitHub release download.", "BAD_URL");
            return;
        }
        File out = apkFile();
        if (out.exists() && !out.delete()) {
            call.reject("The previous download could not be removed.", "CLEANUP");
            return;
        }
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setTitle(call.getString("title", "ABOT update"))
                .setMimeType(APK_TYPE)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, FILE);
            long id = manager().enqueue(request);
            JSObject ret = new JSObject();
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("The download could not start: " + e.getMessage(), "START");
        }
    }

    @PluginMethod
    public void progress(PluginCall call) {
        // The id comes back from JavaScript as a plain number, which the bridge parses as an Integer
        // for small values; PluginCall.getLong only accepts a Long, so read any Number.
        Object raw = call.getData().opt("id");
        JSObject ret = new JSObject();
        if (!(raw instanceof Number)) {
            call.reject("No download id.", "BAD_ID");
            return;
        }
        long id = ((Number) raw).longValue();
        try (Cursor c = manager().query(new DownloadManager.Query().setFilterById(id))) {
            if (c == null || !c.moveToFirst()) {
                ret.put("status", "missing");
                ret.put("bytes", 0);
                ret.put("total", -1);
                call.resolve(ret);
                return;
            }
            int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            String name;
            switch (status) {
                case DownloadManager.STATUS_SUCCESSFUL:
                    name = "done";
                    break;
                case DownloadManager.STATUS_FAILED:
                    name = "failed";
                    break;
                case DownloadManager.STATUS_PAUSED:
                    name = "paused";
                    break;
                default:
                    name = "running";
            }
            ret.put("status", name);
            ret.put("bytes", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
            ret.put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
            ret.put("reason", c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the download: " + e.getMessage(), "QUERY");
        }
    }

    /** SHA-256 of each signing certificate. */
    private static Set<String> digests(Signature[] sigs) throws Exception {
        Set<String> out = new HashSet<>();
        if (sigs == null) return out;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature sig : sigs) {
            StringBuilder hex = new StringBuilder();
            for (byte b : md.digest(sig.toByteArray())) hex.append(String.format("%02x", b));
            out.add(hex.toString());
        }
        return out;
    }

    @SuppressWarnings("deprecation")
    private static Signature[] signers(PackageInfo info) {
        if (info == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return null;
            return info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
        }
        return info.signatures;
    }

    @SuppressWarnings("deprecation")
    private static long version(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    /** null when the APK is fit to install over this app; otherwise why not. */
    @SuppressWarnings("deprecation")
    private String refuse(File apk) {
        try {
            PackageManager pm = getContext().getPackageManager();
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo update = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
            PackageInfo self = pm.getPackageInfo(getContext().getPackageName(), flags);
            if (update == null) return "The update file is not a readable app.";
            if (!getContext().getPackageName().equals(update.packageName)) return "The update file is a different app.";
            Set<String> theirs = digests(signers(update));
            Set<String> mine = digests(signers(self));
            // Every key this app is signed with must be in the update's signing history (the same
            // key, or a rotation that still vouches for it).
            if (theirs.isEmpty() || mine.isEmpty() || !theirs.containsAll(mine)) return "The update is not signed by ABOT's key.";
            if (version(update) <= version(self)) return "The update is not newer than this version.";
            return null;
        } catch (Exception e) {
            return "The update file could not be checked: " + e.getMessage();
        }
    }

    /** Copies the download into private storage, where no other app can change it. */
    private File privateCopy(File from) throws Exception {
        File dir = new File(getContext().getFilesDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("No room for the update.");
        File to = new File(dir, FILE);
        try (InputStream in = new FileInputStream(from); OutputStream out = new FileOutputStream(to)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        return to;
    }

    @PluginMethod
    public void install(PluginCall call) {
        File downloaded = apkFile();
        if (!downloaded.exists() || downloaded.length() == 0) {
            call.reject("The update file is not there. Download it again.", "MISSING");
            return;
        }
        File apk;
        try {
            apk = privateCopy(downloaded);
        } catch (Exception e) {
            call.reject("The update could not be prepared: " + e.getMessage(), "COPY");
            return;
        }
        String why = refuse(apk);
        if (why != null) {
            apk.delete();
            downloaded.delete();
            call.reject(why, "UNTRUSTED");
            return;
        }
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            // Android asks once per app: open ABOT's "Install unknown apps" switch.
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_TYPE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("needsPermission", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("The install screen could not open: " + e.getMessage(), "INSTALL");
        }
    }
}
