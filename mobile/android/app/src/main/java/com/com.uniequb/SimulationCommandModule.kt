package com.uniequb

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SimulationCommandModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private var enabled = false
    private var instance: SimulationCommandModule? = null
    private val pendingPayloads = mutableListOf<String>()

    fun emitOrDrop(payload: String) {
      if (!enabled) {
        return
      }
      val module = instance
      if (module == null || !module.reactApplicationContext.hasActiveReactInstance()) {
        pendingPayloads.add(payload)
        return
      }
      module.emitPayload(payload)
    }
  }

  init {
    instance = this
  }

  override fun getName(): String = "SimulationCommand"

  @ReactMethod
  fun setEnabled(nextEnabled: Boolean, promise: Promise) {
    enabled = nextEnabled
    if (enabled) {
      pendingPayloads.toList().forEach { emitPayload(it) }
      pendingPayloads.clear()
    } else {
      pendingPayloads.clear()
    }
    promise.resolve(enabled)
  }

  @ReactMethod
  fun getPendingCommands(promise: Promise) {
    val payloads = Arguments.createArray()
    pendingPayloads.forEach { payloads.pushString(it) }
    pendingPayloads.clear()
    promise.resolve(payloads)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  private fun emitPayload(payload: String) {
    val event = Arguments.createMap()
    event.putString("payload", payload)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("UniEqubSimulationCommand", event)
  }
}
