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
}
