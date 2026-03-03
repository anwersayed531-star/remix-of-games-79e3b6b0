/**
 * SDP compression utilities for text-based room codes
 * Produces shorter codes by stripping unnecessary SDP lines
 * and using efficient encoding
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
  "a=msid-semantic:",
  "a=group:",
  "a=bundle-only",
  "a=sctpmap:",
  "a=max-message-size:",
  "t=",
  "s=",
  "a=setup:",
  "a=inactive",
  "a=sendrecv",
  "a=sendonly",
  "a=recvonly",
];

// Extract only essential fields from SDP for local connections
function extractEssentials(sdp: string): object {
  const lines = sdp.split("\r\n");
  let ufrag = "", pwd = "", fingerprint = "", candidateIP = "", candidatePort = 0;
  let type = ""; // offer or answer

  for (const line of lines) {
    if (line.startsWith("a=ice-ufrag:")) ufrag = line.slice(12);
    else if (line.startsWith("a=ice-pwd:")) pwd = line.slice(10);
    else if (line.startsWith("a=fingerprint:")) fingerprint = line.split(" ")[1] || "";
    else if (line.startsWith("a=candidate:") && line.includes("typ host")) {
      const parts = line.split(" ");
      candidateIP = parts[4] || "";
      candidatePort = parseInt(parts[5] || "0");
    }
  }

  return { u: ufrag, p: pwd, f: fingerprint, i: candidateIP, o: candidatePort };
}

// Reconstruct minimal SDP from essentials
function reconstructSDP(data: any, sdpType: "offer" | "answer"): string {
  const { u, p, f, i, o } = data;
  const fpAlgo = "sha-256";
  
  // Build minimal SDP that WebRTC can accept
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
    `a=candidate:1 1 UDP 2130706431 ${i} ${o} typ host`,
    "",
  ];
  return lines.join("\r\n");
}

export function minifySDP(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
  if (!sdp.sdp) return sdp;
  
  const lines = sdp.sdp.split("\r\n");
  const filtered = lines.filter(line => {
    return !STRIP_PREFIXES.some(prefix => line.startsWith(prefix));
  });
  
  return { type: sdp.type, sdp: filtered.join("\r\n") };
}

export function compressSDP(sdp: RTCSessionDescriptionInit): string {
  if (!sdp.sdp) return "";
  
  // Extract only essential fields and encode compactly
  const essentials = extractEssentials(sdp.sdp);
  const typeFlag = sdp.type === "offer" ? "O" : "A";
  const json = JSON.stringify(essentials);
  
  // Use base64url encoding with type prefix
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
  
  // Check if it's the new compact format (has 'u' field) or legacy full SDP
  if (data.u !== undefined) {
    const sdpStr = reconstructSDP(data, sdpType as "offer" | "answer");
    return { type: sdpType as RTCSdpType, sdp: sdpStr };
  }
  
  // Legacy format fallback
  return data;
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
