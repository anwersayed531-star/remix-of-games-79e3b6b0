import { useState, useCallback } from "react";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface TournamentMatch {
  id: string;
  groupIndex: number;
  players: string[];
  status: "pending" | "playing" | "finished";
  winnerId: string | null;
  round: number;
}

export interface TournamentGroup {
  id: string;
  players: string[];
  matchId: string | null;
}

export interface TournamentState {
  phase: "lobby" | "setup" | "playing" | "finished";
  players: Player[];
  playersPerMatch: number;
  groups: TournamentGroup[];
  matches: TournamentMatch[];
  currentRound: number;
  champion: string | null;
}

const initialState: TournamentState = {
  phase: "lobby",
  players: [],
  playersPerMatch: 2,
  groups: [],
  matches: [],
  currentRound: 1,
  champion: null,
};

export function useTournament() {
  const [state, setState] = useState<TournamentState>(initialState);

  const addPlayer = useCallback((player: Player) => {
    setState(prev => {
      if (prev.players.find(p => p.id === player.id)) return prev;
      return { ...prev, players: [...prev.players, player] };
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== playerId),
    }));
  }, []);

  const updatePlayerConnection = useCallback((playerId: string, connected: boolean) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, connected } : p),
    }));
  }, []);

  const setPlayersPerMatch = useCallback((count: number) => {
    setState(prev => ({ ...prev, playersPerMatch: Math.max(2, Math.min(4, count)) }));
  }, []);

  const startSetup = useCallback(() => {
    setState(prev => ({ ...prev, phase: "setup" }));
  }, []);

  const autoGroupPlayers = useCallback(() => {
    setState(prev => {
      const playerIds = prev.players.map(p => p.id);
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      const groups: TournamentGroup[] = [];
      const matches: TournamentMatch[] = [];
      let groupIdx = 0;

      for (let i = 0; i < shuffled.length; i += prev.playersPerMatch) {
        const groupPlayers = shuffled.slice(i, i + prev.playersPerMatch);
        if (groupPlayers.length < 2) {
          if (groups.length > 0) {
            groups[groups.length - 1].players.push(...groupPlayers);
            const lastMatch = matches[matches.length - 1];
            lastMatch.players.push(...groupPlayers);
          }
          break;
        }
        const matchId = `m_r1_${groupIdx}`;
        groups.push({ id: `g${groupIdx}`, players: groupPlayers, matchId });
        matches.push({
          id: matchId,
          groupIndex: groupIdx,
          players: groupPlayers,
          status: "pending",
          winnerId: null,
          round: 1,
        });
        groupIdx++;
      }

      return { ...prev, groups, matches, currentRound: 1 };
    });
  }, []);

  const setGroups = useCallback((groups: TournamentGroup[]) => {
    setState(prev => {
      const matches: TournamentMatch[] = groups.map((g, i) => ({
        id: `m_r1_${i}`,
        groupIndex: i,
        players: g.players,
        status: "pending" as const,
        winnerId: null,
        round: 1,
      }));
      return { ...prev, groups, matches: [...prev.matches.filter(m => m.round !== 1), ...matches] };
    });
  }, []);

  const startTournament = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: "playing",
      matches: prev.matches.map(m => m.round === prev.currentRound ? { ...m, status: "playing" as const } : m),
    }));
  }, []);

  const advanceRoundIfComplete = (prev: TournamentState, matches: TournamentMatch[]): TournamentState => {
    const currentRoundMatches = matches.filter(m => m.round === prev.currentRound);
    const allFinished = currentRoundMatches.every(m => m.status === "finished");

    if (!allFinished) return { ...prev, matches };

    const winners = currentRoundMatches.map(m => m.winnerId!).filter(Boolean);

    if (winners.length <= 1) {
      return { ...prev, matches, phase: "finished", champion: winners[0] || null };
    }

    const nextRound = prev.currentRound + 1;
    const nextMatches: TournamentMatch[] = [];
    for (let i = 0; i < winners.length; i += prev.playersPerMatch) {
      const group = winners.slice(i, i + prev.playersPerMatch);
      if (group.length < 2 && nextMatches.length > 0) {
        nextMatches[nextMatches.length - 1].players.push(...group);
        break;
      }
      nextMatches.push({
        id: `m_r${nextRound}_${nextMatches.length}`,
        groupIndex: nextMatches.length,
        players: group,
        status: "playing",
        winnerId: null,
        round: nextRound,
      });
    }

    return { ...prev, matches: [...matches, ...nextMatches], currentRound: nextRound };
  };

  const reportMatchResult = useCallback((matchId: string, winnerId: string) => {
    setState(prev => {
      const matches = prev.matches.map(m =>
        m.id === matchId ? { ...m, status: "finished" as const, winnerId } : m
      );
      return advanceRoundIfComplete(prev, matches);
    });
  }, []);

  const disqualifyPlayer = useCallback((playerId: string) => {
    setState(prev => {
      let matches = [...prev.matches];

      // Find active match containing this player
      const activeMatch = matches.find(
        m => m.status === "playing" && m.players.includes(playerId)
      );

      if (activeMatch) {
        const remainingPlayers = activeMatch.players.filter(p => p !== playerId);
        if (remainingPlayers.length === 1) {
          // Auto-win for the remaining player
          matches = matches.map(m =>
            m.id === activeMatch.id
              ? { ...m, status: "finished" as const, winnerId: remainingPlayers[0] }
              : m
          );
        } else if (remainingPlayers.length > 1) {
          // Just remove from match
          matches = matches.map(m =>
            m.id === activeMatch.id
              ? { ...m, players: remainingPlayers }
              : m
          );
          return { ...prev, matches };
        }
        return advanceRoundIfComplete(prev, matches);
      }

      // Also remove from pending matches
      matches = matches.map(m => {
        if (m.status === "pending" && m.players.includes(playerId)) {
          const remaining = m.players.filter(p => p !== playerId);
          if (remaining.length === 1) {
            return { ...m, status: "finished" as const, winnerId: remaining[0] };
          }
          return { ...m, players: remaining };
        }
        return m;
      });

      return advanceRoundIfComplete(prev, matches);
    });
  }, []);

  const getActiveMatches = useCallback(() => {
    return state.matches.filter(m => m.status === "playing");
  }, [state.matches]);

  const getFinishedMatches = useCallback(() => {
    return state.matches.filter(m => m.status === "finished");
  }, [state.matches]);

  const getPlayerName = useCallback((playerId: string) => {
    return state.players.find(p => p.id === playerId)?.name || playerId;
  }, [state.players]);

  const getTotalRounds = useCallback(() => {
    return Math.max(...state.matches.map(m => m.round), 0);
  }, [state.matches]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    setState,
    addPlayer,
    removePlayer,
    updatePlayerConnection,
    setPlayersPerMatch,
    startSetup,
    autoGroupPlayers,
    setGroups,
    startTournament,
    reportMatchResult,
    disqualifyPlayer,
    getActiveMatches,
    getFinishedMatches,
    getPlayerName,
    getTotalRounds,
    reset,
  };
}
