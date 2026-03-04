import { useState, useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import WifiDirect, { type WifiDirectPeer } from "@/plugins/WifiDirectPlugin";

export type WifiDirectStatus = "idle" | "discovering" | "waiting" | "connecting" | "connected" | "failed";
export type WifiDirectRole = "host" | "guest" | null;

interface UseWifiDirectReturn {
  available: boolean;
  status: WifiDirectStatus;
  role: WifiDirectRole;
  peers: WifiDirectPeer[];
  error: string | null;
  deviceName: string;
  createGroup: () => Promise<void>;
  discover: () => Promise<void>;
  connectToPeer: (address: string) => Promise<void>;
  send: (data: any) => void;
  onMessage: (handler: (data: any) => void) => void;
  disconnect: () => Promise<void>;
}

export function useWifiDirect(): UseWifiDirectReturn {
  const available = Capacitor.isNativePlatform();
  const [status, setStatus] = useState<WifiDirectStatus>("idle");
  const [role, setRole] = useState<WifiDirectRole>(null);
  const [peers, setPeers] = useState<WifiDirectPeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("Player");
  const messageHandlerRef = useRef<((data: any) => void) | null>(null);

  useEffect(() => {
    if (!available) return;

    const listeners: Promise<any>[] = [];

    listeners.push(
      WifiDirect.addListener("statusChange", ({ status: s }) => {
        setStatus(s as WifiDirectStatus);
        if (s === "failed") setError("فشل الاتصال");
      })
    );

    listeners.push(
      WifiDirect.addListener("peersFound", ({ peers: p }) => {
        setPeers(p);
      })
    );

    listeners.push(
      WifiDirect.addListener("message", ({ message }) => {
        try {
          const data = JSON.parse(message);
          messageHandlerRef.current?.(data);
        } catch { /* ignore non-JSON */ }
      })
    );

    WifiDirect.getDeviceName()
      .then(({ name }) => setDeviceName(name))
      .catch(() => {});

    return () => {
      WifiDirect.removeAllListeners();
    };
  }, [available]);

  const createGroup = useCallback(async () => {
    if (!available) return;
    try {
      setError(null);
      setRole("host");
      setStatus("waiting");
      await WifiDirect.createGroup();
    } catch (e: any) {
      setError(e?.message || "فشل إنشاء المجموعة");
      setStatus("failed");
    }
  }, [available]);

  const discover = useCallback(async () => {
    if (!available) return;
    try {
      setError(null);
      setRole("guest");
      setStatus("discovering");
      await WifiDirect.discover();
    } catch (e: any) {
      setError(e?.message || "فشل البحث");
      setStatus("failed");
    }
  }, [available]);

  const connectToPeer = useCallback(async (address: string) => {
    if (!available) return;
    try {
      setError(null);
      setStatus("connecting");
      await WifiDirect.connectToPeer({ address });
    } catch (e: any) {
      setError(e?.message || "فشل الاتصال");
      setStatus("failed");
    }
  }, [available]);

  const send = useCallback((data: any) => {
    if (!available) return;
    WifiDirect.send({ data: JSON.stringify(data) }).catch(() => {});
  }, [available]);

  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  const disconnect = useCallback(async () => {
    if (!available) return;
    try {
      await WifiDirect.disconnect();
    } catch { /* ignore */ }
    setStatus("idle");
    setRole(null);
    setPeers([]);
    setError(null);
  }, [available]);

  return {
    available, status, role, peers, error, deviceName,
    createGroup, discover, connectToPeer, send, onMessage, disconnect,
  };
}
