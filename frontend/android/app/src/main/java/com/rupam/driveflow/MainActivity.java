package com.rupam.driveflow;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadHelperPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        configureNativeWindow();
    }

    private void configureNativeWindow() {
        enableHighRefreshRate();
        setupEdgeToEdgeWindow();
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
