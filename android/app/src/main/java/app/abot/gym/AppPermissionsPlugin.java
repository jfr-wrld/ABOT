package app.abot.gym;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Camera (take a profile photo or a story background) and location (pick the gym you are at).
 * Capacitor's own checkPermissions / requestPermissions work from these aliases. This adds the
 * ways into Android settings for an access the lifter turned down for good: ABOT's app page,
 * and its notification page.
 */
@CapacitorPlugin(
    name = "AppPermissions",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }),
    }
)
public class AppPermissionsPlugin extends Plugin {

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        open(call, appDetails());
    }

    /** ABOT's notification page (Android 8+), or its app page on older versions. */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            open(call, i);
        } else {
            open(call, appDetails());
        }
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
    }

    private void open(PluginCall call, Intent intent) {
        Activity activity = getActivity();
        Context from = activity != null ? activity : getContext();
        if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            from.startActivity(intent);
            call.resolve();
        } catch (Exception first) {
            // Some phones lack the notification page: fall back to the app page.
            try {
                Intent fallback = appDetails();
                if (activity == null) fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                from.startActivity(fallback);
                call.resolve();
            } catch (Exception e) {
                call.reject("Android settings could not be opened: " + e.getMessage(), e);
            }
        }
    }
}
