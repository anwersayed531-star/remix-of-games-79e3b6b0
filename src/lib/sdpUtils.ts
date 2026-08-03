/**
 * Ultra-compact SDP codec for offline (LAN / WiFi hotspot) QR pairing.
 *
 * The old JSON+base64 payload produced huge QR codes that phones could not
 * read. Here we pack only what is strictly needed into raw bytes:
 *   ufrag | pwd | dtls fingerprint (32 raw bytes) | candidates
 * A candidate is either an IPv4 host (6 bytes) or an mDNS hostname
 * (needed because Android WebView hides local IPs behind *.local).
 */

// ---------- binary helpers ----------

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/:/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

// ---------- parsing ----------

interface Cand {
  kind: "ip4" | "host";
  addr: string;
  port: number;
  typ: "host" | "srflx" | "relay";
}

interface Essentials {
  ufrag: string;
  pwd: string;
  fp: Uint8Array;
  cands: Cand[];
}

const isIPv4 = (a: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a);

function parseSDP(sdp: string): Essentials {
  const lines = sdp.split(/\r?\n/);
  let ufrag = "", pwd = "", fpHex = "";
  const cands: Cand[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (line.startsWith("a=ice-ufrag:")) ufrag = line.slice(12).trim();
    else if (line.startsWith("a=ice-pwd:")) pwd = line.slice(10).trim();
    else if (line.startsWith("a=fingerprint:")) fpHex = (line.split(" ")[1] || "").trim();
    else if (line.includes("candidate:")) {
      const parts = line.trim().replace(/^a=/, "").split(" ");
      const addr = parts[4];
      const port = parseInt(parts[5] || "0", 10);
      const typIdx = parts.indexOf("typ");
      const typ = (typIdx > -1 ? parts[typIdx + 1] : "host") as Cand["typ"];
      const proto = (parts[2] || "").toLowerCase();
      if (!addr || !port || proto !== "udp") continue;
      if (addr.includes(":")) continue; // skip IPv6 (huge, rarely useful on LAN)
      const key = `${addr}:${port}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cands.push({ kind: isIPv4(addr) ? "ip4" : "host", addr, port, typ });
    }
  }

  // Prefer LAN host candidates first, keep the payload small.
  const order = { host: 0, srflx: 1, relay: 2 } as const;
  cands.sort((a, b) => order[a.typ] - order[b.typ]);
  const ip4 = cands.filter((c) => c.kind === "ip4").slice(0, 4);
  const hosts = cands.filter((c) => c.kind === "host").slice(0, 2);

  return { ufrag, pwd, fp: hexToBytes(fpHex), cands: [...ip4, ...hosts] };
}

// ---------- encode / decode ----------

const TYP_CODE = { host: 0, srflx: 1, relay: 2 } as const;
const TYP_NAME = ["host", "srflx", "relay"] as const;

function encode(e: Essentials): Uint8Array {
  const enc = new TextEncoder();
  const u = enc.encode(e.ufrag);
  const p = enc.encode(e.pwd);
  const chunks: number[] = [];
  chunks.push(u.length, ...u, p.length, ...p);
  const fp = e.fp.length === 32 ? e.fp : new Uint8Array(32);
  chunks.push(...fp);
  chunks.push(e.cands.length);
  for (const c of e.cands) {
    const flag = (c.kind === "ip4" ? 0 : 1) | (TYP_CODE[c.typ] << 1);
    chunks.push(flag);
    if (c.kind === "ip4") {
      chunks.push(...c.addr.split(".").map((n) => parseInt(n, 10) & 255));
    } else {
      const h = enc.encode(c.addr);
      chunks.push(h.length, ...h);
    }
    chunks.push((c.port >> 8) & 255, c.port & 255);
  }
  return new Uint8Array(chunks);
}

function decode(bytes: Uint8Array): Essentials {
  const dec = new TextDecoder();
  let i = 0;
  const uLen = bytes[i++];
  const ufrag = dec.decode(bytes.slice(i, i + uLen)); i += uLen;
  const pLen = bytes[i++];
  const pwd = dec.decode(bytes.slice(i, i + pLen)); i += pLen;
  const fp = bytes.slice(i, i + 32); i += 32;
  const count = bytes[i++];
  const cands: Cand[] = [];
  for (let n = 0; n < count; n++) {
    const flag = bytes[i++];
    const kind = (flag & 1) === 0 ? "ip4" : "host";
    const typ = TYP_NAME[(flag >> 1) & 3] || "host";
    let addr = "";
    if (kind === "ip4") {
      addr = `${bytes[i]}.${bytes[i + 1]}.${bytes[i + 2]}.${bytes[i + 3]}`;
      i += 4;
    } else {
      const hLen = bytes[i++];
      addr = dec.decode(bytes.slice(i, i + hLen)); i += hLen;
    }
    const port = (bytes[i] << 8) | bytes[i + 1]; i += 2;
    cands.push({ kind, addr, port, typ: typ as Cand["typ"] });
  }
  return { ufrag, pwd, fp, cands };
}

function buildSDP(e: Essentials, type: "offer" | "answer"): string {
  const lines = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${e.ufrag}`,
    `a=ice-pwd:${e.pwd}`,
    "a=ice-options:trickle",
    `a=fingerprint:sha-256 ${bytesToHex(e.fp)}`,
    `a=setup:${type === "offer" ? "actpass" : "active"}`,
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
  ];

  e.cands.forEach((c, idx) => {
    const priority = c.typ === "host" ? 2130706431 : c.typ === "srflx" ? 1694498815 : 16777215;
    lines.push(
      `a=candidate:${idx + 1} 1 udp ${priority} ${c.addr} ${c.port} typ ${c.typ} generation 0`
    );
  });
  lines.push("a=end-of-candidates", "");
  return lines.join("\r\n");
}

export function compressSDP(sdp: RTCSessionDescriptionInit): string {
  if (!sdp.sdp) return "";
  const bytes = encode(parseSDP(sdp.sdp));
  return (sdp.type === "offer" ? "O" : "A") + toBase64Url(bytes);
}

export function decompressSDP(code: string): RTCSessionDescriptionInit {
  const clean = code.trim();
  const type: "offer" | "answer" = clean[0] === "O" ? "offer" : "answer";
  const bytes = fromBase64Url(clean.slice(1));
  return { type: type as RTCSdpType, sdp: buildSDP(decode(bytes), type) };
}

// ---------- RTC config ----------

/**
 * Offline-first: no STUN (unreachable without internet and it only delays
 * gathering). Everything happens over the local WiFi / hotspot.
 */
export const RTC_CONFIG_LOCAL: RTCConfiguration = {
  iceServers: [],
  iceCandidatePoolSize: 0,
};

export const RTC_CONFIG_STUN: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  iceCandidatePoolSize: 2,
};

/**
 * Wait for ICE gathering, but do not block the UI: as soon as we have a usable
 * local candidate we give the gatherer a short grace period and continue.
 */
export function waitForICE(pc: RTCPeerConnection, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();

    let done = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (graceTimer) clearTimeout(graceTimer);
      clearTimeout(hardTimer);
      pc.removeEventListener("icecandidate", onCandidate);
      pc.removeEventListener("icegatheringstatechange", onState);
      resolve();
    };

    const onCandidate = (e: RTCPeerConnectionIceEvent) => {
      if (!e.candidate) return finish();
      if (!graceTimer) graceTimer = setTimeout(finish, 1200);
    };

    const onState = () => {
      if (pc.iceGatheringState === "complete") finish();
    };

    const hardTimer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icecandidate", onCandidate);
    pc.addEventListener("icegatheringstatechange", onState);
  });
}
