import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Users, Play, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NetworkLobby from "@/components/NetworkLobby";
import TournamentManager from "@/components/TournamentManager";
import TournamentBracket from "@/components/TournamentBracket";
import MatchSidebar from "@/components/MatchSidebar";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useTournament } from "@/hooks/useTournament";

type GameChoice = "xo" | "chess" | "ludo";

const GAME_NAMES: Record<GameChoice, string> = {
  xo: "XO ❌⭕",
  chess: "شطرنج ♟️",
  ludo: "لودو 🎲",
};

const TournamentPage = () => {
  const navigate = useNavigate();
  const mp = useMultiplayerSync();
  const tournament = useTournament();
  const [gameChoice, setGameChoice] = useState<GameChoice>("xo");

  const isHost = mp.role === "host";
  const isConnected = mp.status === "connected";

  // Sync connected peers to tournament players
  useEffect(() => {
    if (!isConnected || !isHost) return;
    // Add host as player
    tournament.addPlayer({ id: "host", name: "المضيف", connected: true });
    // Add peers
    for (const peer of mp.peers) {
      tournament.addPlayer({ id: peer.id, name: peer.name || `لاعب ${peer.id.slice(0, 4)}`, connected: peer.connected });
    }
  }, [isConnected, isHost, mp.peers]);

  // Guest: add self
  useEffect(() => {
    if (!isConnected || isHost) return;
    tournament.addPlayer({ id: "guest", name: "أنا", connected: true });
  }, [isConnected, isHost]);

  // Listen for tournament state from host
  useEffect(() => {
    if (!isConnected) return;
    mp.onGameState((state: any) => {
      if (state?.tournamentState) {
        tournament.setState(state.tournamentState);
      }
    });
  }, [isConnected, mp]);

  // Broadcast tournament state when host changes it
  const broadcastTournament = useCallback(() => {
    if (isHost && isConnected) {
      mp.sendGameState({ tournamentState: tournament.state });
    }
  }, [isHost, isConnected, mp, tournament.state]);

  useEffect(() => {
    broadcastTournament();
  }, [tournament.state.phase, tournament.state.groups.length, tournament.state.matches.length, tournament.state.currentRound]);

  // Show lobby if not connected
  if (!isConnected) {
    return (
      <NetworkLobby
        status={mp.status}
        role={mp.role}
        localCode={mp.localCode}
        answerCode={mp.answerCode}
        error={mp.error}
        onCreateRoom={mp.createRoom}
        onJoinRoom={mp.joinRoom}
        onHandleAnswer={mp.handleAnswer}
        onGenerateNext={mp.generateOfferForNext}
        onDisconnect={mp.disconnect}
        onBack={() => navigate("/")}
        gameName="بطولة"
        peerCount={mp.peerCount}
        peers={mp.peers}
      />
    );
  }

  const activeMatches = tournament.getActiveMatches();
  const finishedMatches = tournament.getFinishedMatches();

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button onClick={() => navigate("/")} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold">
          <ArrowLeft className="w-5 h-5 text-gold" />
        </button>
        <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>
          🏆 البطولة
        </h1>
        <div className="flex items-center gap-1 text-accent text-xs">
          <Users className="w-4 h-4" />
          <span>{tournament.state.players.length}</span>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-4 text-accent text-xs">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        متصل — {isHost ? "أنت المضيف" : "أنت ضيف"} — {mp.peerCount} لاعب
      </div>

      <div className="w-full max-w-lg space-y-4">
        {/* Game choice (host only, lobby/setup phase) */}
        {isHost && (tournament.state.phase === "lobby" || tournament.state.phase === "setup") && (
          <div className="bg-card/60 border border-gold/30 rounded-xl p-4">
            <label className="text-foreground text-sm mb-2 block">اللعبة</label>
            <Select value={gameChoice} onValueChange={(v: GameChoice) => setGameChoice(v)}>
              <SelectTrigger className="bg-card/60 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xo">XO ❌⭕</SelectItem>
                <SelectItem value="chess">شطرنج ♟️</SelectItem>
                <SelectItem value="ludo">لودو 🎲</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tournament Manager */}
        <TournamentManager
          state={tournament.state}
          isHost={isHost}
          onSetPlayersPerMatch={tournament.setPlayersPerMatch}
          onAutoGroup={tournament.autoGroupPlayers}
          onStartTournament={tournament.startTournament}
          onStartSetup={tournament.startSetup}
          getPlayerName={tournament.getPlayerName}
        />

        {/* Bracket */}
        {(tournament.state.phase === "playing" || tournament.state.phase === "finished") && (
          <TournamentBracket
            matches={tournament.state.matches}
            currentRound={tournament.state.currentRound}
            getPlayerName={tournament.getPlayerName}
          />
        )}

        {/* Active matches info */}
        {tournament.state.phase === "playing" && activeMatches.length > 0 && (
          <div className="bg-card/60 border border-accent/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-accent text-sm font-bold">
              <Swords className="w-4 h-4" />
              مباريات جارية ({activeMatches.length})
            </div>
            {activeMatches.map((m) => (
              <div key={m.id} className="bg-accent/10 rounded-lg p-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  {m.players.map((pid, i) => (
                    <span key={pid}>
                      {tournament.getPlayerName(pid)}
                      {i < m.players.length - 1 && <span className="text-muted-foreground mx-1">vs</span>}
                    </span>
                  ))}
                </div>
                {/* Host can report results */}
                {isHost && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {m.players.map((pid) => (
                      <Button
                        key={pid}
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-2 border-accent text-accent hover:bg-accent/10"
                        onClick={() => tournament.reportMatchResult(m.id, pid)}
                      >
                        🏆 {tournament.getPlayerName(pid)} فاز
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Finished matches */}
        {finishedMatches.length > 0 && (
          <div className="bg-card/60 border border-border rounded-xl p-4 space-y-2">
            <p className="text-muted-foreground text-xs font-bold">
              <Trophy className="w-3 h-3 inline ml-1" />
              نتائج ({finishedMatches.length})
            </p>
            {finishedMatches.map((m) => (
              <div key={m.id} className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="text-accent font-bold">🏆 {tournament.getPlayerName(m.winnerId!)}</span>
                <span>vs</span>
                {m.players.filter(p => p !== m.winnerId).map(pid => (
                  <span key={pid}>{tournament.getPlayerName(pid)}</span>
                ))}
                <span className="text-muted-foreground/50">— جولة {m.round}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reset (host) */}
        {isHost && tournament.state.phase === "finished" && (
          <Button
            onClick={tournament.reset}
            className="w-full gold-gradient text-background font-bold rounded-xl"
          >
            بطولة جديدة
          </Button>
        )}
      </div>

      {/* Match Sidebar */}
      {tournament.state.phase === "playing" && (
        <MatchSidebar
          matches={tournament.state.matches}
          getPlayerName={tournament.getPlayerName}
        />
      )}
    </div>
  );
};

export default TournamentPage;
