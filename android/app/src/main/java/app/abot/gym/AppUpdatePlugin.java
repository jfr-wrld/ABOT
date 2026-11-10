package app.abot.gym;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
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

/**
 * Downloads a newer ABOT APK with Android's own DownloadManager and hands it to the package
 * installer. Opening the APK link in the browser instead left the download to Chrome, which on
 * some phones sat at 100% while it checked the file, with nothing ABOT could see or retry. Here
 * the app follows the download itself (progress, failure) and opens the install screen when it
 * lands. The file goes to the app's own folder, so no storage permission is needed; installing
 * needs "Install unknown apps" for ABOT once, and the settings page for it opens when missing.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String FILE = "abot-update.apk";
    private static final String APK_TYPE = "application/vnd.android.package-archive";

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
        if (url == null || !url.startsWith("https://github.com/")) {
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
        Long id = call.getLong("id");
        JSObject ret = new JSObject();
        if (id == null) {
            call.reject("No download id.", "BAD_ID");
            return;
        }
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

    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFile();
        if (!apk.exists() || apk.length() == 0) {
            call.reject("The update file is not there. Download it again.", "MISSING");
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
