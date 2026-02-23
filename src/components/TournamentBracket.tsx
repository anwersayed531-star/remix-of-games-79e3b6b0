import type { TournamentMatch } from "@/hooks/useTournament";

interface TournamentBracketProps {
  matches: TournamentMatch[];
  currentRound: number;
  getPlayerName: (id: string) => string;
}

const TournamentBracket = ({ matches, currentRound, getPlayerName }: TournamentBracketProps) => {
  const rounds = Array.from(new Set(matches.map(m => m.round))).sort();

  return (
    <div className="bg-card/60 border border-gold/30 rounded-xl p-3 overflow-x-auto">
      <h4 className="text-xs text-gold font-bold mb-2 text-center">شجرة البطولة</h4>
      <div className="flex gap-4 min-w-fit">
        {rounds.map(round => {
          const roundMatches = matches.filter(m => m.round === round);
          return (
            <div key={round} className="flex flex-col gap-2 min-w-[120px]">
              <p className="text-[10px] text-muted-foreground text-center font-bold">
                {round === rounds[rounds.length - 1] && rounds.length > 1 ? "النهائي" : `الدور ${round}`}
              </p>
              {roundMatches.map(match => (
                <div
                  key={match.id}
                  className={`rounded-lg p-2 text-xs border ${
                    match.status === "playing"
                      ? "border-accent/50 bg-accent/10"
                      : match.status === "finished"
                      ? "border-gold/30 bg-gold/5"
                      : "border-border bg-secondary/30"
                  }`}
                >
                  {match.players.map(pid => (
                    <div
                      key={pid}
                      className={`flex items-center gap-1 py-0.5 ${
                        match.winnerId === pid
                          ? "text-accent font-bold"
                          : match.winnerId && match.winnerId !== pid
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {match.winnerId === pid && <span>🏆</span>}
                      <span className="truncate">{getPlayerName(pid)}</span>
                    </div>
                  ))}
                  {match.status === "playing" && (
                    <span className="text-[10px] text-accent animate-pulse">جارية...</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentBracket;
