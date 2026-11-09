package app.abot.gym;

import android.app.Notification;
import java.util.ArrayList;
import java.util.List;

/**
 * Android 16's segmented progress bar for the workout notification, kept out of
 * LiveWorkoutPlugin: Capacitor reads that plugin's methods by reflection when the app starts, and
 * Notification.ProgressStyle in one of its signatures made Android 15 and older fail to load it
 * (ClassNotFoundException, app closed before the WebView). This class is only loaded on API 36+,
 * and its public method returns the plain Notification.Style type.
 */
final class LiveProgress {

    private LiveProgress() {}

    /**
     * One segment per exercise sized by its sets, filled up to the sets done; null with no sets.
     * Changes only when a set is ticked, so it stays true while ABOT is frozen.
     */
    static Notification.Style style(LiveState s, int color) {
        if (s.progressSegments == null || s.progressSegments.isEmpty()) return null;
        List<Notification.ProgressStyle.Segment> segments = new ArrayList<>();
        int total = 0;
        for (String part : s.progressSegments.split(",")) {
            try {
                int n = Integer.parseInt(part.trim());
                if (n <= 0) continue;
                segments.add(new Notification.ProgressStyle.Segment(n).setColor(color));
                total += n;
            } catch (NumberFormatException e) {
                // A bad entry only drops that segment.
            }
        }
        if (segments.isEmpty()) return null;
        return new Notification.ProgressStyle()
            .setStyledByProgress(true)
            .setProgressSegments(segments)
            .setProgress(Math.min(Math.max(0, s.progressDone), total));
    }
}
