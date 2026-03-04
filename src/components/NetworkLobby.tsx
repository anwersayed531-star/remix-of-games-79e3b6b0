import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Radio, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MultiplayerLobby from "@/components/MultiplayerLobby";
import WifiDirectLobby from "@/components/WifiDirectLobby";
import { useWifiDirect } from "@/hooks/useWifiDirect";
import type { ConnectionStatus, Role } from "@/hooks/useMultiplayerSync";

type ConnectionMethod = "choose" | "wifi-direct" | "code";

interface NetworkLobbyProps {
  // Code-based (existing) props
  status: ConnectionStatus;
  role: Role;
  localCode: string;
  answerCode?: string;
  error: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onHandleAnswer?: (code: string) => void;
  onGenerateNext?: () => void;
  onDisconnect: () => void;
  onBack: () => void;
  gameName: string;
  peerCount?: number;
  peers?: { id: string; name: string; connected: boolean }[];
  onCompleteConnection?: (code: string) => void;
  // WiFi Direct message bridge
  onWifiDirectMessage?: (handler: (data: any) => void) => void;
  onWifiDirectSend?: (data: any) => void;
}

const NetworkLobby = (props: NetworkLobbyProps) => {
  const isNative = Capacitor.isNativePlatform();
  const [method, setMethod] = useState<ConnectionMethod>(isNative ? "choose" : "code");
  const wifi = useWifiDirect();

  // If connected via WiFi Direct, show connected state
  if (method === "wifi-direct" && wifi.status === "connected") {
    return (
      <WifiDirectLobby
        status={wifi.status}
        role={wifi.role}
        peers={wifi.peers}
        error={wifi.error}
        deviceName={wifi.deviceName}
        onCreateGroup={wifi.createGroup}
        onDiscover={wifi.discover}
        onConnectToPeer={wifi.connectToPeer}
        onDisconnect={async () => { await wifi.disconnect(); setMethod("choose"); }}
        onBack={() => { wifi.disconnect(); setMethod("choose"); }}
        gameName={props.gameName}
      />
    );
  }

  // If using code-based or already in code flow
  if (method === "code") {
    return (
      <MultiplayerLobby
        {...props}
        onBack={() => {
          if (isNative) {
            props.onDisconnect();
            setMethod("choose");
          } else {
            props.onBack();
          }
        }}
      />
    );
  }

  // If using WiFi Direct
  if (method === "wifi-direct") {
    return (
      <WifiDirectLobby
        status={wifi.status}
        role={wifi.role}
        peers={wifi.peers}
        error={wifi.error}
        deviceName={wifi.deviceName}
        onCreateGroup={wifi.createGroup}
        onDiscover={wifi.discover}
        onConnectToPeer={wifi.connectToPeer}
        onDisconnect={async () => { await wifi.disconnect(); setMethod("choose"); }}
        onBack={() => { wifi.disconnect(); setMethod("choose"); }}
        gameName={props.gameName}
      />
    );
  }

  // Choose method screen (native only)
  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-4 pt-6">
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={props.onBack}
          className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-accent"
        >
          <span className="w-5 h-5 text-accent">←</span>
        </button>
        <h1
          className="text-xl font-bold text-accent"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {props.gameName} — لعب جماعي
        </h1>
        <div className="w-9" />
      </div>

      <div className="w-full max-w-md space-y-4">
        <p className="text-muted-foreground text-sm text-center">
          اختر طريقة الاتصال
        </p>

        {/* WiFi Direct - Primary */}
        <Button
          onClick={() => setMethod("wifi-direct")}
          className="w-full h-16 text-lg gold-gradient text-background font-bold rounded-xl flex items-center justify-center gap-3"
        >
          <Radio className="w-6 h-6" />
          <div className="text-right">
            <span className="block">WiFi Direct</span>
            <span className="block text-xs opacity-80">اكتشاف تلقائي — بدون كود</span>
          </div>
        </Button>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-muted-foreground text-xs">أو</span>
        </div>

        {/* Code-based - Fallback */}
        <Button
          onClick={() => setMethod("code")}
          className="w-full h-16 text-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl flex items-center justify-center gap-3"
        >
          <Link2 className="w-6 h-6" />
          <div className="text-right">
            <span className="block">اتصال بكود</span>
            <span className="block text-xs opacity-60">شارك كود مع اللاعب الآخر</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default NetworkLobby;
