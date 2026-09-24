package com.rupam.driveflow;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;
import android.provider.Settings;
import android.view.Display;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NetworkHelper")
public class NetworkHelperPlugin extends Plugin {

    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void load() {
        super.load();
        registerNetworkCallback();
    }

    private void registerNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        notifyStatus();
                    }

                    @Override
                    public void onLost(Network network) {
                        notifyStatus();
                    }

                    @Override
                    public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                        notifyStatus();
                    }
                };
                cm.registerDefaultNetworkCallback(networkCallback);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void notifyStatus() {
        JSObject status = checkCurrentNetworkStatus();
        notifyListeners("networkStatusChange", status);
    }

    private JSObject checkCurrentNetworkStatus() {
        JSObject ret = new JSObject();
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) {
                ret.put("connected", false);
                ret.put("validated", false);
                ret.put("connectionType", "none");
                return ret;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network activeNetwork = cm.getActiveNetwork();
                if (activeNetwork == null) {
                    ret.put("connected", false);
                    ret.put("validated", false);
                    ret.put("connectionType", "none");
                    return ret;
                }

                NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
                if (caps == null) {
                    ret.put("connected", false);
                    ret.put("validated", false);
                    ret.put("connectionType", "none");
                    return ret;
                }

                boolean hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);

                String connectionType = "unknown";
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    connectionType = "wifi";
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    connectionType = "cellular";
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                    connectionType = "ethernet";
                }

                ret.put("connected", hasInternet);
                ret.put("validated", validated);
                ret.put("connectionType", connectionType);
            } else {
                NetworkInfo activeNetworkInfo = cm.getActiveNetworkInfo();
                boolean isConnected = activeNetworkInfo != null && activeNetworkInfo.isConnected();
                String connectionType = "unknown";
                if (activeNetworkInfo != null) {
                    if (activeNetworkInfo.getType() == ConnectivityManager.TYPE_WIFI) {
                        connectionType = "wifi";
                    } else if (activeNetworkInfo.getType() == ConnectivityManager.TYPE_MOBILE) {
                        connectionType = "cellular";
                    }
                }
                ret.put("connected", isConnected);
                ret.put("validated", isConnected);
                ret.put("connectionType", connectionType);
            }
        } catch (Exception e) {
            ret.put("connected", false);
            ret.put("validated", false);
            ret.put("connectionType", "unknown");
            ret.put("error", e.getMessage());
        }
        return ret;
    }

    @PluginMethod
    public void getNetworkStatus(PluginCall call) {
        JSObject ret = checkCurrentNetworkStatus();
        call.resolve(ret);
    }

    @PluginMethod
    public void openNetworkSettings(PluginCall call) {
        try {
            // Android 10+ (API 29+): Internet Connectivity panel allows direct toggle of Wi-Fi and Data
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    Intent panelIntent = new Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY);
                    panelIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(panelIntent);
                    call.resolve();
                    return;
                } catch (Exception e) {
                    // Fallback to standard settings if custom ROM blocks panel
                }
            }

            try {
                Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
                return;
            } catch (Exception e1) {
                try {
                    Intent intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    call.resolve();
                    return;
                } catch (Exception e2) {
                    Intent intent = new Intent(Settings.ACTION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    call.resolve();
                }
            }
        } catch (Exception ex) {
            call.reject("Could not open network settings: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void getDisplayRefreshRate(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Display display = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    display = getActivity().getDisplay();
                } catch (Exception ignored) {}
            }
            if (display == null) {
                WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
                if (wm != null) {
                    display = wm.getDefaultDisplay();
                }
            }

            if (display != null) {
                Display.Mode currentMode = display.getMode();
                ret.put("refreshRate", currentMode.getRefreshRate());
                ret.put("width", currentMode.getPhysicalWidth());
                ret.put("height", currentMode.getPhysicalHeight());
                ret.put("modeId", currentMode.getModeId());
            } else {
                ret.put("refreshRate", 60.0f);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("refreshRate", 60.0f);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            if (networkCallback != null) {
                ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.unregisterNetworkCallback(networkCallback);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
