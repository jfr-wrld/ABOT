package app.abot.gym;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Holds the live workout notification as a foreground service, so phone makers' battery savers
 * (One UI, HyperOS, ColorOS) do not kill ABOT or drop the notification mid-workout. It draws the
 * same notification LiveWorkoutPlugin does, from the saved LiveState, and stops when the workout
 * ends or, in rest-only mode, when a rest ends.
 */
public class WorkoutLiveService extends Service {

    static volatile boolean running = false;

    /**
     * Starts the service if it is not running. Android 12+ refuses that while ABOT is in the
     * background; the plain notification is already posted then, so nothing is lost.
     */
    static void ensure(Context ctx) {
        if (running || Build.VERSION.SDK_INT < 26) return;
        try {
            ctx.startForegroundService(new Intent(ctx, WorkoutLiveService.class));
        } catch (IllegalStateException | SecurityException e) {
            // ForegroundServiceStartNotAllowedException is an IllegalStateException.
        }
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, WorkoutLiveService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        LiveState s = LiveState.load(this);
        if (s == null || s.hidden(System.currentTimeMillis()) || !LiveWorkoutPlugin.canNotify(this)) {
            // startForegroundService must be answered with startForeground even when stopping.
            Notification blank = LiveWorkoutPlugin.build(this, s != null ? s : new LiveState());
            begin(blank);
            stopSelf();
            return START_NOT_STICKY;
        }
        begin(LiveWorkoutPlugin.build(this, s));
        running = true;
        return START_NOT_STICKY;
    }

    private void begin(Notification n) {
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(LiveWorkoutPlugin.NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(LiveWorkoutPlugin.NOTIFICATION_ID, n);
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
