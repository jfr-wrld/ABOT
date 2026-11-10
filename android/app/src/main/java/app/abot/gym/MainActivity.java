package app.abot.gym;

import android.content.Intent;
import android.os.Bundle;
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
        super.onCreate(savedInstanceState);
        // The rest timer beeps from a timer, not a tap; the WebView would otherwise mute it.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        openWorkoutIfAsked(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openWorkoutIfAsked(intent);
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
