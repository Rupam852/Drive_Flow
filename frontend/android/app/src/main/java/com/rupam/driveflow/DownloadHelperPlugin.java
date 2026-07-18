package com.rupam.driveflow;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "DownloadHelper")
public class DownloadHelperPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (fileName == null || base64Data == null) {
            call.reject("FileName and Base64Data are required");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();
            Uri fileUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                fileUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
            } else {
                java.io.File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                java.io.File file = new java.io.File(downloadDir, fileName);
                fileUri = Uri.fromFile(file);
            }

            if (fileUri != null) {
                try (OutputStream os = resolver.openOutputStream(fileUri)) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                        JSObject ret = new JSObject();
                        ret.put("status", "success");
                        ret.put("path", fileUri.toString());
                        call.resolve(ret);
                        return;
                    }
                }
            }
            call.reject("Failed to create file output stream");
        } catch (Exception e) {
            call.reject("Error saving file: " + e.getLocalizedMessage());
        }
    }
}
