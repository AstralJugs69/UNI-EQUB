package com.uniequb

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocalNotificationModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val CHANNEL_ID = "uniequb_events"
    private const val CHANNEL_NAME = "UniEqub Events"
  }

  override fun getName(): String = "UniEqubLocalNotification"

  @ReactMethod
  fun show(id: String, title: String, body: String, promise: Promise) {
    try {
      if (!hasPermission()) {
        promise.resolve(false)
        return
      }

      val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      ensureChannel(manager)

      val launchIntent = Intent(reactContext, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pendingIntent = PendingIntent.getActivity(
        reactContext,
        id.hashCode(),
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val notification = notificationBuilder(title, body)
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .build()

      manager.notify(id.hashCode(), notification)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("UNIEQUB_NOTIFICATION_FAILED", error.message, error)
    }
  }

  private fun notificationBuilder(title: String, body: String): Notification.Builder {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(reactContext, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(reactContext)
    }

    @Suppress("DEPRECATION")
    builder
      .setSmallIcon(R.drawable.ic_stat_uniequb)
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(Notification.PRIORITY_HIGH)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    return builder
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) {
      return
    }
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
      description = "KYC, payment, group, voting, announcement, and admin-resolution events."
      enableVibration(true)
    }
    manager.createNotificationChannel(channel)
  }

  private fun hasPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return true
    }
    return reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  }
}
