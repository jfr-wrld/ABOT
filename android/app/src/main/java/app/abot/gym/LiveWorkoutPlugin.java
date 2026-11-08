package app.abot.gym;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout in progress as an ongoing notification while ABOT is in the background: workout
 * name, the next set, and a clock Android keeps ticking on its own (rest counting down, or time
 * since the start). On Android 16 it asks to be a Live Update, which puts the clock in a chip on
 * the status bar. When a rest ends, an alarm swaps the countdown for "rest over" and the workout
 * clock, so the notification stays right with the app frozen.
 */
@CapacitorPlugin(name = "LiveWorkout")
public class LiveWorkoutPlugin extends Plugin {

    static final String CHANNEL = "workout-live";
    static final int NOTIFICATION_ID = 4242;
    private static final int ALARM_REQUEST = 4243;

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_CHIP = "chip";
    static final String EXTRA_STARTED_AT = "startedAt";

    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();
        String title = call.getString("title", "Workout");
        String text = call.getString("text", "");
        long startedAt = call.getLong("startedAt", System.currentTimeMillis());
        Long restEndsAt = call.getLong("restEndsAt");
        cancelAlarm(ctx);
        if (restEndsAt != null && restEndsAt > System.currentTimeMillis()) {
            post(ctx, call.getString("restTitle", title), text, restEndsAt, true, "Rest");
            Bundle after = new Bundle();
            after.putString(EXTRA_TITLE, call.getString("overTitle", title));
            after.putString(EXTRA_TEXT, call.getString("overText", text));
            after.putString(EXTRA_CHIP, "Go");
            after.putLong(EXTRA_STARTED_AT, startedAt);
            scheduleAlarm(ctx, restEndsAt, after);
        } else {
            post(ctx, title, text, startedAt, false, null);
        }
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        cancelAlarm(ctx);
        ctx.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    /** Posts or replaces the ongoing notification. `when` is the clock's anchor. */
    static void post(Context ctx, String title, String text, long when, boolean countDown, String chip) {
        if (Build.VERSION.SDK_INT >= 33
            && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("The workout and your next set while ABOT is in the background.");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_stat_abot)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(when)
            .setUsesChronometer(true)
            .setCategory(Notification.CATEGORY_STOPWATCH)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(ctx));
        if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(countDown);
        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16 Live Update: the clock (or the short label) shows in a status bar chip.
            b.setRequestPromotedOngoing(true);
            if (chip != null) b.setShortCriticalText(chip);
        }
        nm.notify(NOTIFICATION_ID, b.build());
    }

    private static PendingIntent openApp(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) launch = new Intent(ctx, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent alarmIntent(Context ctx, Bundle extras) {
        Intent i = new Intent(ctx, LiveWorkoutReceiver.class);
        if (extras != null) i.putExtras(extras);
        int flags = PendingIntent.FLAG_IMMUTABLE | (extras != null ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(ctx, ALARM_REQUEST, i, flags);
    }

    private static void scheduleAlarm(Context ctx, long at, Bundle extras) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        PendingIntent pi = alarmIntent(ctx, extras);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private static void cancelAlarm(Context ctx) {
        PendingIntent pi = alarmIntent(ctx, null);
        if (pi != null) {
            ctx.getSystemService(AlarmManager.class).cancel(pi);
            pi.cancel();
        }
    }
}
