package app.abot.gym;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
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
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(base), "ABOT");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("The folder could not be created.");
                File file = new File(dir, fileName);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { mimeType }, null);
            }
            JSObject ret = new JSObject();
            ret.put("folder", folder);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "The file could not be saved.", e);
        }
    }
}
