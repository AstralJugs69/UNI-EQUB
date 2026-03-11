package com.uniequb

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeUssdModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NativeUssd"

  @ReactMethod
  fun launch(code: String, promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_CALL).apply {
        data = Uri.parse("tel:${Uri.encode(code)}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("USSD_LAUNCH_FAILED", error)
    }
  }
}
