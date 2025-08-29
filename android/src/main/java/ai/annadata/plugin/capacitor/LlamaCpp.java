package ai.annadata.plugin.capacitor;

import android.util.Log;

public class LlamaCpp {

    public String echo(String value) {
        Log.i("Echo", value);
        return value;
    }
}
