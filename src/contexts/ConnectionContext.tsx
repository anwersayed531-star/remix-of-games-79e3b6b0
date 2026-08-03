import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";

export const GAMES = [
  { route: "/xo", name: "XO", icon: "❌⭕" },
  { route: "/chess", name: "شطرنج", icon: "♟️" },
  { route: "/ludo", name: "لودو", icon: "🎲" },
] as const;

type MultiplayerSyncReturn = ReturnType<typeof useMultiplayerSync>;

interface ConnectionContextValue extends MultiplayerSyncReturn {
  /** Change game for everyone in the room without dropping the connection */
  switchGame: (route: string) => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const mp = useMultiplayerSync();
  const navigate = useNavigate();
  const location = useLocation();

  // A peer changed the game → follow them (connection stays alive)
  useEffect(() => {
    mp.onGameSwitch((route: string) => {
      if (route && route !== window.location.pathname) navigate(route);
    });
  }, [mp, navigate]);

  const switchGame = useCallback(
    (route: string) => {
      if (route === location.pathname) return;
      if (mp.status === "connected") mp.sendGameSwitch(route);
      navigate(route);
    },
    [mp, navigate, location.pathname]
  );

  return (
    <ConnectionContext.Provider value={{ ...mp, switchGame }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}
