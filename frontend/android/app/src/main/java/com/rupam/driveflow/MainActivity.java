package com.rupam.driveflow;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DriveFlowRefreshRate";
    private static final int NOTIFICATION_PERMISSION_CODE = 9002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadHelperPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(AppUpdateNotificationPlugin.class);
        registerPlugin(NetworkHelperPlugin.class);
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        configureNativeWindow();
        checkAndRequestNotificationPermission();
        handleUpdateIntent(getIntent());
        handleNotificationIntent(getIntent());

        // Re-enforce high refresh rate & hardware acceleration once WebView is initialized
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                enableHighRefreshRate();
                enableHardwareAccelerationOnWebView();
            });
        }
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        enableHighRefreshRate();
        enableHardwareAccelerationOnWebView();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableHighRefreshRate();
            enableHardwareAccelerationOnWebView();
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleUpdateIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleUpdateIntent(android.content.Intent intent) {
        if (intent != null && "open_updater".equals(intent.getStringExtra("action"))) {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().postDelayed(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('open-app-updater'));",
                        null
                    );
                }, 600);
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                // High-priority announcement channel
                NotificationChannel announcementChannel = new NotificationChannel(
                        "driveflow_announcements",
                        "DriveFlow Announcements",
                        NotificationManager.IMPORTANCE_HIGH
                );
                announcementChannel.setDescription("Receive important updates and announcements from DriveFlow");
                announcementChannel.enableLights(true);
                announcementChannel.setLightColor(Color.parseColor("#7c3aed"));
                announcementChannel.enableVibration(true);
                announcementChannel.setShowBadge(true);
                announcementChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(announcementChannel);
            }
        }
    }

    private void handleNotificationIntent(android.content.Intent intent) {
        if (intent != null && "ACTION_OPEN_NOTIFICATION".equals(intent.getAction())) {
            String url = intent.getStringExtra("url");
            String notifId = intent.getStringExtra("notificationId");
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().postDelayed(() -> {
                    String targetUrl = url != null ? url : "/user/notifications";
                    String idStr = notifId != null ? notifId : "";
                    String script = "window.dispatchEvent(new CustomEvent('open-push-notification', { detail: { url: '" + targetUrl + "', notificationId: '" + idStr + "' } }));";
                    getBridge().getWebView().evaluateJavascript(script, null);
                }, 600);
            }
        }
    }

    private void checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_CODE
                );
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        enableHighRefreshRate();
        enableHardwareAccelerationOnWebView();
        handleUpdateIntent(getIntent());
        handleNotificationIntent(getIntent());
    }

    private void configureNativeWindow() {
        setupEdgeToEdgeWindow();
        enableHighRefreshRate();
        enableHardwareAccelerationOnWebView();
    }

    private void enableHardwareAccelerationOnWebView() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                android.webkit.WebView webView = getBridge().getWebView();
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);

                android.webkit.WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Hardware acceleration setup error: " + e.getMessage());
        }
    }

    private void setupEdgeToEdgeWindow() {
        try {
            Window window = getWindow();
            if (window == null) return;

            // Explicitly force hardware acceleration on the Window surface
            window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.parseColor("#080711"));
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decorView = window.getDecorView();
                int flags = decorView.getSystemUiVisibility();
                decorView.setSystemUiVisibility(flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        } catch (Exception e) {
            Log.w(TAG, "Edge to edge setup error: " + e.getMessage());
        }
    }

    private void enableHighRefreshRate() {
        try {
            Window window = getWindow();
            if (window == null) return;

            window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

            Display display = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    display = getDisplay();
                } catch (Exception ignored) {}
            }
            if (display == null) {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                if (wm != null) {
                    display = wm.getDefaultDisplay();
                }
            }

            if (display == null) return;

            Display.Mode currentMode = display.getMode();
            Display.Mode[] modes = display.getSupportedModes();
            if (modes == null || modes.length == 0) return;

            int currentWidth = currentMode.getPhysicalWidth();
            int currentHeight = currentMode.getPhysicalHeight();

            Display.Mode bestMode = null;
            float maxRefreshRate = currentMode.getRefreshRate();

            // Pass 1: Find highest refresh rate mode that matches current resolution (avoids OS mode rejection)
            for (Display.Mode mode : modes) {
                if (mode.getPhysicalWidth() == currentWidth && mode.getPhysicalHeight() == currentHeight) {
                    if (mode.getRefreshRate() > maxRefreshRate) {
                        maxRefreshRate = mode.getRefreshRate();
                        bestMode = mode;
                    }
                }
            }

            // Pass 2: Fallback across any resolution if none matched
            if (bestMode == null) {
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > maxRefreshRate) {
                        maxRefreshRate = mode.getRefreshRate();
                        bestMode = mode;
                    }
                }
            }

            WindowManager.LayoutParams params = window.getAttributes();
            boolean updated = false;

            if (bestMode != null) {
                params.preferredDisplayModeId = bestMode.getModeId();
                updated = true;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && maxRefreshRate > 60.0f) {
                params.preferredRefreshRate = maxRefreshRate;
                updated = true;

                try {
                    java.lang.reflect.Field minField = params.getClass().getField("preferredMinDisplayRefreshRate");
                    minField.setFloat(params, maxRefreshRate);
                    java.lang.reflect.Field maxField = params.getClass().getField("preferredMaxDisplayRefreshRate");
                    maxField.setFloat(params, maxRefreshRate);
                } catch (Exception ignored) {}
            }

            if (updated) {
                window.setAttributes(params);
            }

            Log.i(TAG, "Display Refresh Rate locked to: " + maxRefreshRate + "Hz (Active: " + currentMode.getRefreshRate() + "Hz, Mode ID: " + (bestMode != null ? bestMode.getModeId() : currentMode.getModeId()) + ")");
        } catch (Exception e) {
            Log.w(TAG, "Failed to apply high refresh rate: " + e.getMessage());
        }
    }
}
