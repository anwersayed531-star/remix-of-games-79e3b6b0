import { Wifi, WifiOff, Loader2, Users, ArrowLeft, Radio, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WifiDirectStatus, WifiDirectRole } from "@/hooks/useWifiDirect";
import type { WifiDirectPeer } from "@/plugins/WifiDirectPlugin";

interface WifiDirectLobbyProps {
  status: WifiDirectStatus;
  role: WifiDirectRole;
  peers: WifiDirectPeer[];
  error: string | null;
  deviceName: string;
  onCreateGroup: () => void;
  onDiscover: () => void;
  onConnectToPeer: (address: string) => void;
  onDisconnect: () => void;
  onBack: () => void;
  gameName: string;
}

const WifiDirectLobby = ({
  status, role, peers, error, deviceName,
  onCreateGroup, onDiscover, onConnectToPeer,
  onDisconnect, onBack, gameName,
}: WifiDirectLobbyProps) => {

  // Connected
  if (status === "connected") {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="flex items-center gap-2 text-accent">
          <Wifi className="w-6 h-6" />
          <span className="text-lg font-bold">متصل عبر WiFi Direct!</span>
        </div>
        <p className="text-muted-foreground text-sm text-center">
          أنت {role === "host" ? "المضيف" : "الضيف"} — اللعبة جاهزة
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          قطع الاتصال
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-4 pt-6">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-accent"
        >
          <ArrowLeft className="w-5 h-5 text-accent" />
        </button>
        <h1
          className="text-xl font-bold text-accent"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <Radio className="w-5 h-5 inline-block ml-2" />
          {gameName} — WiFi Direct
        </h1>
        <div className="w-9" />
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Device name */}
        <div className="text-center text-muted-foreground text-xs">
          <Smartphone className="w-4 h-4 inline ml-1" />
          جهازك: {deviceName}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/20 border border-destructive/40 rounded-lg p-3 text-center">
            <WifiOff className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Idle */}
        {status === "idle" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm text-center">
              اتصال مباشر بدون إنترنت — الأجهزة تكتشف بعضها تلقائياً
            </p>
            <Button
              onClick={onCreateGroup}
              className="w-full h-14 text-lg gold-gradient text-background font-bold rounded-xl"
            >
              إنشاء غرفة (مضيف)
            </Button>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-background px-3 text-muted-foreground text-xs">أو</span>
            </div>
            <Button
              onClick={onDiscover}
              className="w-full h-14 text-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl"
            >
              البحث عن غرف (ضيف)
            </Button>
          </div>
        )}

        {/* Waiting (host) */}
        {status === "waiting" && role === "host" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground text-sm">في انتظار اللاعبين...</p>
            <p className="text-muted-foreground text-xs">غرفتك ظاهرة للأجهزة القريبة</p>
          </div>
        )}

        {/* Discovering (guest) */}
        {status === "discovering" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <span className="text-muted-foreground text-sm">جاري البحث عن غرف...</span>
            </div>

            {peers.length === 0 && (
              <p className="text-muted-foreground text-xs text-center">
                لم يتم العثور على أجهزة بعد — تأكد أن المضيف أنشأ غرفة
              </p>
            )}

            {peers.length > 0 && (
              <div className="space-y-2">
                <p className="text-accent text-sm font-bold text-center">
                  <Users className="w-4 h-4 inline ml-1" />
                  الأجهزة المتاحة:
                </p>
                {peers.map((peer) => (
                  <button
                    key={peer.address}
                    onClick={() => onConnectToPeer(peer.address)}
                    className="w-full bg-card/60 border border-accent/30 rounded-xl p-4 text-right hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-accent shrink-0" />
                      <div>
                        <p className="text-foreground font-bold text-sm">{peer.name || "جهاز غير معروف"}</p>
                        <p className="text-muted-foreground text-xs font-mono" dir="ltr">{peer.address}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onDiscover}
              className="w-full text-accent"
            >
              إعادة البحث
            </Button>
          </div>
        )}

        {/* Connecting */}
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground text-sm">جاري الاتصال...</p>
          </div>
        )}

        {/* Failed */}
        {status === "failed" && (
          <div className="space-y-3 text-center py-4">
            <Button
              onClick={() => {
                onDisconnect();
              }}
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
            >
              حاول مرة أخرى
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WifiDirectLobby;
