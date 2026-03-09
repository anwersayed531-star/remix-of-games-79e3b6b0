/**
 * This script patches MainActivity.java to register the WifiDirectPlugin.
 * Run after `npx cap add android` in the build workflow.
 */
const fs = require("fs");
const path = require("path");

const mainActivityPath = path.join(
  __dirname, "..", "android", "app", "src", "main", "java", "com", "sayed", "gamehub", "MainActivity.java"
);

const pluginDir = path.join(
  __dirname, "..", "android", "app", "src", "main", "java", "com", "sayed", "gamehub", "plugins"
);

// 1. Copy plugin Java file
if (!fs.existsSync(pluginDir)) {
  fs.mkdirSync(pluginDir, { recursive: true });
}
fs.copyFileSync(
  path.join(__dirname, "WifiDirectPlugin.java"),
  path.join(pluginDir, "WifiDirectPlugin.java")
);
console.log("✅ WifiDirectPlugin.java copied");

// 2. Patch MainActivity.java to register the plugin
let mainActivity = fs.readFileSync(mainActivityPath, "utf8");

const importLine = "import com.sayed.gamehub.plugins.WifiDirectPlugin;";
const registerLine = "    this.registerPlugin(WifiDirectPlugin.class);";

if (!mainActivity.includes("WifiDirectPlugin")) {
  // Add import
  mainActivity = mainActivity.replace(
    "import com.getcapacitor.BridgeActivity;",
    "import com.getcapacitor.BridgeActivity;\n" + importLine
  );

  // Add registration in onCreate or create it
  if (mainActivity.includes("onCreate")) {
    // Add after super.onCreate
    mainActivity = mainActivity.replace(
      "super.onCreate(savedInstanceState);",
      "super.onCreate(savedInstanceState);\n" + registerLine
    );
  } else {
    // Add onCreate method
    mainActivity = mainActivity.replace(
      "public class MainActivity extends BridgeActivity {",
      `public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
${registerLine}
    }`
    );
  }

  fs.writeFileSync(mainActivityPath, mainActivity);
  console.log("✅ MainActivity.java patched");
} else {
  console.log("ℹ️ MainActivity.java already patched");
}

// 3. Add permissions to AndroidManifest.xml
const manifestPath = path.join(
  __dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml"
);

let manifest = fs.readFileSync(manifestPath, "utf8");
const permissions = [
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.NEARBY_WIFI_DEVICES',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CAMERA',
];

let modified = false;
for (const perm of permissions) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(
      '<application',
      `    <uses-permission android:name="${perm}" />\n    <application`
    );
    modified = true;
  }
}

if (modified) {
  fs.writeFileSync(manifestPath, manifest);
  console.log("✅ AndroidManifest.xml patched with WiFi Direct permissions");
} else {
  console.log("ℹ️ Permissions already present");
}
