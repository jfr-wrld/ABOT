package app.abot.gym;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout in progress as an ongoing notification, kept up to date while the workout runs:
 * the next lift, the workout name, and a clock Android ticks itself (rest counting down, or the
 * workout time). Pause / Resume and Skip rest work from the notification even while ABOT is
 * frozen: LiveWorkoutReceiver updates the notification at once and hands the tap to the app.
 * WorkoutLiveService holds it as a foreground service so battery savers leave it alone.
 * The end of a rest is an alarm owned here, so it swaps the notification to "rest over" whether
 * or not the app is running, and rings unless ABOT is on screen (the page beeps then) or Rest
 * alert is off. On Android 16 the notification asks to be a
 * Live Update, which puts the clock in a chip on the status bar.
 */
@CapacitorPlugin(name = "LiveWorkout")
public class LiveWorkoutPlugin extends Plugin {

    static final String CHANNEL = "workout-live";
    static final String ALERT_CHANNEL = "rest-over";
    static final int NOTIFICATION_ID = 4242;
    static final int ALERT_ID = 4244;
    static final String ACTION_REST_OVER = "app.abot.gym.REST_OVER";
    static final String ACTION_BUTTON = "app.abot.gym.LIVE_BUTTON";
    static final String EXTRA_ID = "id";
    private static final String PREFS = "abot_live";
    private static final String PENDING = "pending";
    private static final int ALARM_REQUEST = 4243;

    private static LiveWorkoutPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();
        LiveState s = new LiveState();
        s.title = call.getString("title", "Workout");
        s.text = call.getString("text", "");
        s.clockStart = call.getLong("clockStart", System.currentTimeMillis());
        Long pausedElapsed = call.getLong("pausedElapsed");
        s.paused = pausedElapsed != null;
        s.pausedElapsed = pausedElapsed != null ? pausedElapsed : 0;
        s.pausedTitle = call.getString("pausedTitle", "Paused");
        Long restEndsAt = call.getLong("restEndsAt");
        s.restEndsAt = restEndsAt != null && !s.paused ? restEndsAt : 0;
        s.restTitle = call.getString("restTitle", s.title);
        s.restText = call.getString("restText", s.text);
        s.overTitle = call.getString("overTitle", s.title);
        s.overText = call.getString("overText", s.text);
        s.ring = call.getBoolean("ring", true);
        s.restOnly = call.getBoolean("restOnly", false);
        s.canLog = call.getBoolean("canLog", false);
        s.logRestSec = call.getInt("logRestSec", 0);
        s.loggedTitle = call.getString("loggedTitle", s.title);
        s.loggedText = call.getString("loggedText", s.text);
        s.addLabel = call.getString("addLabel", "+30s");
        s.skipLabel = call.getString("skipLabel", "Skip rest");
        s.logLabel = call.getString("logLabel", "Log set");
        s.pauseLabel = call.getString("pauseLabel", "Pause");
        s.resumeLabel = call.getString("resumeLabel", "Resume");
        s.save(ctx);
        cancelAlarm(ctx);
        if (s.restEndsAt > System.currentTimeMillis()) scheduleAlarm(ctx, s.restEndsAt);
        render(ctx, s);
        // Started here, while the app is in front: Android 12+ refuses it from the background.
        if (!s.hidden(System.currentTimeMillis())) WorkoutLiveService.ensure(ctx);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        cancelAlarm(ctx);
        WorkoutLiveService.stop(ctx);
        ctx.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        prefs(ctx).edit().clear().apply();
        call.resolve();
    }

    /** Rings the rest-over alert now, so the lifter can check sound and permission. */
    @PluginMethod
    public void testAlert(PluginCall call) {
        boolean shown = postAlert(getContext(), "Rest over", "This is how the end of a rest sounds.");
        JSObject ret = new JSObject();
        ret.put("shown", shown);
        call.resolve(ret);
    }

    /** Buttons tapped while the app was not running, oldest first, so the app can catch up. */
    @PluginMethod
    public void takePendingActions(PluginCall call) {
        SharedPreferences p = prefs(getContext());
        String ids = p.getString(PENDING, "");
        p.edit().remove(PENDING).apply();
        JSArray list = new JSArray();
        for (String id : ids.split(",")) if (!id.isEmpty()) list.put(id);
        JSObject ret = new JSObject();
        ret.put("ids", list);
        call.resolve(ret);
    }

    /** Hands a notification button to the app, or keeps it until the app asks. */
    static void dispatch(Context ctx, String id) {
        LiveWorkoutPlugin p = instance;
        if (p != null) {
            JSObject data = new JSObject();
            data.put("id", id);
            p.notifyListeners("action", data, true);
        } else {
            // Kept in order: two "+30s" taps must add a minute, not thirty seconds.
            SharedPreferences sp = prefs(ctx);
            String before = sp.getString(PENDING, "");
            sp.edit().putString(PENDING, before.isEmpty() ? id : before + "," + id).apply();
        }
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean canNotify(Context ctx) {
        return Build.VERSION.SDK_INT < 33
            || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean isShowing(Context ctx) {
        for (StatusBarNotification n : ctx.getSystemService(NotificationManager.class).getActiveNotifications()) {
            if (n.getId() == NOTIFICATION_ID) return true;
        }
        return false;
    }

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel live = new NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW);
            live.setDescription("The workout and your next set while it runs.");
            live.setShowBadge(false);
            nm.createNotificationChannel(live);
        }
        if (nm.getNotificationChannel(ALERT_CHANNEL) == null) {
            NotificationChannel alert = new NotificationChannel(ALERT_CHANNEL, "Rest over", NotificationManager.IMPORTANCE_HIGH);
            alert.setDescription("Rings when a rest timer ends.");
            alert.enableVibration(true);
            alert.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build()
            );
            nm.createNotificationChannel(alert);
        }
    }

    private static Notification.Builder builder(Context ctx, String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, channel) : new Notification.Builder(ctx);
    }

    /**
     * Posts or replaces the ongoing notification for the state. In rest-only mode with no rest
     * running it takes the notification down instead, service included.
     */
    static void render(Context ctx, LiveState s) {
        if (!canNotify(ctx)) return;
        if (s.hidden(System.currentTimeMillis())) {
            WorkoutLiveService.stop(ctx);
            ctx.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
            return;
        }
        ctx.getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, build(ctx, s));
    }

    /** ABOT's Volt; Android darkens it where it would not read on a light shade. */
    static final int ACCENT = 0xFFCCFF00;

    /**
     * The ongoing notification: a clock Android ticks itself, counting the rest down to zero or the
     * workout up from its start, so the status bar chip stays live while ABOT is frozen.
     * Buttons: while resting +30s, Skip rest and Log set; otherwise Log set and Pause; paused, Resume.
     */
    static Notification build(Context ctx, LiveState s) {
        ensureChannels(ctx);
        long now = System.currentTimeMillis();
        boolean resting = s.resting(now);
        Notification.Builder b = builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_abot)
            .setColor(ACCENT)
            // The small icon is always drawn as one-colour silhouette; the app icon in colour
            // goes beside the text, where ColorOS and others show it.
            .setLargeIcon(Icon.createWithResource(ctx, R.mipmap.ic_launcher))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STOPWATCH)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(ctx));
        if (s.paused) {
            b.setContentTitle(s.pausedTitle).setContentText(s.text + " · " + clock(s.pausedElapsed)).setShowWhen(false);
            b.addAction(button(ctx, "resume", s.resumeLabel, 1, R.drawable.ic_action_resume));
        } else {
            b.setContentTitle(resting ? s.restTitle : s.title)
                .setContentText(resting ? s.restText : s.text)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setWhen(resting ? s.restEndsAt : s.clockStart);
            if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(resting);
            if (resting) {
                b.addAction(button(ctx, "add30", s.addLabel, 4, R.drawable.ic_action_add));
                b.addAction(button(ctx, "skip", s.skipLabel, 3, R.drawable.ic_action_skip));
            }
            if (s.canLog) b.addAction(button(ctx, "log", s.logLabel, 5, R.drawable.ic_action_log));
            if (!resting) b.addAction(button(ctx, "pause", s.pauseLabel, 2, R.drawable.ic_action_pause));
        }
        // Android 16 Live Update (a clock chip on the status bar). This is the extra that
        // Builder#setRequestPromotedOngoing sets; that setter is newer than compileSdk 36.
        Bundle promoted = new Bundle();
        promoted.putBoolean("android.requestPromotedOngoing", true);
        b.addExtras(promoted);
        return b.build();
    }

    /** The sound-and-buzz alert for the end of a rest. Returns false without permission. */
    static boolean postAlert(Context ctx, String title, String text) {
        if (!canNotify(ctx)) return false;
        ensureChannels(ctx);
        Notification.Builder b = builder(ctx, ALERT_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_abot)
            .setColor(ACCENT)
            .setLargeIcon(Icon.createWithResource(ctx, R.mipmap.ic_launcher))
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(ctx));
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        ctx.getSystemService(NotificationManager.class).notify(ALERT_ID, b.build());
        return true;
    }

    private static String clock(long ms) {
        long sec = Math.max(0, ms / 1000);
        long h = sec / 3600;
        long m = (sec % 3600) / 60;
        long ss = sec % 60;
        return h > 0 ? String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, ss) : String.format(java.util.Locale.US, "%d:%02d", m, ss);
    }

    /** A button with its own icon: ColorOS and One UI draw the icon beside the label. */
    private static Notification.Action button(Context ctx, String id, String label, int request, int icon) {
        Intent i = new Intent(ctx, LiveWorkoutReceiver.class).setAction(ACTION_BUTTON).putExtra(EXTRA_ID, id);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, request, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Action.Builder(Icon.createWithResource(ctx, icon), label, pi).build();
    }

    private static PendingIntent openApp(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) launch = new Intent(ctx, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent alarmIntent(Context ctx, boolean create) {
        Intent i = new Intent(ctx, LiveWorkoutReceiver.class).setAction(ACTION_REST_OVER);
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(ctx, ALARM_REQUEST, i, flags);
    }

    static void scheduleAlarm(Context ctx, long at) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        PendingIntent pi = alarmIntent(ctx, true);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    static void cancelAlarm(Context ctx) {
        PendingIntent pi = alarmIntent(ctx, false);
        if (pi != null) {
            ctx.getSystemService(AlarmManager.class).cancel(pi);
            pi.cancel();
        }
    }
}
