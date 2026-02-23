import { useState } from "react";
import { Wifi, ArrowLeft, Loader2, WifiOff, Smartphone, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus, Role } from "@/hooks/useP2PConnection";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import QRCodeScanner from "@/components/QRCodeScanner";

interface MultiplayerLobbyProps {
  status: ConnectionStatus;
  role: Role;
  localCode: string;
  error: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onCompleteConnection: (code: string) => void;
  onDisconnect: () => void;
  onBack: () => void;
  gameName: string;
}

const MultiplayerLobby = ({
  status,
  role,
  localCode,
  error,
  onCreateRoom,
  onJoinRoom,
  onCompleteConnection,
  onDisconnect,
  onBack,
  gameName,
}: MultiplayerLobbyProps) => {
  const [showScanner, setShowScanner] = useState(false);

  const handleQRScanned = (data: string) => {
    setShowScanner(false);
    if (role === null) {
      // Guest scanned host's QR - join room
      onJoinRoom(data);
    } else if (role === "host") {
      // Host scanned guest's answer
      onCompleteConnection(data);
    }
  };

  // Connected state
  if (status === "connected") {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="flex items-center gap-2 text-accent">
          <Wifi className="w-6 h-6" />
          <span className="text-lg font-bold">متصل!</span>
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
          className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold"
        >
          <ArrowLeft className="w-5 h-5 text-gold" />
        </button>
        <h1
          className="text-xl font-bold text-gold"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <Smartphone className="w-5 h-5 inline-block ml-2" />
          {gameName} — شبكة محلية
        </h1>
        <div className="w-9" />
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Error */}
        {error && (
          <div className="bg-destructive/20 border border-destructive/40 rounded-lg p-3 text-center">
            <WifiOff className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Idle: choose action */}
        {status === "idle" && !showScanner && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm text-center">
              تأكد أن الجهازين على نفس شبكة الواي فاي أو نقطة اتصال
            </p>

            <Button
              onClick={onCreateRoom}
              className="w-full h-14 text-lg gold-gradient text-background font-bold rounded-xl"
            >
              <QrCode className="w-5 h-5 ml-2" />
              إنشاء غرفة
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-background px-3 text-muted-foreground text-xs">
                أو
              </span>
            </div>

            <Button
              onClick={() => setShowScanner(true)}
              className="w-full h-14 text-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl"
            >
              <ScanLine className="w-5 h-5 ml-2" />
              مسح رمز QR للانضمام
            </Button>
          </div>
        )}

        {/* Scanner mode */}
        {status === "idle" && showScanner && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScanner(false)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <p className="text-gold text-sm font-bold">مسح رمز QR</p>
              <div className="w-16" />
            </div>
            <QRCodeScanner
              onScan={handleQRScanned}
              scanning={showScanner}
            />
          </div>
        )}

        {/* Creating */}
        {status === "creating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="text-muted-foreground text-sm">جاري إنشاء الغرفة...</p>
          </div>
        )}

        {/* Waiting: show QR Code for host, show scanner for guest */}
        {status === "waiting" && localCode && (
          <div className="space-y-4">
            {role === "host" && (
              <>
                <div className="bg-card/60 border border-gold/30 rounded-xl p-4">
                  <p className="text-gold text-sm font-bold mb-3 text-center">
                    اطلب من اللاعب مسح هذا الرمز:
                  </p>
                  <QRCodeDisplay
                    value={localCode}
                    size={200}
                  />
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-background px-3 text-muted-foreground text-xs">
                    ثم امسح رمز الرد
                  </span>
                </div>

                <div className="bg-card/60 border border-border rounded-xl p-4">
                  <p className="text-foreground text-sm font-bold mb-2 text-center">
                    امسح رمز QR من شاشة اللاعب:
                  </p>
                  <QRCodeScanner
                    onScan={handleQRScanned}
                    scanning={role === "host" && status === "waiting"}
                  />
                </div>
              </>
            )}

            {role === "guest" && (
              <div className="space-y-4">
                <div className="bg-card/60 border border-gold/30 rounded-xl p-4">
                  <p className="text-gold text-sm font-bold mb-3 text-center">
                    اعرض هذا الرمز للمضيف ليمسحه:
                  </p>
                  <QRCodeDisplay
                    value={localCode}
                    size={200}
                  />
                </div>
                <div className="flex items-center gap-2 justify-center text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">في انتظار المضيف ليمسح الرمز...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connecting */}
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="text-muted-foreground text-sm">جاري الاتصال...</p>
          </div>
        )}

        {/* Failed */}
        {status === "failed" && (
          <div className="space-y-3 text-center py-4">
            <Button
              onClick={() => {
                onDisconnect();
                setShowScanner(false);
              }}
              variant="outline"
              className="border-gold text-gold hover:bg-gold/10"
            >
              حاول مرة أخرى
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplayerLobby;
