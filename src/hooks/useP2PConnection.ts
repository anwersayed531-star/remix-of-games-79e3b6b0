import { useState, useRef, useCallback, useEffect } from "react";
import { compressSDP, decompressSDP, waitForICE, RTC_CONFIG_LOCAL } from "@/lib/sdpUtils";

export type ConnectionStatus = "idle" | "creating" | "waiting" | "connecting" | "connected" | "failed";
export type Role = "host" | "guest" | null;

interface UseP2PConnectionReturn {
  status: ConnectionStatus;
  role: Role;
  localCode: string;
  error: string | null;
  createRoom: () => Promise<void>;
  joinRoom: (offerCode: string) => Promise<void>;
  completeConnection: (answerCode: string) => Promise<void>;
  sendMessage: (data: any) => void;
  onMessage: (handler: (data: any) => void) => void;
  disconnect: () => void;
}

export function useP2PConnection(): UseP2PConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [role, setRole] = useState<Role>(null);
  const [localCode, setLocalCode] = useState("");
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

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dcRef.current = channel;
    channel.onopen = () => setStatus("connected");
    channel.onclose = () => { setStatus("idle"); cleanup(); };
    channel.onmessage = (e) => {
      try { messageHandlerRef.current?.(JSON.parse(e.data)); } catch {}
    };
  }, [cleanup]);

  const createPC = useCallback(() => {
    cleanup();
    const pc = new RTCPeerConnection(RTC_CONFIG_LOCAL);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
      if (pc.connectionState === "disconnected") {
        setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            setStatus("failed");
            setError("انقطع الاتصال - حاول مرة أخرى");
          }
        }, 5000);
      }
    };

    return pc;
  }, [cleanup]);

  const createRoom = useCallback(async () => {
    try {
      setStatus("creating");
      setError(null);
      const pc = createPC();
      const channel = pc.createDataChannel("game", { ordered: true });
      setupDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForICE(pc, 5000);

      setLocalCode(compressSDP(pc.localDescription!));
      setRole("host");
      setStatus("waiting");
    } catch {
      setStatus("failed");
      setError("فشل في إنشاء الغرفة");
    }
  }, [createPC, setupDataChannel]);

  const joinRoom = useCallback(async (offerCode: string) => {
    try {
      setStatus("connecting");
      setError(null);
      const pc = createPC();
      pc.ondatachannel = (e) => setupDataChannel(e.channel);

      const offer = decompressSDP(offerCode.trim());
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForICE(pc, 5000);

      setLocalCode(compressSDP(pc.localDescription!));
      setRole("guest");
      setStatus("waiting");
    } catch {
      setStatus("failed");
      setError("رمز الغرفة غير صالح");
    }
  }, [createPC, setupDataChannel]);

  const completeConnection = useCallback(async (answerCode: string) => {
    try {
      setStatus("connecting");
      const pc = pcRef.current;
      if (!pc) throw new Error("No connection");
      await pc.setRemoteDescription(new RTCSessionDescription(decompressSDP(answerCode.trim())));
    } catch {
      setStatus("failed");
      setError("فشل في إتمام الاتصال");
    }
  }, []);

  const sendMessage = useCallback((data: any) => {
    if (dcRef.current?.readyState === "open") dcRef.current.send(JSON.stringify(data));
  }, []);

  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("idle");
    setRole(null);
    setLocalCode("");
    setError(null);
  }, [cleanup]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return { status, role, localCode, error, createRoom, joinRoom, completeConnection, sendMessage, onMessage, disconnect };
}
