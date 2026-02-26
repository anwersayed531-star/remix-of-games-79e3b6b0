import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, ChevronRight, Globe, Sparkles } from "lucide-react";
import { useLanguage, LANGUAGES, Lang } from "@/contexts/LanguageContext";

const Welcome = () => {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const visited = localStorage.getItem("game-hub-visited");
    if (visited) {
      navigate("/home", { replace: true });
      return;
    }
    setTimeout(() => setVisible(true), 100);
  }, [navigate]);

  const handleStart = () => {
    localStorage.setItem("game-hub-visited", "true");
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] wood-texture flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute inset-3 border-2 border-gold rounded-2xl pointer-events-none opacity-20" />

      <div
        className={`flex flex-col items-center gap-8 max-w-md w-full transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Logo */}
        <div className="relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl gold-gradient flex items-center justify-center shadow-2xl">
            <Gamepad2 className="w-12 h-12 sm:w-16 sm:h-16 text-background" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-gold animate-pulse" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1
            className="text-3xl sm:text-5xl font-bold text-gold tracking-wider"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Game Hub
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("welcome_subtitle")}
          </p>
        </div>

        {/* Language selector */}
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 justify-center text-gold mb-2">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-bold">{t("select_language")}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  lang === l.code
                    ? "border-gold bg-gold/15 text-gold scale-[1.02]"
                    : "border-border bg-card/60 text-foreground hover:border-gold/40 hover:bg-card/80"
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <div className="text-start">
                  <p className="text-sm font-bold">{l.nativeName}</p>
                  <p className="text-[10px] text-muted-foreground">{l.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-xl gold-gradient text-background font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {t("welcome_start")}
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Version */}
        <p className="text-muted-foreground text-[10px] opacity-50">v1.0</p>
      </div>
    </div>
  );
};

export default Welcome;
