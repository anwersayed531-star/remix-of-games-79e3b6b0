import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Trash2, Shuffle, Play, Trophy, UserMinus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTournament } from "@/hooks/useTournament";
import TournamentBracket from "@/components/TournamentBracket";

const LocalTournament = () => {
  const navigate = useNavigate();
  const {
    state, addPlayer, removePlayer, setPlayersPerMatch,
    autoGroupPlayers, startTournament, startSetup,
    reportMatchResult, disqualifyPlayer, getPlayerName,
    getTotalRounds, reset, getActiveMatches, getFinishedMatches,
  } = useTournament();

  const [playerName, setPlayerName] = useState("");

  const handleAddPlayer = () => {
    const name = playerName.trim();
    if (!name) return;
    addPlayer({ id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, connected: true });
    setPlayerName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddPlayer();
  };

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-3 sm:p-6 relative overflow-auto" dir="rtl">
      {/* Decorative border */}
      <div className="absolute inset-2 sm:inset-4 border-2 border-gold rounded-2xl pointer-events-none opacity-20" />

      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full bg-secondary/80 border border-gold">
          <ArrowRight className="w-4 h-4 text-gold" />
        </button>
        <h1 className="text-xl sm:text-3xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>
          🏆 بطولة محلية
        </h1>
        <div className="w-9" />
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {/* === LOBBY PHASE === */}
        {state.phase === "lobby" && (
          <>
            {/* Add players */}
            <div className="bg-card/60 border border-gold/30 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-gold text-center">إضافة اللاعبين</h3>
              <div className="flex gap-2">
                <Input
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اسم اللاعب..."
                  className="bg-secondary/60 border-border text-foreground text-sm"
                />
                <Button onClick={handleAddPlayer} size="sm" className="gold-gradient text-background shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Player list */}
              {state.players.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {state.players.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-foreground truncate">
                        <span className="text-gold ml-1">{i + 1}.</span>
                        {p.name}
                      </span>
                      <button onClick={() => removePlayer(p.id)} className="text-destructive hover:text-destructive/80 mr-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-muted-foreground text-xs text-center">
                {state.players.length} لاعب مسجل
              </p>
            </div>

            {/* Start setup */}
            {state.players.length >= 2 && (
              <Button onClick={startSetup} className="w-full gold-gradient text-background font-bold rounded-xl">
                إعداد البطولة ({state.players.length} لاعب)
              </Button>
            )}
          </>
        )}

        {/* === SETUP PHASE === */}
        {state.phase === "setup" && (
          <div className="bg-card/60 border border-gold/30 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-gold text-center">إعداد البطولة</h3>

            <div>
              <label className="text-foreground text-xs mb-1 block">عدد اللاعبين في كل مباراة</label>
              <Select value={String(state.playersPerMatch)} onValueChange={v => setPlayersPerMatch(Number(v))}>
                <SelectTrigger className="bg-card/60 border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 لاعبين</SelectItem>
                  <SelectItem value="3">3 لاعبين</SelectItem>
                  <SelectItem value="4">4 لاعبين</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={autoGroupPlayers} variant="outline" className="w-full border-gold text-gold hover:bg-gold/10">
              <Shuffle className="w-4 h-4 ml-1" />
              تقسيم تلقائي ({Math.ceil(state.players.length / state.playersPerMatch)} مجموعة)
            </Button>

            {state.groups.length > 0 && (
              <>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">المجموعات:</p>
                  {state.groups.map((g, i) => (
                    <div key={g.id} className="bg-secondary/50 rounded-lg p-2">
                      <p className="text-xs text-gold font-bold mb-1">مجموعة {i + 1}</p>
                      <div className="flex flex-wrap gap-1">
                        {g.players.map(pid => (
                          <span key={pid} className="bg-accent/20 text-accent text-xs px-2 py-0.5 rounded">
                            {getPlayerName(pid)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={startTournament} className="w-full gold-gradient text-background font-bold rounded-xl">
                  <Play className="w-4 h-4 ml-1" />
                  ابدأ البطولة!
                </Button>
              </>
            )}
          </div>
        )}

        {/* === PLAYING PHASE === */}
        {state.phase === "playing" && (
          <>
            {/* Bracket */}
            <TournamentBracket matches={state.matches} currentRound={state.currentRound} getPlayerName={getPlayerName} />

            {/* Active matches */}
            <div className="bg-card/60 border border-gold/30 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-gold text-center">
                المباريات الجارية - الدور {state.currentRound}
              </h3>
              {getActiveMatches().map(match => (
                <div key={match.id} className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {match.players.map((pid, i) => (
                      <span key={pid} className="text-foreground text-sm font-bold">
                        {getPlayerName(pid)}
                        {i < match.players.length - 1 && <span className="text-muted-foreground mx-1">ضد</span>}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {match.players.map(pid => (
                      <Button
                        key={pid}
                        size="sm"
                        onClick={() => reportMatchResult(match.id, pid)}
                        className="text-xs bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30"
                      >
                        <Trophy className="w-3 h-3 ml-1" />
                        فوز {getPlayerName(pid)}
                      </Button>
                    ))}
                  </div>
                  {/* Disqualify buttons */}
                  <div className="flex flex-wrap gap-1 justify-center border-t border-border pt-2">
                    {match.players.map(pid => (
                      <button
                        key={pid}
                        onClick={() => disqualifyPlayer(pid)}
                        className="text-[10px] text-destructive hover:text-destructive/80 flex items-center gap-0.5"
                      >
                        <UserMinus className="w-3 h-3" />
                        فصل {getPlayerName(pid)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {getActiveMatches().length === 0 && (
                <p className="text-muted-foreground text-xs text-center">لا توجد مباريات جارية</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3 justify-center text-xs text-muted-foreground">
              <span>الدور: {state.currentRound} / {getTotalRounds() || state.currentRound}</span>
              <span>•</span>
              <span>انتهت: {getFinishedMatches().length} / {state.matches.length}</span>
            </div>
          </>
        )}

        {/* === FINISHED PHASE === */}
        {state.phase === "finished" && (
          <div className="bg-card/60 border border-gold/30 rounded-xl p-6 text-center space-y-4">
            <Trophy className="w-16 h-16 text-gold mx-auto animate-bounce" />
            <h2 className="text-2xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>
              انتهت البطولة!
            </h2>
            {state.champion && (
              <p className="text-accent font-bold text-lg">
                🏆 البطل: {getPlayerName(state.champion)}
              </p>
            )}
            <div className="flex gap-3 justify-center text-xs text-muted-foreground">
              <span>{state.players.length} لاعب</span>
              <span>•</span>
              <span>{getTotalRounds()} جولات</span>
              <span>•</span>
              <span>{state.matches.length} مباراة</span>
            </div>

            <TournamentBracket matches={state.matches} currentRound={state.currentRound} getPlayerName={getPlayerName} />

            <Button onClick={reset} variant="outline" className="border-gold text-gold hover:bg-gold/10">
              <RotateCcw className="w-4 h-4 ml-1" />
              بطولة جديدة
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalTournament;
