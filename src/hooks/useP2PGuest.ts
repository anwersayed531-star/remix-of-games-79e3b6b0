import { useState, useRef, useCallback, useEffect } from "react";

export type GuestStatus = "idle" | "connecting" | "waiting" | "connected" | "failed";

interface UseP2PGuestReturn {
  status: GuestStatus;
  answerCode: string;
  error: string | null;
  joinRoom: (offerCode: string) => Promise<void>;
  sendMessage: (data: any) => void;
  onMessage: (handler: (data: any) => void) => void;
  disconnect: () => void;
  registerName: (name: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

function compressSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decompressSDP(code: string): RTCSessionDescriptionInit {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

function waitForICE(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 10000);
  });
}

export function useP2PGuest(): UseP2PGuestReturn {
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [answerCode, setAnswerCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const messageHandlerRef = useRef<((data: any) => void) | null>(null);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
  }, []);

  const joinRoom = useCallback(async (offerCode: string) => {
    try {
      setStatus("connecting");
      setError(null);
      cleanup();

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
        if (pc.connectionState === "disconnected") {
          setTimeout(() => {
            if (pc.connectionState === "disconnected") {
              setStatus("failed");
              setError("انقطع الاتصال");
            }
          }, 5000);
        }
      };

      pc.ondatachannel = (e) => {
        const channel = e.channel;
        dcRef.current = channel;
        channel.onopen = () => setStatus("connected");
        channel.onclose = () => {
          setStatus("idle");
          cleanup();
        };
        channel.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            messageHandlerRef.current?.(data);
          } catch { /* ignore */ }
        };
      };

      const offer = decompressSDP(offerCode.trim());
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForICE(pc);

      const fullAnswer = pc.localDescription!;
      setAnswerCode(compressSDP(fullAnswer));
      setStatus("waiting");
    } catch {
      setStatus("failed");
      setError("رمز الغرفة غير صالح");
    }
  }, [cleanup]);

  const sendMessage = useCallback((data: any) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(data));
    }
  }, []);

  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  const registerName = useCallback((name: string) => {
    sendMessage({ type: "__register", name });
  }, [sendMessage]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("idle");
    setAnswerCode("");
    setError(null);
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    status,
    answerCode,
    error,
    joinRoom,
    sendMessage,
    onMessage,
    disconnect,
    registerName,
  };
}
