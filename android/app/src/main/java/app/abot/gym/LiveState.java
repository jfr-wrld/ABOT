package app.abot.gym;

import android.content.Context;
import android.content.SharedPreferences;

/** What the live workout notification shows, kept so the receiver can redraw it on its own. */
class LiveState {

    String title;
    String text;
    /** The workout clock's zero: the start, moved later by time spent paused. */
    long clockStart;
    boolean paused;
    long pausedElapsed;
    String pausedTitle;
    /** 0 when no rest runs. */
    long restEndsAt;
    String restTitle;
    String overTitle;
    String overText;

    void save(Context ctx) {
        LiveWorkoutPlugin.prefs(ctx)
            .edit()
            .putString("title", title)
            .putString("text", text)
            .putLong("clockStart", clockStart)
            .putBoolean("paused", paused)
            .putLong("pausedElapsed", pausedElapsed)
            .putString("pausedTitle", pausedTitle)
            .putLong("restEndsAt", restEndsAt)
            .putString("restTitle", restTitle)
            .putString("overTitle", overTitle)
            .putString("overText", overText)
            .apply();
    }

    /** The last state shown, or null once the workout ended. */
    static LiveState load(Context ctx) {
        SharedPreferences p = LiveWorkoutPlugin.prefs(ctx);
        if (!p.contains("title")) return null;
        LiveState s = new LiveState();
        s.title = p.getString("title", "Workout");
        s.text = p.getString("text", "");
        s.clockStart = p.getLong("clockStart", System.currentTimeMillis());
        s.paused = p.getBoolean("paused", false);
        s.pausedElapsed = p.getLong("pausedElapsed", 0);
        s.pausedTitle = p.getString("pausedTitle", "Paused");
        s.restEndsAt = p.getLong("restEndsAt", 0);
        s.restTitle = p.getString("restTitle", s.title);
        s.overTitle = p.getString("overTitle", s.title);
        s.overText = p.getString("overText", s.text);
        return s;
    }
}
