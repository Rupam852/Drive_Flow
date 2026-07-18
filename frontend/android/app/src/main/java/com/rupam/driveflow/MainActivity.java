package com.rupam.driveflow;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadHelperPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
