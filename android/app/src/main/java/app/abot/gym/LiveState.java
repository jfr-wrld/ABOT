package app.abot.gym;

import android.content.Context;
import android.content.SharedPreferences;

/** What the live workout notification shows, kept so the receiver and service can redraw it on their own. */
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
    String restText;
    String overTitle;
    String overText;
    /** Rest alert: ring when a rest ends. */
    boolean ring = true;
    /** Show the notification only while a rest runs. */
    boolean restOnly;
    /** The next set has weight and reps, so "Log set" can tick it without the app. */
    boolean canLog;
    /** The rest that follows the logged set, 0 for none (mid-superset or no rest). */
    int logRestSec;
    /** Shown once "Log set" is tapped, until the app sends the next set. */
    String loggedTitle;
    String loggedText;
    /** Button labels, in the app's language. */
    String addLabel;
    String skipLabel;
    String logLabel;
    String pauseLabel;
    String resumeLabel;

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
            .putString("restText", restText)
            .putString("overTitle", overTitle)
            .putString("overText", overText)
            .putBoolean("ring", ring)
            .putBoolean("restOnly", restOnly)
            .putBoolean("canLog", canLog)
            .putInt("logRestSec", logRestSec)
            .putString("loggedTitle", loggedTitle)
            .putString("loggedText", loggedText)
            .putString("addLabel", addLabel)
            .putString("skipLabel", skipLabel)
            .putString("logLabel", logLabel)
            .putString("pauseLabel", pauseLabel)
            .putString("resumeLabel", resumeLabel)
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
        s.restText = p.getString("restText", s.text);
        s.overTitle = p.getString("overTitle", s.title);
        s.overText = p.getString("overText", s.text);
        s.ring = p.getBoolean("ring", true);
        s.restOnly = p.getBoolean("restOnly", false);
        s.canLog = p.getBoolean("canLog", false);
        s.logRestSec = p.getInt("logRestSec", 0);
        s.loggedTitle = p.getString("loggedTitle", s.title);
        s.loggedText = p.getString("loggedText", s.text);
        s.addLabel = p.getString("addLabel", "+30s");
        s.skipLabel = p.getString("skipLabel", "Skip rest");
        s.logLabel = p.getString("logLabel", "Log set");
        s.pauseLabel = p.getString("pauseLabel", "Pause");
        s.resumeLabel = p.getString("resumeLabel", "Resume");
        return s;
    }

    boolean resting(long now) {
        return !paused && restEndsAt > now;
    }

    /** Rest-only mode with no rest running: nothing to show. */
    boolean hidden(long now) {
        return restOnly && !resting(now);
    }
}
