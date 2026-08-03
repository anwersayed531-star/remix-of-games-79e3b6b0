import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Wifi, WifiOff, Users } from "lucide-react";
import { GAMES, useConnection } from "@/contexts/ConnectionContext";

/**
 * Fixed bottom bar: switch between games without losing the P2P connection.
 * When connected, everyone in the room follows the switch automatically.
 */
const GameSwitchBar = () => {
  const location = useLocation();
  const conn = useConnection();
  const connected = conn.status === "connected";
  const onGameRoute = GAMES.some((g) => g.route === location.pathname);

  useEffect(() => {
    document.body.style.paddingBottom = onGameRoute ? "4.25rem" : "";
    return () => { document.body.style.paddingBottom = ""; };
  }, [onGameRoute]);

  if (!onGameRoute) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-accent/30 bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
    >
      <div className="max-w-lg mx-auto flex items-stretch">
        {GAMES.map((g) => {
          const active = location.pathname === g.route;
          return (
            <button
              key={g.route}
              onClick={() => conn.switchGame(g.route)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-bold transition-colors ${
                active ? "text-accent bg-accent/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-lg leading-none">{g.icon}</span>
              <span>{g.name}</span>
            </button>
          );
        })}
        <div className="flex flex-col items-center justify-center gap-0.5 px-3 border-r border-border">
          {connected ? (
            <>
              <Wifi className="w-4 h-4 text-accent" />
              <span className="text-[10px] text-accent flex items-center gap-1">
                <Users className="w-3 h-3" />
                {Math.max(conn.peerCount, 1)}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">غير متصل</span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default GameSwitchBar;
