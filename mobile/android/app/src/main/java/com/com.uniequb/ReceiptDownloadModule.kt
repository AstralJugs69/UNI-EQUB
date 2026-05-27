package com.uniequb

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ReceiptDownloadModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "UniEqubReceiptDownload"

  @ReactMethod
  fun savePdfToDownloads(sourcePath: String, displayName: String, promise: Promise) {
    try {
      val cleanSource = sourcePath.removePrefix("file://")
      val sourceFile = File(cleanSource)
      if (!sourceFile.exists()) {
        promise.reject("UNIEQUB_RECEIPT_SOURCE_MISSING", "Receipt PDF file was not created.")
        return
      }

      val safeName = sanitizeFileName(displayName).let {
        if (it.endsWith(".pdf", ignoreCase = true)) it else "$it.pdf"
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveWithMediaStore(sourceFile, safeName, promise)
      } else {
        saveLegacy(sourceFile, safeName, promise)
      }
    } catch (error: Exception) {
      promise.reject("UNIEQUB_RECEIPT_DOWNLOAD_FAILED", error.message, error)
    }
  }

  private fun saveWithMediaStore(sourceFile: File, safeName: String, promise: Promise) {
    val resolver = reactContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, safeName)
      put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/UniEqub")
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
    if (uri == null) {
      promise.reject("UNIEQUB_RECEIPT_DOWNLOAD_FAILED", "Android could not create a Downloads entry for this receipt.")
      return
    }

    try {
      resolver.openOutputStream(uri)?.use { output ->
        sourceFile.inputStream().use { input -> input.copyTo(output) }
      } ?: throw IllegalStateException("Android could not open the Downloads destination.")

      val completeValues = ContentValues().apply {
        put(MediaStore.Downloads.IS_PENDING, 0)
      }
      resolver.update(uri, completeValues, null, null)
      promise.resolve(uri.toString())
    } catch (error: Exception) {
      resolver.delete(uri, null, null)
      throw error
    }
  }

  private fun saveLegacy(sourceFile: File, safeName: String, promise: Promise) {
    @Suppress("DEPRECATION")
    val downloads = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "UniEqub")
    if (!downloads.exists() && !downloads.mkdirs()) {
      promise.reject("UNIEQUB_RECEIPT_DOWNLOAD_FAILED", "Could not create the UniEqub Downloads folder.")
      return
    }
    val destination = File(downloads, safeName)
    sourceFile.copyTo(destination, overwrite = true)
    promise.resolve(destination.absolutePath)
  }

  private fun sanitizeFileName(value: String): String {
    return value
      .trim()
      .replace(Regex("[^A-Za-z0-9._-]+"), "-")
      .trim('-')
      .ifBlank { "uniequb-receipt" }
  }
}
