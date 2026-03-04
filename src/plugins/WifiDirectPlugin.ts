import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface WifiDirectPeer {
  name: string;
  address: string;
  status: number;
}

export interface WifiDirectPlugin {
  createGroup(): Promise<{ success: boolean }>;
  discover(): Promise<{ success: boolean }>;
  connectToPeer(options: { address: string }): Promise<{ success: boolean }>;
  send(options: { data: string }): Promise<{ sent: boolean }>;
  disconnect(): Promise<{ success: boolean }>;
  getDeviceName(): Promise<{ name: string }>;

  addListener(event: "statusChange", handler: (data: { status: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "peersFound", handler: (data: { peers: WifiDirectPeer[] }) => void): Promise<PluginListenerHandle>;
  addListener(event: "message", handler: (data: { message: string; from: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "peerConnected", handler: (data: { address: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "peerDisconnected", handler: (data: { address: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const WifiDirect = registerPlugin<WifiDirectPlugin>("WifiDirect");

export default WifiDirect;
