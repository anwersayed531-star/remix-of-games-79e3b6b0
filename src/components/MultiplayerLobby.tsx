import { useState } from "react";
import { Wifi, ArrowLeft, Loader2, WifiOff, Users, Plus, Camera, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import QRCodeScanner from "@/components/QRCodeScanner";
import type { ConnectionStatus, Role } from "@/hooks/useMultiplayerSync";

interface MultiplayerLobbyProps {
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
}

const PasteInput = ({ onSubmit, placeholder, buttonText }: { onSubmit: (v: string) => void; placeholder: string; buttonText: string }) => {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card/80 border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        dir="ltr"
      />
      <Button
        onClick={() => { if (value.trim()) onSubmit(value.trim()); }}
        disabled={!value.trim()}
        className="w-full gold-gradient text-background font-bold rounded-xl"
      >
        {buttonText}
      </Button>
    </div>
  );
};

/** Combined scan + manual input section */
const ScanAndInput = ({
  onResult,
  placeholder,
  buttonText,
  scanLabel,
}: {
  onResult: (code: string) => void;
  placeholder: string;
  buttonText: string;
  scanLabel?: string;
}) => {
  const [scanning, setScanning] = useState(false);

  if (scanning) {
    return (
      <QRCodeScanner
        onScan={(code) => { setScanning(false); onResult(code); }}
        onClose={() => setScanning(false)}
        onManualInput={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => setScanning(true)}
        className="w-full gold-gradient text-background font-bold rounded-xl gap-2"
      >
        <Camera className="w-4 h-4" />
        {scanLabel || "مسح QR بالكاميرا"}
      </Button>
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <span className="relative bg-background px-3 text-muted-foreground text-xs">أو أدخل الكود يدوياً</span>
      </div>
      <PasteInput onSubmit={onResult} placeholder={placeholder} buttonText={buttonText} />
    </div>
  );
};

const MultiplayerLobby = ({
  status, role, localCode, answerCode = "", error,
  onCreateRoom, onJoinRoom, onHandleAnswer, onGenerateNext,
  onDisconnect, onBack, gameName, peerCount = 0, peers = [],
  onCompleteConnection,
}: MultiplayerLobbyProps) => {
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);

  const handleAnswer = (code: string) => {
    (onHandleAnswer || onCompleteConnection)?.(code);
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
        {peerCount > 0 && (
          <div className="flex items-center gap-2 text-accent text-xs">
            <Users className="w-4 h-4" />
            <span>{peerCount} لاعب متصل</span>
          </div>
        )}
        {peers.length > 0 && (
          <div className="w-full max-w-xs space-y-1">
            {peers.filter(p => p.connected).map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-foreground">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add more players (host only) */}
        {role === "host" && onGenerateNext && (
          <>
            {!showAddMore ? (
              <Button
                variant="outline" size="sm"
                onClick={async () => { await onGenerateNext(); setShowAddMore(true); }}
                className="border-accent text-accent hover:bg-accent/10"
              >
                <Plus className="w-4 h-4 ml-1" />
                إضافة لاعب
              </Button>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                <div className="bg-card/60 border border-accent/30 rounded-xl p-3">
                  <p className="text-accent text-xs font-bold mb-2 text-center">١. اللاعب الجديد يمسح هذا الكود:</p>
                  <QRCodeDisplay value={localCode} size={160} />
                </div>
                <div className="bg-card/60 border border-border rounded-xl p-3">
                  <p className="text-foreground text-xs font-bold mb-2 text-center">٢. امسح كود الرد من اللاعب:</p>
                  <ScanAndInput
                    onResult={(code) => { handleAnswer(code); setShowAddMore(false); }}
                    placeholder="أو الصق الكود يدوياً..."
                    buttonText="اتصال"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAddMore(false)} className="w-full text-muted-foreground">
                  إلغاء
                </Button>
              </div>
            )}
          </>
        )}

        <Button variant="outline" size="sm" onClick={onDisconnect} className="border-destructive text-destructive hover:bg-destructive/10">
          قطع الاتصال
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-4 pt-6">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-accent">
          <ArrowLeft className="w-5 h-5 text-accent" />
        </button>
        <h1 className="text-xl font-bold text-accent" style={{ fontFamily: "'Cinzel', serif" }}>
          <Wifi className="w-5 h-5 inline-block ml-2" />
          {gameName} — شبكة محلية
        </h1>
        <div className="w-9" />
      </div>

      <div className="w-full max-w-md space-y-4">
        {error && (
          <div className="bg-destructive/20 border border-destructive/40 rounded-lg p-3 text-center">
            <WifiOff className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Idle: choose action */}
        {status === "idle" && !showJoin && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm text-center">
              أنشئ غرفة وشارك الكود مع اللاعب الآخر عبر مسح QR Code
            </p>
            <Button onClick={onCreateRoom} className="w-full h-14 text-lg gold-gradient text-background font-bold rounded-xl">
              إنشاء غرفة
            </Button>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <span className="relative bg-background px-3 text-muted-foreground text-xs">أو</span>
            </div>
            <Button onClick={() => setShowJoin(true)} className="w-full h-14 text-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl">
              انضمام بكود
            </Button>
          </div>
        )}

        {/* Join mode: scan + manual always visible together */}
        {status === "idle" && showJoin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowJoin(false)} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <p className="text-accent text-sm font-bold">انضمام بكود</p>
              <div className="w-16" />
            </div>
            <ScanAndInput
              onResult={onJoinRoom}
              placeholder="الصق كود الغرفة هنا..."
              buttonText="انضمام"
              scanLabel="مسح QR Code بالكاميرا"
            />
          </div>
        )}

        {/* Creating */}
        {status === "creating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground text-sm">جاري إنشاء الغرفة...</p>
          </div>
        )}

        {/* Waiting */}
        {status === "waiting" && (
          <div className="space-y-4">
            {role === "host" && localCode && (
              <>
                {/* Step 1: Show QR for offer code */}
                <div className="bg-card/60 border border-accent/30 rounded-xl p-4">
                  <QRCodeDisplay value={localCode} label="١. اللاعب الآخر يمسح هذا الكود:" />
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <span className="relative bg-background px-3 text-muted-foreground text-xs">ثم</span>
                </div>

                {/* Step 2: Scan or paste answer code — both visible */}
                <div className="bg-card/60 border border-border rounded-xl p-4 space-y-3">
                  <p className="text-foreground text-sm font-bold text-center">٢. امسح كود الرد من اللاعب:</p>
                  <ScanAndInput
                    onResult={handleAnswer}
                    placeholder="أو الصق كود الرد يدوياً..."
                    buttonText="اتصال"
                  />
                </div>
              </>
            )}

            {role === "guest" && answerCode && (
              <div className="space-y-4">
                <div className="bg-card/60 border border-accent/30 rounded-xl p-4">
                  <QRCodeDisplay value={answerCode} label="المضيف يمسح هذا الكود:" />
                </div>
                <div className="flex items-center gap-2 justify-center text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">في انتظار المضيف...</span>
                </div>
              </div>
            )}
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
              onClick={() => { onDisconnect(); setShowJoin(false); setShowAddMore(false); }}
              variant="outline" className="border-accent text-accent hover:bg-accent/10"
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
