package com.rupam.driveflow;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppUpdateNotification")
public class AppUpdateNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "driveflow_app_updates";
    private static final String CHANNEL_NAME = "DriveFlow App Updates";
    private static final int NOTIFICATION_ID = 9001;
    private static final int PERMISSION_REQUEST_CODE = 9002;

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                if (getActivity() != null) {
                    ActivityCompat.requestPermissions(
                            getActivity(),
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            PERMISSION_REQUEST_CODE
                    );
                }
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("requested", true);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        ret.put("requested", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void showUpdateNotification(PluginCall call) {
        String version = call.getString("version", "v1.0.1");
        String downloadUrl = call.getString("downloadUrl", "https://neo-files-transfer.pages.dev/download/723586892fd0");
        String title = call.getString("title", "New Update Available: " + version);
        String body = call.getString("body", "A new version of DriveFlow (" + version + ") is available. Tap here to download.");

        try {
            Context context = getContext();
            NotificationManager notificationManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager == null) {
                call.reject("NotificationManager not available");
                return;
            }

            // Create notification channel for Android 8.0+ (Oreo and newer)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifications for available DriveFlow updates");
                channel.enableVibration(true);
                channel.enableLights(true);
                notificationManager.createNotificationChannel(channel);
            }

            // Tap action: opens app and immediately displays In-App Updater Screen / Modal
            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("ACTION_OPEN_UPDATER");
            intent.putExtra("action", "open_updater");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            notificationManager.notify(NOTIFICATION_ID, builder.build());

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to show notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void showAnnouncementNotification(PluginCall call) {
        String title = call.getString("title", "DriveFlow Update");
        String body = call.getString("body", "");
        String url = call.getString("url", "/user/notifications");
        String notificationId = call.getString("notificationId", "");

        try {
            Context context = getContext();
            NotificationManager notificationManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager == null) {
                call.reject("NotificationManager not available");
                return;
            }

            String channelId = "driveflow_announcements";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "DriveFlow Announcements",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Receive important updates and announcements from DriveFlow");
                channel.enableVibration(true);
                channel.enableLights(true);
                notificationManager.createNotificationChannel(channel);
            }

            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("ACTION_OPEN_NOTIFICATION");
            intent.putExtra("url", url);
            intent.putExtra("notificationId", notificationId);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int notifId = (int) System.currentTimeMillis();
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    notifId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            notificationManager.notify(notifId, builder.build());

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to show announcement notification: " + e.getMessage());
        }
    }
}
