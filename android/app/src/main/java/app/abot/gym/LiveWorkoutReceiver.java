package app.abot.gym;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Rest is over: the live notification switches from the countdown to the workout clock. */
public class LiveWorkoutReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        // Only update a notification that is still up; the workout may have ended meanwhile.
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        boolean shown = false;
        for (android.service.notification.StatusBarNotification n : nm.getActiveNotifications()) {
            if (n.getId() == LiveWorkoutPlugin.NOTIFICATION_ID) shown = true;
        }
        if (!shown) return;
        LiveWorkoutPlugin.post(
            ctx,
            intent.getStringExtra(LiveWorkoutPlugin.EXTRA_TITLE),
            intent.getStringExtra(LiveWorkoutPlugin.EXTRA_TEXT),
            intent.getLongExtra(LiveWorkoutPlugin.EXTRA_STARTED_AT, System.currentTimeMillis()),
            false,
            intent.getStringExtra(LiveWorkoutPlugin.EXTRA_CHIP)
        );
    }
}
