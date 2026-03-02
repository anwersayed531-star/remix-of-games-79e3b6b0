import { useState, useRef, useCallback, useEffect } from "react";
import { compressSDP, decompressSDP, waitForICE, RTC_CONFIG_LOCAL } from "@/lib/sdpUtils";

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

      const pc = new RTCPeerConnection(RTC_CONFIG_LOCAL);
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
        channel.onclose = () => { setStatus("idle"); cleanup(); };
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
      await waitForICE(pc, 5000);

      const fullAnswer = pc.localDescription!;
      setAnswerCode(compressSDP(fullAnswer));
      setStatus("waiting");
    } catch {
      setStatus("failed");
      setError("رمز الغرفة غير صالح");
    }
  }, [cleanup]);

  const sendMessage = useCallback((data: any) => {
    if (dcRef.current?.readyState === "open") dcRef.current.send(JSON.stringify(data));
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

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return { status, answerCode, error, joinRoom, sendMessage, onMessage, disconnect, registerName };
}
