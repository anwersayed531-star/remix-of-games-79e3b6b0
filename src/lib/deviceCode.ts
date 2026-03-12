const DEVICE_CODE_KEY = "gamehub_device_code";
const DEVICE_NAME_KEY = "gamehub_device_name";

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

export function getDeviceCode(): string {
  let code = localStorage.getItem(DEVICE_CODE_KEY);
  if (!code) {
    code = generateCode(6);
    localStorage.setItem(DEVICE_CODE_KEY, code);
  }
  return code;
}

export function getDeviceName(): string {
  return localStorage.getItem(DEVICE_NAME_KEY) || "";
}

export function setDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name);
}
