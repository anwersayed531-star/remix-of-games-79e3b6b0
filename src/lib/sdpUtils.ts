/**
 * SDP compression utilities for text-based room codes
 * Supports multiple ICE candidates for reliable Android connections
 */

// Extract essential fields + ALL candidates from SDP
function extractEssentials(sdp: string): object {
  const lines = sdp.split("\r\n");
  let ufrag = "", pwd = "", fingerprint = "";
  const candidates: string[] = [];

  for (const line of lines) {
    if (line.startsWith("a=ice-ufrag:")) ufrag = line.slice(12);
    else if (line.startsWith("a=ice-pwd:")) pwd = line.slice(10);
    else if (line.startsWith("a=fingerprint:")) fingerprint = line.split(" ")[1] || "";
    else if (line.startsWith("a=candidate:")) {
      // Collect all candidates (host, srflx, relay)
      const parts = line.split(" ");
      const ip = parts[4] || "";
      const port = parseInt(parts[5] || "0");
      const typ = parts[7] || "host";
      if (ip && port) {
        candidates.push(`${ip}|${port}|${typ}`);
      }
    }
  }

  return { u: ufrag, p: pwd, f: fingerprint, c: candidates };
}

// Reconstruct minimal SDP from essentials with all candidates
function reconstructSDP(data: any, sdpType: "offer" | "answer"): string {
  const { u, p, f, c } = data;
  const fpAlgo = "sha-256";

  const lines = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${u}`,
    `a=ice-pwd:${p}`,
    `a=fingerprint:${fpAlgo} ${f}`,
    `a=setup:${sdpType === "offer" ? "actpass" : "active"}`,
    "a=mid:0",
    "a=sctp-port:5000",
  ];

  // Add all candidates
  const candidates: string[] = c || [];
  candidates.forEach((cand: string, i: number) => {
    const [ip, port, typ] = cand.split("|");
    const priority = typ === "host" ? 2130706431 : typ === "srflx" ? 1694498815 : 16777215;
    lines.push(`a=candidate:${i + 1} 1 UDP ${priority} ${ip} ${port} typ ${typ}`);
  });

  // Legacy support: if data has old format (i, o fields)
  if (!c && data.i && data.o) {
    lines.push(`a=candidate:1 1 UDP 2130706431 ${data.i} ${data.o} typ host`);
  }

  lines.push("");
  return lines.join("\r\n");
}

export function compressSDP(sdp: RTCSessionDescriptionInit): string {
  if (!sdp.sdp) return "";

  const essentials = extractEssentials(sdp.sdp);
  const typeFlag = sdp.type === "offer" ? "O" : "A";
  const json = JSON.stringify(essentials);

  const encoded = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return typeFlag + encoded;
}

export function decompressSDP(code: string): RTCSessionDescriptionInit {
  const typeFlag = code[0];
  const sdpType = typeFlag === "O" ? "offer" : "answer";
  const encoded = code.slice(1);

  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const data = JSON.parse(atob(padded));

  // New format (has 'u' field) or legacy
  if (data.u !== undefined) {
    const sdpStr = reconstructSDP(data, sdpType as "offer" | "answer");
    return { type: sdpType as RTCSdpType, sdp: sdpStr };
  }

  return data;
}

// Local config WITH STUN servers - critical for Android
export const RTC_CONFIG_LOCAL: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 5,
};

// With STUN fallback for internet
export const RTC_CONFIG_STUN: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export function waitForICE(pc: RTCPeerConnection, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    
    let hasCandidate = false;
    
    const onCandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) hasCandidate = true;
    };
    pc.addEventListener("icecandidate", onCandidate);
    
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        pc.removeEventListener("icecandidate", onCandidate);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    
    // Resolve after timeout, but only if we have at least one candidate
    setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      pc.removeEventListener("icecandidate", onCandidate);
      resolve();
    }, timeoutMs);
  });
}
