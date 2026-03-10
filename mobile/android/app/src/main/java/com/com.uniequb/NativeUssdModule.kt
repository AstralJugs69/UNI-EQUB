package com.uniequb

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments

class NativeUssdModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NativeUssd"

  @ReactMethod
  fun launch(code: String, directCall: Boolean, promise: Promise) {
    try {
      val action = if (directCall) Intent.ACTION_CALL else Intent.ACTION_DIAL
      val intent = Intent(action).apply {
        data = Uri.parse("tel:${Uri.encode(code)}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(if (directCall) "call" else "dial")
    } catch (error: Exception) {
      promise.reject("USSD_LAUNCH_FAILED", error)
    }
  }

  @ReactMethod
  fun sendOneShot(code: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("USSD_UNSUPPORTED", "sendUssdRequest requires Android 8.0 or newer.")
      return
    }

    val telephonyManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    if (telephonyManager == null) {
      promise.reject("USSD_UNAVAILABLE", "Telephony service is not available on this device.")
      return
    }

    try {
      telephonyManager.sendUssdRequest(code, object : TelephonyManager.UssdResponseCallback() {
        override fun onReceiveUssdResponse(
          telephonyManager: TelephonyManager,
          request: String,
          response: CharSequence
        ) {
          val payload = Arguments.createMap().apply {
            putString("request", request)
            putString("response", response.toString())
          }
          promise.resolve(payload)
        }

        override fun onReceiveUssdResponseFailed(
          telephonyManager: TelephonyManager,
          request: String,
          failureCode: Int
        ) {
          promise.reject("USSD_FAILED", "USSD request failed with code $failureCode")
        }
      }, Handler(Looper.getMainLooper()))
    } catch (error: SecurityException) {
      promise.reject("USSD_PERMISSION", error)
    } catch (error: Exception) {
      promise.reject("USSD_FAILED", error)
    }
  }
}
