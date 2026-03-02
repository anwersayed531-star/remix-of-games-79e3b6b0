/**
 * SDP minification utilities for smaller QR codes
 */

// Lines to strip from SDP to reduce size
const STRIP_PREFIXES = [
  "a=extmap:",
  "a=rtcp-fb:",
  "a=fmtp:",
  "a=rtpmap:",
  "a=ssrc:",
  "a=msid:",
  "a=mid:",
  "a=rtcp:",
  "a=ice-options:",
  "a=extmap-allow-mixed",
];

export function minifySDP(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
  if (!sdp.sdp) return sdp;
  
  const lines = sdp.sdp.split("\r\n");
  const filtered = lines.filter(line => {
    return !STRIP_PREFIXES.some(prefix => line.startsWith(prefix));
  });
  
  return { type: sdp.type, sdp: filtered.join("\r\n") };
}

export function compressSDP(sdp: RTCSessionDescriptionInit): string {
  const minified = minifySDP(sdp);
  return btoa(JSON.stringify(minified))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decompressSDP(code: string): RTCSessionDescriptionInit {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

// Local-first RTC config - works offline on same network
export const RTC_CONFIG_LOCAL: RTCConfiguration = {
  iceServers: [],
  iceCandidatePoolSize: 2,
};

// With STUN fallback for internet
export const RTC_CONFIG_STUN: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export function waitForICE(pc: RTCPeerConnection, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, timeoutMs);
  });
}
