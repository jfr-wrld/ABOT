package app.abot.gym;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins register before the bridge starts.
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(LiveWorkoutPlugin.class);
        registerPlugin(AppPermissionsPlugin.class);
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
        // The rest timer beeps from a timer, not a tap; the WebView would otherwise mute it.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
