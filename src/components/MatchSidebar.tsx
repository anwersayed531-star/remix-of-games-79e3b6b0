import { GripVertical, Eye, Trophy, Swords, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useDraggableSidebar, type SidebarPosition } from "@/hooks/useDraggableSidebar";
import type { TournamentMatch } from "@/hooks/useTournament";

interface MatchSidebarProps {
  matches: TournamentMatch[];
  getPlayerName: (id: string) => string;
  onSpectate?: (matchId: string) => void;
  currentMatchId?: string;
}

const positionClasses: Record<SidebarPosition, { container: string; expanded: string; collapsed: string }> = {
  right: {
    container: "fixed top-1/2 -translate-y-1/2 right-0 z-50 flex flex-row-reverse",
    expanded: "w-56 h-[70vh] flex-col",
    collapsed: "w-12 h-[70vh] flex-col",
  },
  left: {
    container: "fixed top-1/2 -translate-y-1/2 left-0 z-50 flex flex-row",
    expanded: "w-56 h-[70vh] flex-col",
    collapsed: "w-12 h-[70vh] flex-col",
  },
  top: {
    container: "fixed left-1/2 -translate-x-1/2 top-0 z-50 flex flex-col",
    expanded: "h-48 w-[85vw] flex-row",
    collapsed: "h-12 w-[85vw] flex-row",
  },
  bottom: {
    container: "fixed left-1/2 -translate-x-1/2 bottom-0 z-50 flex flex-col-reverse",
    expanded: "h-48 w-[85vw] flex-row",
    collapsed: "h-12 w-[85vw] flex-row",
  },
};

const ChevronIcon = ({ position, isExpanded }: { position: SidebarPosition; isExpanded: boolean }) => {
  if (position === "right") return isExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />;
  if (position === "left") return isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />;
  if (position === "top") return isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  return isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />;
};

const MatchSidebar = ({ matches, getPlayerName, onSpectate, currentMatchId }: MatchSidebarProps) => {
  const { position, isExpanded, isDragging, toggleExpanded, handleDragStart } = useDraggableSidebar();

  if (matches.length === 0) return null;

  const activeMatches = matches.filter(m => m.status === "playing");
  const finishedMatches = matches.filter(m => m.status === "finished");
  const classes = positionClasses[position];
  const isVertical = position === "right" || position === "left";

  return (
    <div className={classes.container}>
      {/* Toggle button */}
      <button
        onClick={toggleExpanded}
        onTouchStart={handleDragStart}
        onMouseDown={handleDragStart}
        className={`bg-card/90 backdrop-blur border border-gold/40 flex items-center justify-center gap-1 text-gold transition-all
          ${isDragging ? "scale-110 opacity-70" : ""}
          ${isVertical ? "rounded-l-lg w-7 min-h-[60px]" : "rounded-t-lg h-7 min-w-[60px]"}
        `}
      >
        <GripVertical className="w-3 h-3 opacity-50" />
        <ChevronIcon position={position} isExpanded={isExpanded} />
        {!isExpanded && (
          <span className="text-[10px] font-bold">{activeMatches.length}</span>
        )}
      </button>

      {/* Content panel */}
      {isExpanded && (
        <div
          className={`bg-card/90 backdrop-blur border border-gold/30 overflow-y-auto ${classes.expanded}
            ${isVertical ? "rounded-l-xl" : "rounded-t-xl"}
          `}
        >
          <div className="p-2 space-y-2">
            {activeMatches.length > 0 && (
              <div>
                <p className="text-[10px] text-accent font-bold mb-1 flex items-center gap-1">
                  <Swords className="w-3 h-3" /> جارية ({activeMatches.length})
                </p>
                {activeMatches.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    getPlayerName={getPlayerName}
                    onSpectate={onSpectate}
                    isCurrent={currentMatchId === m.id}
                  />
                ))}
              </div>
            )}
            {finishedMatches.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-bold mb-1 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> منتهية ({finishedMatches.length})
                </p>
                {finishedMatches.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    getPlayerName={getPlayerName}
                    isCurrent={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MatchCard = ({
  match,
  getPlayerName,
  onSpectate,
  isCurrent,
}: {
  match: TournamentMatch;
  getPlayerName: (id: string) => string;
  onSpectate?: (id: string) => void;
  isCurrent: boolean;
}) => (
  <div
    className={`rounded-lg p-1.5 mb-1 text-[11px] border transition-all ${
      isCurrent
        ? "border-accent bg-accent/15"
        : match.status === "playing"
        ? "border-accent/30 bg-accent/5"
        : "border-border bg-secondary/20"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        {match.players.map(pid => (
          <div
            key={pid}
            className={`truncate ${
              match.winnerId === pid ? "text-accent font-bold" : 
              match.winnerId ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {match.winnerId === pid && "🏆 "}{getPlayerName(pid)}
          </div>
        ))}
      </div>
      {onSpectate && match.status === "playing" && !isCurrent && (
        <button
          onClick={() => onSpectate(match.id)}
          className="p-1 rounded bg-accent/20 text-accent hover:bg-accent/30 ml-1"
        >
          <Eye className="w-3 h-3" />
        </button>
      )}
    </div>
    {match.status === "playing" && (
      <span className="text-[9px] text-accent animate-pulse">⚡ جارية</span>
    )}
  </div>
);

export default MatchSidebar;
