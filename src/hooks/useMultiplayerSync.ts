import { useCallback, useEffect, useRef, useState } from "react";
import { useP2PHost, type HostStatus } from "./useP2PHost";
import { useP2PGuest, type GuestStatus } from "./useP2PGuest";

export type ConnectionStatus = "idle" | "creating" | "waiting" | "connecting" | "connected" | "failed";
export type Role = "host" | "guest" | null;

interface GameMessage {
  type: "state" | "action" | "reset" | "ping" | "pong";
  payload?: any;
  timestamp: number;
}

interface UseMultiplayerSyncReturn {
  status: ConnectionStatus;
  role: Role;
  localCode: string;
  answerCode: string;
  error: string | null;
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  handleAnswer: (code: string) => Promise<void>;
  generateOfferForNext: () => Promise<void>;
  disconnect: () => void;
  registerName: (name: string) => void;
  // Game sync
  sendGameState: (state: any) => void;
  sendAction: (action: any) => void;
  sendReset: () => void;
  onGameState: (handler: (state: any) => void) => void;
  onAction: (handler: (action: any) => void) => void;
  onReset: (handler: () => void) => void;
  isMyTurn: (currentTurn: string, hostValue: string, guestValue: string) => boolean;
  // Multi-peer
  peerCount: number;
  peers: { id: string; name: string; connected: boolean }[];
  onPeerJoin: (handler: (peerId: string) => void) => void;
  onPeerLeave: (handler: (peerId: string) => void) => void;
}

export function useMultiplayerSync(): UseMultiplayerSyncReturn {
  const host = useP2PHost();
  const guest = useP2PGuest();
  const [role, setRole] = useState<Role>(null);

  const gameStateHandlerRef = useRef<((state: any) => void) | null>(null);
  const actionHandlerRef = useRef<((action: any) => void) | null>(null);
  const resetHandlerRef = useRef<(() => void) | null>(null);

  // Map host/guest status to unified status
  const getStatus = useCallback((): ConnectionStatus => {
    if (role === "host") {
      const map: Record<HostStatus, ConnectionStatus> = {
        idle: "idle",
        creating: "creating",
        waiting: "waiting",
        connected: "connected",
      };
      return map[host.status] || "idle";
    }
    if (role === "guest") {
      const map: Record<GuestStatus, ConnectionStatus> = {
        idle: "idle",
        connecting: "connecting",
        waiting: "waiting",
        connected: "connected",
        failed: "failed",
      };
      return map[guest.status] || "idle";
    }
    return "idle";
  }, [role, host.status, guest.status]);

  const status = getStatus();

  // Handle messages from host perspective (from peers)
  useEffect(() => {
    if (role !== "host") return;
    host.onMessage((_peerId: string, msg: GameMessage) => {
      switch (msg.type) {
        case "state":
          gameStateHandlerRef.current?.(msg.payload);
          break;
        case "action":
          actionHandlerRef.current?.(msg.payload);
          // Broadcast action to all other peers
          host.broadcast({ ...msg });
          break;
        case "reset":
          resetHandlerRef.current?.();
          host.broadcast(msg);
          break;
        case "ping":
          // handled by host internally
          break;
      }
    });
  }, [role, host]);

  // Handle messages from guest perspective (from host)
  useEffect(() => {
    if (role !== "guest") return;
    guest.onMessage((msg: GameMessage) => {
      switch (msg.type) {
        case "state":
          gameStateHandlerRef.current?.(msg.payload);
          break;
        case "action":
          actionHandlerRef.current?.(msg.payload);
          break;
        case "reset":
          resetHandlerRef.current?.();
          break;
        case "ping":
          guest.sendMessage({ type: "pong", timestamp: Date.now() });
          break;
      }
    });
  }, [role, guest]);

  const createRoom = useCallback(async () => {
    setRole("host");
    await host.createRoom();
  }, [host]);

  const joinRoom = useCallback(async (code: string) => {
    setRole("guest");
    await guest.joinRoom(code);
  }, [guest]);

  const handleAnswer = useCallback(async (code: string) => {
    await host.handleAnswer(code);
  }, [host]);

  const generateOfferForNext = useCallback(async () => {
    await host.generateOfferForNext();
  }, [host]);

  const sendGameState = useCallback((state: any) => {
    const msg: GameMessage = { type: "state", payload: state, timestamp: Date.now() };
    if (role === "host") {
      host.broadcast(msg);
    } else {
      guest.sendMessage(msg);
    }
  }, [role, host, guest]);

  const sendAction = useCallback((action: any) => {
    const msg: GameMessage = { type: "action", payload: action, timestamp: Date.now() };
    if (role === "host") {
      host.broadcast(msg);
    } else {
      guest.sendMessage(msg);
    }
  }, [role, host, guest]);

  const sendReset = useCallback(() => {
    const msg: GameMessage = { type: "reset", timestamp: Date.now() };
    if (role === "host") {
      host.broadcast(msg);
    } else {
      guest.sendMessage(msg);
    }
  }, [role, host, guest]);

  const onGameState = useCallback((handler: (state: any) => void) => {
    gameStateHandlerRef.current = handler;
  }, []);

  const onAction = useCallback((handler: (action: any) => void) => {
    actionHandlerRef.current = handler;
  }, []);

  const onReset = useCallback((handler: () => void) => {
    resetHandlerRef.current = handler;
  }, []);

  const isMyTurn = useCallback((currentTurn: string, hostValue: string, guestValue: string) => {
    if (role === "host") return currentTurn === hostValue;
    if (role === "guest") return currentTurn === guestValue;
    return false;
  }, [role]);

  const disconnect = useCallback(() => {
    if (role === "host") host.disconnect();
    if (role === "guest") guest.disconnect();
    setRole(null);
  }, [role, host, guest]);

  const registerName = useCallback((name: string) => {
    if (role === "guest") guest.registerName(name);
  }, [role, guest]);

  return {
    status,
    role,
    localCode: role === "host" ? host.offerCode : "",
    answerCode: role === "guest" ? guest.answerCode : "",
    error: role === "host" ? host.error : role === "guest" ? guest.error : null,
    createRoom,
    joinRoom,
    handleAnswer,
    generateOfferForNext,
    disconnect,
    registerName,
    sendGameState,
    sendAction,
    sendReset,
    onGameState,
    onAction,
    onReset,
    isMyTurn,
    peerCount: role === "host" ? host.peerCount : role === "guest" ? 1 : 0,
    peers: role === "host" ? host.peers : [],
    onPeerJoin: host.onPeerJoin,
    onPeerLeave: host.onPeerLeave,
  };
}
