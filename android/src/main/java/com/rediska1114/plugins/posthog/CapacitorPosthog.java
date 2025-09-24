package com.rediska1114.plugins.posthog;

import com.getcapacitor.Logger;

public class CapacitorPosthog {

    public String echo(String value) {
        Logger.info("Echo", value);
        return value;
    }
}
