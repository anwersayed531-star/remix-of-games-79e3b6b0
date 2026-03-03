import { useState } from "react";
import { Wifi, ArrowLeft, Loader2, WifiOff, Users, Plus, Copy, ClipboardPaste, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="border-accent text-accent hover:bg-accent/10 gap-1"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "تم النسخ!" : "نسخ الكود"}
    </Button>
  );
};

const PasteInput = ({ onSubmit, placeholder, buttonText }: { onSubmit: (v: string) => void; placeholder: string; buttonText: string }) => {
  const [value, setValue] = useState("");
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setValue(text.trim());
      }
    } catch { /* clipboard not available */ }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-card/80 border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          dir="ltr"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePaste}
          className="text-muted-foreground hover:text-accent shrink-0"
          title="لصق"
        >
          <ClipboardPaste className="w-4 h-4" />
        </Button>
      </div>
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

const MultiplayerLobby = ({
  status,
  role,
  localCode,
  answerCode = "",
  error,
  onCreateRoom,
  onJoinRoom,
  onHandleAnswer,
  onGenerateNext,
  onDisconnect,
  onBack,
  gameName,
  peerCount = 0,
  peers = [],
  onCompleteConnection,
}: MultiplayerLobbyProps) => {
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);
  const [answerInput, setAnswerInput] = useState("");

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
                variant="outline"
                size="sm"
                onClick={async () => {
                  await onGenerateNext();
                  setShowAddMore(true);
                }}
                className="border-accent text-accent hover:bg-accent/10"
              >
                <Plus className="w-4 h-4 ml-1" />
                إضافة لاعب
              </Button>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                {/* Step 1: Share offer code */}
                <div className="bg-card/60 border border-accent/30 rounded-xl p-3">
                  <p className="text-accent text-xs font-bold mb-2 text-center">
                    ١. أرسل هذا الكود للاعب الجديد:
                  </p>
                  <div className="bg-background/80 rounded-lg p-2 mb-2">
                    <p className="text-foreground text-xs font-mono break-all text-center leading-relaxed" dir="ltr">
                      {localCode}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <CopyButton text={localCode} />
                  </div>
                </div>
                {/* Step 2: Enter answer */}
                <div className="bg-card/60 border border-border rounded-xl p-3">
                  <p className="text-foreground text-xs font-bold mb-2 text-center">
                    ٢. الصق كود الرد من اللاعب:
                  </p>
                  <PasteInput
                    onSubmit={(code) => {
                      handleAnswer(code);
                      setShowAddMore(false);
                    }}
                    placeholder="الصق كود الرد هنا..."
                    buttonText="اتصال"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddMore(false)}
                  className="w-full text-muted-foreground"
                >
                  إلغاء
                </Button>
              </div>
            )}
          </>
        )}

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
          <Wifi className="w-5 h-5 inline-block ml-2" />
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
        {status === "idle" && !showJoin && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm text-center">
              أنشئ غرفة وشارك الكود مع اللاعب الآخر عبر أي وسيلة (واتساب، بلوتوث، إلخ)
            </p>

            <Button
              onClick={onCreateRoom}
              className="w-full h-14 text-lg gold-gradient text-background font-bold rounded-xl"
            >
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
              onClick={() => setShowJoin(true)}
              className="w-full h-14 text-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl"
            >
              انضمام بكود
            </Button>
          </div>
        )}

        {/* Join mode: enter offer code */}
        {status === "idle" && showJoin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJoin(false)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 ml-1" />
                رجوع
              </Button>
              <p className="text-accent text-sm font-bold">انضمام بكود</p>
              <div className="w-16" />
            </div>
            <PasteInput
              onSubmit={onJoinRoom}
              placeholder="الصق كود الغرفة هنا..."
              buttonText="انضمام"
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
                {/* Step 1: Share offer code */}
                <div className="bg-card/60 border border-accent/30 rounded-xl p-4">
                  <p className="text-accent text-sm font-bold mb-3 text-center">
                    ١. أرسل هذا الكود للاعب الآخر:
                  </p>
                  <div className="bg-background/80 rounded-lg p-3 mb-3">
                    <p className="text-foreground text-xs font-mono break-all text-center leading-relaxed" dir="ltr">
                      {localCode}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <CopyButton text={localCode} />
                  </div>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-background px-3 text-muted-foreground text-xs">
                    ثم
                  </span>
                </div>

                {/* Step 2: Enter answer code */}
                <div className="bg-card/60 border border-border rounded-xl p-4">
                  <p className="text-foreground text-sm font-bold mb-2 text-center">
                    ٢. الصق كود الرد من اللاعب:
                  </p>
                  <PasteInput
                    onSubmit={handleAnswer}
                    placeholder="الصق كود الرد هنا..."
                    buttonText="اتصال"
                  />
                </div>
              </>
            )}

            {role === "guest" && answerCode && (
              <div className="space-y-4">
                <div className="bg-card/60 border border-accent/30 rounded-xl p-4">
                  <p className="text-accent text-sm font-bold mb-3 text-center">
                    أرسل هذا الكود للمضيف:
                  </p>
                  <div className="bg-background/80 rounded-lg p-3 mb-3">
                    <p className="text-foreground text-xs font-mono break-all text-center leading-relaxed" dir="ltr">
                      {answerCode}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <CopyButton text={answerCode} />
                  </div>
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
              onClick={() => {
                onDisconnect();
                setShowJoin(false);
                setShowAddMore(false);
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

export default MultiplayerLobby;
