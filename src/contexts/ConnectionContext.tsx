import { createContext, useContext, type ReactNode } from "react";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";

type MultiplayerSyncReturn = ReturnType<typeof useMultiplayerSync>;

const ConnectionContext = createContext<MultiplayerSyncReturn | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const mp = useMultiplayerSync();
  return (
    <ConnectionContext.Provider value={mp}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): MultiplayerSyncReturn {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}
