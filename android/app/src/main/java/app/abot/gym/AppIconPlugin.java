package app.abot.gym;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Switches the launcher icon (Settings > Appearance > App icon). Each icon is an activity-alias
 * of MainActivity in AndroidManifest.xml (.Launcher<Id>); exactly one is enabled. Some launchers
 * close the app once while they redraw the icon; that is Android's behaviour, not a crash.
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    /** The ids in src/data/app-icons.json; Classic first, the manifest's default. */
    static final String[] IDS = { "classic", "inverse", "night", "paper", "ocean", "ember" };

    private ComponentName alias(String id) {
        String pkg = getContext().getPackageName();
        return new ComponentName(pkg, pkg + ".Launcher" + Character.toUpperCase(id.charAt(0)) + id.substring(1));
    }

    /** The icon whose alias is enabled now ("classic" when none was ever changed). */
    private String current() {
        PackageManager pm = getContext().getPackageManager();
        for (String id : IDS) {
            int state = pm.getComponentEnabledSetting(alias(id));
            boolean on = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && id.equals("classic"));
            if (on) return id;
        }
        return "classic";
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        JSObject out = new JSObject();
        out.put("id", current());
        call.resolve(out);
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String id = call.getString("id", "classic");
        boolean known = false;
        for (String k : IDS) known |= k.equals(id);
        if (!known) {
            call.reject("Unknown app icon", "UNKNOWN");
            return;
        }
        if (id.equals(current())) {
            JSObject out = new JSObject();
            out.put("id", id);
            out.put("changed", false);
            call.resolve(out);
            return;
        }
        PackageManager pm = getContext().getPackageManager();
        // The new one first, so there is never a moment with no launcher entry at all.
        pm.setComponentEnabledSetting(alias(id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String other : IDS) {
            if (!other.equals(id)) {
                pm.setComponentEnabledSetting(alias(other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        }
        JSObject out = new JSObject();
        out.put("id", id);
        out.put("changed", true);
        call.resolve(out);
    }
}
