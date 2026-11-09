package app.abot.gym;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Runs without the app: the end of a rest (alarm) and the notification's buttons. It redraws the
 * notification straight away, then passes a button to the app so its own state follows.
 */
public class LiveWorkoutReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        LiveState s = LiveState.load(ctx);
        if (s == null || !LiveWorkoutPlugin.isShowing(ctx)) return;
        long now = System.currentTimeMillis();

        if (LiveWorkoutPlugin.ACTION_REST_OVER.equals(intent.getAction())) {
            if (s.paused || s.restEndsAt == 0) return;
            s.restEndsAt = 0;
            s.title = s.overTitle;
            s.text = s.overText;
            s.save(ctx);
            LiveWorkoutPlugin.render(ctx, s);
            // On screen, the page plays its own rest-over beep; ringing here too would double it.
            if (s.ring && !MainActivity.inForeground) LiveWorkoutPlugin.postAlert(ctx, s.overTitle, s.overText);
            return;
        }

        if (!LiveWorkoutPlugin.ACTION_BUTTON.equals(intent.getAction())) return;
        String id = intent.getStringExtra(LiveWorkoutPlugin.EXTRA_ID);
        if (id == null) return;
        switch (id) {
            case "pause":
                if (s.paused) return;
                s.paused = true;
                s.pausedElapsed = now - s.clockStart;
                s.restEndsAt = 0;
                LiveWorkoutPlugin.cancelAlarm(ctx);
                break;
            case "resume":
                if (!s.paused) return;
                s.paused = false;
                s.clockStart = now - s.pausedElapsed;
                break;
            case "skip":
                s.restEndsAt = 0;
                LiveWorkoutPlugin.cancelAlarm(ctx);
                break;
            default:
                return;
        }
        s.save(ctx);
        LiveWorkoutPlugin.render(ctx, s);
        LiveWorkoutPlugin.dispatch(ctx, id);
    }
}
