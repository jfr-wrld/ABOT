package app.abot.gym

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/**
 * ABOT's bridge to Android Health Connect, the on-device store that Google Fit, Samsung Health,
 * Huawei Health and other apps share. Finished workouts are written as weightlifting sessions
 * with their estimated active calories; body weight and last night's sleep are read back. All
 * of it stays on the phone: Health Connect has no server.
 *
 * Records carry the workout id as their client record id, so syncing the same workout again
 * updates it instead of adding a copy.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val permissions = setOf(
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    private val permissionNames = mapOf(
        HealthPermission.getWritePermission(ExerciseSessionRecord::class) to "writeExercise",
        HealthPermission.getReadPermission(ExerciseSessionRecord::class) to "readExercise",
        HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class) to "writeCalories",
        HealthPermission.getReadPermission(WeightRecord::class) to "readWeight",
        HealthPermission.getReadPermission(SleepSessionRecord::class) to "readSleep",
    )

    private fun status(): String = when (HealthConnectClient.getSdkStatus(context, PROVIDER)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needs_update"
        else -> "unavailable"
    }

    private fun client(call: PluginCall): HealthConnectClient? {
        if (status() != "available") {
            call.reject("Health Connect is not available on this phone", "UNAVAILABLE")
            return null
        }
        return HealthConnectClient.getOrCreate(context)
    }

    /** Runs a suspending block and turns any exception into a rejected call. */
    private fun launch(call: PluginCall, block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (e: SecurityException) {
                call.reject("Health Connect permission was not granted", "PERMISSION", e)
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect failed", "FAILED", e)
            }
        }
    }

    private suspend fun grantedResult(c: HealthConnectClient): JSObject {
        val granted = c.permissionController.getGrantedPermissions()
        val list = JSArray()
        permissions.filter { granted.contains(it) }.forEach { list.put(permissionNames[it]) }
        val out = JSObject()
        out.put("granted", list)
        out.put("all", granted.containsAll(permissions))
        return out
    }

    @PluginMethod
    fun availability(call: PluginCall) {
        val out = JSObject()
        out.put("status", status())
        call.resolve(out)
    }

    @PluginMethod
    fun checkHealthPermissions(call: PluginCall) {
        val c = client(call) ?: return
        launch(call) { call.resolve(grantedResult(c)) }
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        val c = client(call) ?: return
        launch(call) {
            if (c.permissionController.getGrantedPermissions().containsAll(permissions)) {
                call.resolve(grantedResult(c))
                return@launch
            }
            val intent = PermissionController.createRequestPermissionResultContract(PROVIDER).createIntent(context, permissions)
            startActivityForResult(call, intent, "permissionResult")
        }
    }

    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val c = client(call) ?: return
        launch(call) { call.resolve(grantedResult(c)) }
    }

    /** One finished workout: a weightlifting session plus its active calories over the same span. */
    @PluginMethod
    fun writeWorkout(call: PluginCall) {
        val id = call.getString("id")
        val start = call.getLong("startMs")
        val end = call.getLong("endMs")
        if (id == null || start == null || end == null || end <= start) {
            call.reject("A workout needs an id and a start before its end", "INVALID")
            return
        }
        val title = call.getString("title") ?: "Workout"
        val notes = call.getString("notes")
        val kcal = call.getDouble("kcal") ?: 0.0
        // Updated workouts get a higher version, so Health Connect replaces the older record.
        val version = call.getLong("version") ?: end
        val c = client(call) ?: return
        launch(call) {
            val startTime = Instant.ofEpochMilli(start)
            val endTime = Instant.ofEpochMilli(end)
            val zone = ZoneId.systemDefault().rules
            val records = mutableListOf<androidx.health.connect.client.records.Record>(
                ExerciseSessionRecord(
                    startTime = startTime,
                    startZoneOffset = zone.getOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zone.getOffset(endTime),
                    exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
                    title = title,
                    notes = notes,
                    metadata = Metadata.manualEntry(clientRecordId = "abot-session-$id", clientRecordVersion = version),
                ),
            )
            if (kcal > 0) {
                records.add(
                    ActiveCaloriesBurnedRecord(
                        startTime = startTime,
                        startZoneOffset = zone.getOffset(startTime),
                        endTime = endTime,
                        endZoneOffset = zone.getOffset(endTime),
                        energy = Energy.kilocalories(kcal),
                        metadata = Metadata.manualEntry(clientRecordId = "abot-kcal-$id", clientRecordVersion = version),
                    ),
                )
            }
            c.insertRecords(records)
            val out = JSObject()
            out.put("written", records.size)
            call.resolve(out)
        }
    }

    /** The newest weigh-in of the last 30 days, from any app or smart scale that writes to Health Connect. */
    @PluginMethod
    fun readLatestWeight(call: PluginCall) {
        val c = client(call) ?: return
        launch(call) {
            val now = Instant.now()
            val res = c.readRecords(
                ReadRecordsRequest(
                    WeightRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(now.minus(Duration.ofDays(30)), now),
                    ascendingOrder = false,
                    pageSize = 1,
                ),
            )
            val out = JSObject()
            res.records.firstOrNull()?.let {
                out.put("kg", it.weight.inKilograms)
                out.put("at", it.time.toEpochMilli())
                out.put("source", it.metadata.dataOrigin.packageName)
            }
            call.resolve(out)
        }
    }

    /** The latest sleep that ended in the last 24 hours: start, end and minutes asleep. */
    @PluginMethod
    fun readLastSleep(call: PluginCall) {
        val c = client(call) ?: return
        launch(call) {
            val now = Instant.now()
            val res = c.readRecords(
                ReadRecordsRequest(
                    SleepSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(now.minus(Duration.ofHours(36)), now),
                    ascendingOrder = false,
                    pageSize = 5,
                ),
            )
            val out = JSObject()
            res.records.firstOrNull { it.endTime.isAfter(now.minus(Duration.ofHours(24))) }?.let { s ->
                // With stages, awake time does not count; without them the whole session does.
                val awake = s.stages
                    .filter { it.stage == SleepSessionRecord.STAGE_TYPE_AWAKE || it.stage == SleepSessionRecord.STAGE_TYPE_OUT_OF_BED }
                    .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
                out.put("minutes", Duration.between(s.startTime, s.endTime).toMinutes() - awake)
                out.put("startMs", s.startTime.toEpochMilli())
                out.put("endMs", s.endTime.toEpochMilli())
                out.put("source", s.metadata.dataOrigin.packageName)
            }
            call.resolve(out)
        }
    }

    /** Health Connect's own settings, or its Play Store page when it is missing or out of date. */
    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        try {
            val intent = if (status() == "available") {
                Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$PROVIDER&url=healthconnect%3A%2F%2Fonboarding")).setPackage("com.android.vending")
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: ActivityNotFoundException) {
            try {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                call.resolve()
            } catch (e2: Exception) {
                call.reject("Could not open Health Connect", "FAILED", e2)
            }
        }
    }

    companion object {
        const val PROVIDER = "com.google.android.apps.healthdata"
    }
}
