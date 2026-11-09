package app.abot.gym

import android.app.Activity
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView

/**
 * Shown by Health Connect when someone asks why ABOT wants health data (the "privacy policy"
 * link in its permission screen, and Android 14's permission usage view). Health Connect will
 * not show ABOT's permission dialog unless an activity answers this request.
 */
class HealthPermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 24f, resources.displayMetrics).toInt()
        val text = TextView(this).apply {
            setText(R.string.health_rationale)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setLineSpacing(0f, 1.3f)
            setPadding(pad, pad, pad, pad)
        }
        setContentView(ScrollView(this).apply { addView(text) })
        title = getString(R.string.health_rationale_title)
    }
}
