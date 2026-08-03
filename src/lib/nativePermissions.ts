import { Capacitor, registerPlugin } from "@capacitor/core";

interface CameraPermPlugin {
  checkPermissions(): Promise<{ camera: string }>;
  requestPermissions(options?: { permissions: string[] }): Promise<{ camera: string }>;
}

const CameraPerm = registerPlugin<CameraPermPlugin>("Camera");

/**
 * On Android the WebView can only open getUserMedia after the app itself has
 * been granted the runtime CAMERA permission. Ask for it before scanning.
 */
export async function ensureCameraPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const current = await CameraPerm.checkPermissions();
    if (current.camera === "granted" || current.camera === "limited") return true;
    const result = await CameraPerm.requestPermissions({ permissions: ["camera"] });
    return result.camera === "granted" || result.camera === "limited";
  } catch {
    // Plugin missing → let the WebView prompt handle it
    return true;
  }
}
