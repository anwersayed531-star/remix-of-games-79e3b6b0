import { useState } from "react";
import { Users, Shuffle, Play, Trophy, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TournamentState, Player } from "@/hooks/useTournament";

interface TournamentManagerProps {
  state: TournamentState;
  isHost: boolean;
  onSetPlayersPerMatch: (n: number) => void;
  onAutoGroup: () => void;
  onStartTournament: () => void;
  onStartSetup: () => void;
  getPlayerName: (id: string) => string;
}

const TournamentManager = ({
  state,
  isHost,
  onSetPlayersPerMatch,
  onAutoGroup,
  onStartTournament,
  onStartSetup,
  getPlayerName,
}: TournamentManagerProps) => {
  if (state.phase === "lobby") {
    return (
      <div className="bg-card/60 border border-gold/30 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 justify-center text-gold">
          <Users className="w-5 h-5" />
          <h3 className="font-bold text-sm">اللاعبون المتصلون ({state.players.length})</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {state.players.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                p.connected ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-accent" : "bg-muted-foreground"}`} />
              {p.name}
            </div>
          ))}
          {state.players.length === 0 && (
            <p className="col-span-2 text-muted-foreground text-xs text-center py-4">
              في انتظار اللاعبين...
            </p>
          )}
        </div>

        {isHost && state.players.length >= 2 && (
          <Button
            onClick={onStartSetup}
            className="w-full gold-gradient text-background font-bold rounded-xl"
          >
            <Settings2 className="w-4 h-4 ml-1" />
            إعداد البطولة
          </Button>
        )}
      </div>
    );
  }

  if (state.phase === "setup") {
    return (
      <div className="bg-card/60 border border-gold/30 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-gold text-center">إعداد البطولة</h3>
        
        <div>
          <label className="text-foreground text-xs mb-1 block">عدد اللاعبين في كل مباراة</label>
          <Select
            value={String(state.playersPerMatch)}
            onValueChange={(v) => onSetPlayersPerMatch(Number(v))}
          >
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

        <Button
          onClick={onAutoGroup}
          variant="outline"
          className="w-full border-gold text-gold hover:bg-gold/10"
        >
          <Shuffle className="w-4 h-4 ml-1" />
          تقسيم تلقائي ({Math.ceil(state.players.length / state.playersPerMatch)} مجموعة)
        </Button>

        {state.groups.length > 0 && (
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
        )}

        {state.groups.length > 0 && (
          <Button
            onClick={onStartTournament}
            className="w-full gold-gradient text-background font-bold rounded-xl"
          >
            <Play className="w-4 h-4 ml-1" />
            ابدأ البطولة!
          </Button>
        )}
      </div>
    );
  }

  if (state.phase === "finished") {
    return (
      <div className="bg-card/60 border border-gold/30 rounded-xl p-4 text-center space-y-3">
        <Trophy className="w-10 h-10 text-gold mx-auto" />
        <h3 className="font-bold text-lg text-gold">انتهت البطولة!</h3>
        {state.champion && (
          <p className="text-accent font-bold">
            🏆 البطل: {getPlayerName(state.champion)}
          </p>
        )}
      </div>
    );
  }

  return null;
};

export default TournamentManager;
