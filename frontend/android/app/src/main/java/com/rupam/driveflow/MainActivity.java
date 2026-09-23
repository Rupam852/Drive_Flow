package com.rupam.driveflow;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 9002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadHelperPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(AppUpdateNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        configureNativeWindow();
        checkAndRequestNotificationPermission();
        handleUpdateIntent(getIntent());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleUpdateIntent(intent);
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
    }

    private void configureNativeWindow() {
        enableHighRefreshRate();
        setupEdgeToEdgeWindow();
        enableHardwareAccelerationOnWebView();
    }

    private void enableHardwareAccelerationOnWebView() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);
                getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_ALWAYS);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupEdgeToEdgeWindow() {
        try {
            Window window = getWindow();
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
            e.printStackTrace();
        }
    }

    private void enableHighRefreshRate() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Display display = getDisplay();
                if (display != null) {
                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode maxMode = null;
                    float maxRefreshRate = 0;
                    for (Display.Mode mode : modes) {
                        if (mode.getRefreshRate() > maxRefreshRate) {
                            maxRefreshRate = mode.getRefreshRate();
                            maxMode = mode;
                        }
                    }
                    if (maxMode != null) {
                        WindowManager.LayoutParams params = getWindow().getAttributes();
                        params.preferredDisplayModeId = maxMode.getModeId();
                        getWindow().setAttributes(params);
                    }
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Window window = getWindow();
                WindowManager.LayoutParams params = window.getAttributes();
                Display display = window.getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                float maxRefreshRate = 0;
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > maxRefreshRate) {
                        maxRefreshRate = mode.getRefreshRate();
                    }
                }
                if (maxRefreshRate > 0) {
                    params.preferredRefreshRate = maxRefreshRate;
                    window.setAttributes(params);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
