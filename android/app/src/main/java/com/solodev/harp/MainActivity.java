package com.solodev.harp;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import io.capawesome.capacitorjs.plugins.firebase.appcheck.FirebaseAppCheckPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FirebaseAppCheckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
