import { useState, useRef, useCallback, useEffect } from "react";
import { compressSDP, decompressSDP, waitForICE, RTC_CONFIG_LOCAL } from "@/lib/sdpUtils";

export type HostStatus = "idle" | "creating" | "waiting" | "connected";

interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  connected: boolean;
  name: string;
}

interface UseP2PHostReturn {
  status: HostStatus;
  peers: { id: string; name: string; connected: boolean }[];
  offerCode: string;
  error: string | null;
  createRoom: () => Promise<void>;
  generateOfferForNext: () => Promise<void>;
  handleAnswer: (answerCode: string) => Promise<void>;
  broadcast: (data: any) => void;
  sendTo: (peerId: string, data: any) => void;
  onMessage: (handler: (peerId: string, data: any) => void) => void;
  onPeerJoin: (handler: (peerId: string) => void) => void;
  onPeerLeave: (handler: (peerId: string) => void) => void;
  disconnect: () => void;
  peerCount: number;
}

let peerIdCounter = 0;

export function useP2PHost(): UseP2PHostReturn {
  const [status, setStatus] = useState<HostStatus>("idle");
  const [offerCode, setOfferCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [peerList, setPeerList] = useState<{ id: string; name: string; connected: boolean }[]>([]);

  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const pendingPCRef = useRef<RTCPeerConnection | null>(null);
  const pendingIdRef = useRef<string>("");
  const messageHandlerRef = useRef<((peerId: string, data: any) => void) | null>(null);
  const joinHandlerRef = useRef<((peerId: string) => void) | null>(null);
  const leaveHandlerRef = useRef<((peerId: string) => void) | null>(null);

  const updatePeerList = useCallback(() => {
    const list = Array.from(peersRef.current.values()).map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
    }));
    setPeerList(list);
  }, []);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG_LOCAL);
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
      if (pc.connectionState === "disconnected") {
        setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            const peer = peersRef.current.get(peerId);
            if (peer) {
              peer.connected = false;
              updatePeerList();
              leaveHandlerRef.current?.(peerId);
            }
          }
        }, 5000);
      }
    };

    return pc;
  }, [updatePeerList]);

  const setupDataChannel = useCallback((peerId: string, channel: RTCDataChannel) => {
    const peer = peersRef.current.get(peerId);
    if (peer) peer.dc = channel;

    channel.onopen = () => {
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.connected = true;
        updatePeerList();
        joinHandlerRef.current?.(peerId);
      }
      setStatus("connected");
    };

    channel.onclose = () => {
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.connected = false;
        updatePeerList();
        leaveHandlerRef.current?.(peerId);
      }
    };

    channel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "__register") {
          const peer = peersRef.current.get(peerId);
          if (peer) {
            peer.name = data.name || `لاعب ${peerId.slice(-2)}`;
            updatePeerList();
          }
          return;
        }
        messageHandlerRef.current?.(peerId, data);
      } catch { /* ignore */ }
    };
  }, [updatePeerList]);

  const generateOffer = useCallback(async () => {
    const peerId = `p${++peerIdCounter}`;
    const pc = createPeerConnection(peerId);
    
    const channel = pc.createDataChannel("game", { ordered: true });
    
    const peerConn: PeerConnection = {
      id: peerId, pc, dc: null, connected: false,
      name: `لاعب ${peerIdCounter}`,
    };
    peersRef.current.set(peerId, peerConn);
    setupDataChannel(peerId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForICE(pc, 5000);

    const fullOffer = pc.localDescription!;
    setOfferCode(compressSDP(fullOffer));
    pendingPCRef.current = pc;
    pendingIdRef.current = peerId;
    updatePeerList();
  }, [createPeerConnection, setupDataChannel, updatePeerList]);

  const createRoom = useCallback(async () => {
    try {
      setStatus("creating");
      setError(null);
      await generateOffer();
      setStatus("waiting");
    } catch {
      setStatus("idle");
      setError("فشل في إنشاء الغرفة");
    }
  }, [generateOffer]);

  const generateOfferForNext = useCallback(async () => {
    try {
      setError(null);
      await generateOffer();
    } catch {
      setError("فشل في إنشاء عرض جديد");
    }
  }, [generateOffer]);

  const handleAnswer = useCallback(async (answerCode: string) => {
    try {
      const pc = pendingPCRef.current;
      if (!pc) throw new Error("No pending connection");
      const answer = decompressSDP(answerCode.trim());
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      pendingPCRef.current = null;
    } catch {
      setError("فشل في إتمام الاتصال");
    }
  }, []);

  const broadcast = useCallback((data: any) => {
    const msg = JSON.stringify(data);
    for (const peer of peersRef.current.values()) {
      if (peer.dc?.readyState === "open") peer.dc.send(msg);
    }
  }, []);

  const sendTo = useCallback((peerId: string, data: any) => {
    const peer = peersRef.current.get(peerId);
    if (peer?.dc?.readyState === "open") peer.dc.send(JSON.stringify(data));
  }, []);

  const onMessage = useCallback((handler: (peerId: string, data: any) => void) => {
    messageHandlerRef.current = handler;
  }, []);
  const onPeerJoin = useCallback((handler: (peerId: string) => void) => {
    joinHandlerRef.current = handler;
  }, []);
  const onPeerLeave = useCallback((handler: (peerId: string) => void) => {
    leaveHandlerRef.current = handler;
  }, []);

  const disconnect = useCallback(() => {
    for (const peer of peersRef.current.values()) {
      peer.dc?.close();
      peer.pc.close();
    }
    peersRef.current.clear();
    pendingPCRef.current = null;
    setStatus("idle");
    setOfferCode("");
    setError(null);
    setPeerList([]);
  }, []);

  useEffect(() => {
    return () => {
      for (const peer of peersRef.current.values()) {
        peer.dc?.close();
        peer.pc.close();
      }
      peersRef.current.clear();
    };
  }, []);

  return {
    status, peers: peerList, offerCode, error,
    createRoom, generateOfferForNext: generateOffer,
    handleAnswer, broadcast, sendTo, onMessage,
    onPeerJoin, onPeerLeave, disconnect,
    peerCount: peerList.filter(p => p.connected).length,
  };
}
