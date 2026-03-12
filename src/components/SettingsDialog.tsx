import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Volume2, Music, Globe, Fingerprint, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameSettings } from "@/hooks/useGameSettings";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { getDeviceCode, getDeviceName, setDeviceName } from "@/lib/deviceCode";
import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { settings, updateSettings } = useGameSettings();
  const { t, lang, setLang } = useLanguage();
  const deviceCode = getDeviceCode();
  const [playerName, setPlayerName] = useState(getDeviceName());
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try { await navigator.clipboard.writeText(deviceCode); } catch {
      const ta = document.createElement("textarea");
      ta.value = deviceCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNameChange = (name: string) => {
    setPlayerName(name);
    setDeviceName(name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wood-texture border-2 border-gold max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-gold text-center text-xl" style={{ fontFamily: "'Cinzel', serif" }}>
            ⚙️ {t("settings")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Device Code */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-gold" />
              <span className="text-foreground text-sm">كود الجهاز</span>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <span className="font-mono text-lg text-accent tracking-widest bg-card/60 px-3 py-1 rounded-lg border border-accent/30" dir="ltr">
                {deviceCode}
              </span>
              <Button variant="ghost" size="icon" onClick={handleCopyCode} className="text-accent h-8 w-8">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs pl-8">كود ثابت لجهازك — لا يتغير</p>
          </div>

          {/* Player Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 pl-8">
              <span className="text-foreground text-sm">اسم اللاعب</span>
            </div>
            <input
              type="text"
              value={playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="أدخل اسمك..."
              className="w-full bg-card/80 border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 mr-8"
              style={{ marginRight: "2rem" }}
            />
          </div>

          {/* Language */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gold" />
              <span className="text-foreground text-sm">{t("language")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-8">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs ${
                    lang === l.code
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border bg-card/40 text-foreground hover:border-gold/40"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.nativeName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-gold" />
              <span className="text-foreground text-sm">{t("sound_effects")}</span>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(v) => updateSettings({ soundEnabled: v })}
            />
          </div>

          {/* Sound Volume */}
          {settings.soundEnabled && (
            <div className="pl-8">
              <Slider
                value={[settings.soundVolume]}
                onValueChange={([v]) => updateSettings({ soundVolume: v })}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">{settings.soundVolume}%</p>
            </div>
          )}

          {/* Music */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Music className="w-5 h-5 text-gold" />
              <span className="text-foreground text-sm">{t("background_music")}</span>
            </div>
            <Switch
              checked={settings.musicEnabled}
              onCheckedChange={(v) => updateSettings({ musicEnabled: v })}
            />
          </div>

          {/* Music Volume */}
          {settings.musicEnabled && (
            <div className="pl-8">
              <Slider
                value={[settings.musicVolume]}
                onValueChange={([v]) => updateSettings({ musicVolume: v })}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">{settings.musicVolume}%</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
