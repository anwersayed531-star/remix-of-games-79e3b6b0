import { useNavigate } from "react-router-dom";
import { Settings, Dice5, Grid3X3, Crown, Trophy, Globe } from "lucide-react";
import { useState } from "react";
import SettingsDialog from "@/components/SettingsDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLanguage();

  const games = [
    {
      id: "xo",
      title: t("xo_title"),
      subtitle: t("xo_subtitle"),
      icon: Grid3X3,
      path: "/xo",
      gradient: "from-destructive/40 to-primary/30",
      borderColor: "border-destructive/30",
    },
    {
      id: "chess",
      title: t("chess_title"),
      subtitle: t("chess_subtitle"),
      icon: Crown,
      path: "/chess",
      gradient: "from-primary/40 to-accent/30",
      borderColor: "border-primary/30",
    },
    {
      id: "ludo",
      title: t("ludo_title"),
      subtitle: t("ludo_subtitle"),
      icon: Dice5,
      path: "/ludo",
      gradient: "from-accent/40 to-primary/30",
      borderColor: "border-accent/30",
    },
    {
      id: "tournament",
      title: t("tournament_title"),
      subtitle: t("tournament_subtitle"),
      icon: Trophy,
      path: "/tournament",
      gradient: "from-accent/50 to-destructive/30",
      borderColor: "border-accent/30",
    },
  ];

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      {/* Decorative border */}
      <div className="absolute inset-2 sm:inset-4 border-2 border-gold rounded-2xl pointer-events-none opacity-20" />
      <div className="absolute inset-3 sm:inset-6 border border-gold rounded-xl pointer-events-none opacity-10" />

      {/* Settings button */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-3 right-3 sm:top-6 sm:right-6 z-10 p-2.5 sm:p-3 rounded-full bg-secondary/80 hover:bg-secondary transition-colors border border-gold"
      >
        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
      </button>

      {/* Title */}
      <div className="text-center mb-6 sm:mb-12 animate-fade-in">
        <h1 className="text-2xl sm:text-5xl font-bold text-gold mb-2 tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>
          {t("app_title")}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-base" style={{ fontFamily: "'Amiri', serif" }}>
          {t("app_subtitle")}
        </p>
        <div className="w-24 sm:w-48 h-0.5 gold-gradient mx-auto mt-3 sm:mt-4 rounded-full" />
      </div>

      {/* Game Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 w-full max-w-3xl px-2">
        {games.map((game, i) => (
          <button
            key={game.id}
            onClick={() => navigate(game.path)}
            className={`group card-3d relative rounded-xl border-2 ${game.borderColor} bg-gradient-to-br ${game.gradient} 
              p-4 sm:p-8 transition-all duration-300 hover:scale-105
              backdrop-blur-sm animate-fade-in`}
            style={{
              animationDelay: `${i * 100}ms`,
              background: `linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)`,
            }}
          >
            <div className="absolute inset-0 rounded-xl border border-gold opacity-0 group-hover:opacity-30 transition-opacity" />
            <game.icon className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gold group-hover:scale-110 transition-transform" />
            <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
              {game.title}
            </h2>
            <p className="text-muted-foreground text-[10px] sm:text-sm">{game.subtitle}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-6 sm:mt-12 text-muted-foreground text-[10px] sm:text-xs opacity-50">
        {t("footer_text")}
      </p>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default Index;
