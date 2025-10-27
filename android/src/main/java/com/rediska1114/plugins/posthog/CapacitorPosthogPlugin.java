package com.rediska1114.plugins.posthog;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CapacitorPosthog")
public class CapacitorPosthogPlugin extends Plugin {

    private CapacitorPosthog implementation = new CapacitorPosthog();

    @PluginMethod
    public void startSessionReplay(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        JSObject sdkOptions = call.getObject("sdkOptions", new JSObject());
        JSObject sdkReplayConfig = call.getObject("sdkReplayConfig", new JSObject());
        JSObject decideReplayConfig = call.getObject("decideReplayConfig", new JSObject());

        implementation.startSessionReplay(getContext(), sessionId, sdkOptions, sdkReplayConfig, decideReplayConfig, new CapacitorPosthog.Callback() {
            @Override
            public void onComplete() {
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void startSessionReplaySession(PluginCall call) {
        String sessionId = call.getString("sessionId", "");

        implementation.startSessionReplaySession(sessionId, new CapacitorPosthog.Callback() {
            @Override
            public void onComplete() {
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void endSessionReplay(PluginCall call) {
        implementation.endSessionReplay(new CapacitorPosthog.Callback() {
            @Override
            public void onComplete() {
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void isSessionReplayEnabled(PluginCall call) {
        implementation.isSessionReplayEnabled(new CapacitorPosthog.BooleanCallback() {
            @Override
            public void onResult(boolean result) {
                JSObject ret = new JSObject();
                ret.put("value", result);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void identifySessionReplay(PluginCall call) {
        String distinctId = call.getString("distinctId", "");
        String anonymousId = call.getString("anonymousId", "");

        implementation.identifySessionReplay(distinctId, anonymousId, new CapacitorPosthog.Callback() {
            @Override
            public void onComplete() {
                call.resolve();
            }
        });
    }
}
