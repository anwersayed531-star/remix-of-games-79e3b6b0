import { describe, it, expect } from "vitest";
import { compressSDP, decompressSDP } from "@/lib/sdpUtils";
const sdp = `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=ice-ufrag:abcd\r\na=ice-pwd:0123456789abcdefghijklmn\r\na=fingerprint:sha-256 A5:D0:FC:C7:41:F7:82:DB:8B:1E:03:28:CF:AA:54:2B:4D:0C:46:4B:5B:46:89:33:D4:40:C8:80:6E:09:10:CA\r\na=candidate:1 1 udp 2130706431 192.168.43.12 54321 typ host generation 0\r\na=candidate:2 1 udp 2130706431 f1b2c3d4-1111-2222-3333-444455556666.local 51000 typ host\r\na=candidate:3 1 tcp 2130706431 192.168.43.12 9 typ host\r\n`;
describe("sdp codec", () => {
  it("round-trips", () => {
    const code = compressSDP({ type: "offer", sdp });
    const out = decompressSDP(code).sdp!;
    expect(code.length).toBeLessThan(220);
    expect(out).toContain("a=ice-ufrag:abcd");
    expect(out).toContain("a=ice-pwd:0123456789abcdefghijklmn");
    expect(out).toContain("A5:D0:FC:C7:41:F7:82:DB:8B:1E:03:28:CF:AA:54:2B:4D:0C:46:4B:5B:46:89:33:D4:40:C8:80:6E:09:10:CA");
    expect(out).toContain("192.168.43.12 54321 typ host");
    expect(out).toContain("f1b2c3d4-1111-2222-3333-444455556666.local 51000 typ host");
    expect(out).not.toContain(" 9 typ");
    console.log("code length:", code.length);
  });
});
