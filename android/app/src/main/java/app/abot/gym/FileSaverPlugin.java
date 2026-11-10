package app.abot.gym;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Saves a file the user asked to download: images to Pictures/ABOT (so they show in the gallery),
 * anything else to Download/ABOT. The WebView cannot follow a download link, so the web layer
 * sends the bytes here. Android 10+ needs no permission; older versions ask for storage once.
 */
@CapacitorPlugin(
    name = "FileSaver",
    permissions = { @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }) }
)
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        write(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            write(call);
        } else {
            call.reject("Storage permission was denied.", "PERMISSION_DENIED");
        }
    }

    private void write(PluginCall call) {
        String data = call.getString("data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (data == null || fileName == null) {
            call.reject("data and fileName are required.");
            return;
        }
        boolean image = mimeType.startsWith("image/");
        String base = image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS;
        String folder = base + "/ABOT";
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        Uri saved;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri collection = image
                    ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri uri = resolver.insert(collection, values);
                if (uri == null) throw new IOException("The file could not be created.");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IOException("The file could not be opened.");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                saved = uri;
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(base), "ABOT");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("The folder could not be created.");
                File file = new File(dir, fileName);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { mimeType }, null);
                saved = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            }
            JSObject ret = new JSObject();
            ret.put("folder", folder);
            ret.put("uri", saved.toString());
            call.resolve(ret);
        } catch (IOException | RuntimeException e) {
            // RuntimeException: MediaStore refuses an insert with IllegalArgument/Security errors.
            call.reject(e.getMessage() != null ? e.getMessage() : "The file could not be saved.", e);
        }
    }

    /** Opens a saved file in the app that handles it (the gallery for a PNG). */
    @PluginMethod
    public void open(PluginCall call) {
        String uri = call.getString("uri");
        String mimeType = call.getString("mimeType", "*/*");
        if (uri == null) {
            call.reject("uri is required.");
            return;
        }
        // Only a file this plugin saved: a MediaStore entry, or ABOT's own Pictures/ABOT and
        // Download/ABOT folders through the FileProvider. Any other content:// URI would be handed
        // to another app with read access granted.
        Uri parsed = Uri.parse(uri);
        String auth = parsed.getAuthority();
        String path = parsed.getPath() == null ? "" : parsed.getPath();
        boolean ours = "content".equals(parsed.getScheme())
            && ("media".equals(auth)
                || ((getContext().getPackageName() + ".fileprovider").equals(auth)
                    && (path.startsWith("/abot_pictures/") || path.startsWith("/abot_downloads/"))
                    && !path.contains("..")));
        if (!ours) {
            call.reject("Not a file ABOT saved.", "BAD_URI");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(parsed, mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No app on this phone can open it.", e);
        }
    }
}
