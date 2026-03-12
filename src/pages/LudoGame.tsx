import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, RotateCcw, Settings2, Dice5, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NetworkLobby from "@/components/NetworkLobby";
import TournamentManager from "@/components/TournamentManager";
import MatchSidebar from "@/components/MatchSidebar";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useTournament } from "@/hooks/useTournament";
import { useGameSounds } from "@/hooks/useGameSounds";

type PlayerColor = "red" | "green" | "yellow" | "blue";
const ALL_COLORS: PlayerColor[] = ["red", "green", "yellow", "blue"];
const COLOR_NAMES: Record<PlayerColor, string> = {
  red: "الأحمر", green: "الأخضر", yellow: "الأصفر", blue: "الأزرق"
};

const MAIN_TRACK: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
];

const HOME_COLS: Record<PlayerColor, [number, number][]> = {
  red: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

const BASES: Record<PlayerColor, [number, number][]> = {
  red: [[2,2],[2,3],[3,2],[3,3]],
  green: [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue: [[11,2],[11,3],[12,2],[12,3]],
};

const START: Record<PlayerColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

const COLOR_HEX: Record<PlayerColor, { bg: string; light: string; dark: string; glow: string }> = {
  red: { bg: "#dc2626", light: "#ef4444", dark: "#991b1b", glow: "#fca5a5" },
  green: { bg: "#16a34a", light: "#22c55e", dark: "#166534", glow: "#86efac" },
  yellow: { bg: "#eab308", light: "#facc15", dark: "#a16207", glow: "#fef08a" },
  blue: { bg: "#2563eb", light: "#3b82f6", dark: "#1e3a8a", glow: "#93c5fd" },
};

type PieceTheme = "ludo" | "gems" | "stars" | "classic";
const PIECE_ICONS: Record<PieceTheme, { name: string; render: (color: PlayerColor) => string }> = {
  ludo: { name: "لودو", render: () => "" },
  gems: { name: "جواهر", render: (c) => ({ red: "♦️", green: "💚", yellow: "💛", blue: "💎" }[c]) },
  stars: { name: "نجوم", render: (c) => ({ red: "🔴", green: "🟢", yellow: "🟡", blue: "🔵" }[c]) },
  classic: { name: "كلاسيكي", render: (c) => ({ red: "🏠", green: "🏠", yellow: "🏠", blue: "🏠" }[c]) },
};

interface Piece { id: number; color: PlayerColor; pos: number; }

function getCoords(p: Piece): [number, number] {
  if (p.pos === -1) return BASES[p.color][p.id];
  if (p.pos >= 51 && p.pos <= 56) return HOME_COLS[p.color][p.pos - 51];
  if (p.pos === 57) return [7, 7];
  const abs = (START[p.color] + p.pos) % 52;
  return MAIN_TRACK[abs];
}

function getAbsTrack(color: PlayerColor, pos: number): number {
  return (START[color] + pos) % 52;
}

function getStepPositions(color: PlayerColor, fromPos: number, toPos: number): [number, number][] {
  const steps: [number, number][] = [];
  if (fromPos === -1) {
    steps.push(MAIN_TRACK[(START[color]) % 52]);
    return steps;
  }
  for (let p = fromPos + 1; p <= toPos; p++) {
    if (p >= 51 && p <= 56) steps.push(HOME_COLS[color][p - 51]);
    else if (p === 57) steps.push([7, 7]);
    else steps.push(MAIN_TRACK[(START[color] + p) % 52]);
  }
  return steps;
}

type GameMode = "local" | "network";
type LudoDifficulty = "easy" | "medium" | "hard" | "impossible";

// SVG Dice Component
const DiceFace = ({ value, size = 56, rolling = false }: { value: number; size?: number; rolling?: boolean }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  const dots = dotPositions[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={rolling ? "dice-rolling" : ""}>
      <defs>
        <linearGradient id="diceBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#faf3e8" />
          <stop offset="100%" stopColor="#e8dcc8" />
        </linearGradient>
        <filter id="diceShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="16" fill="url(#diceBg)" stroke="#b8a080" strokeWidth="2" filter="url(#diceShadow)" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="10" fill="#2c1810" />
      ))}
    </svg>
  );
};

const LudoGame = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [gameMode, setGameMode] = useState<GameMode>("local");
  const [playerCount, setPlayerCount] = useState(4);
  const [aiPlayers, setAiPlayers] = useState<PlayerColor[]>(["green", "yellow", "blue"]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [current, setCurrent] = useState<PlayerColor>("red");
  const [dice, setDice] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [dispDice, setDispDice] = useState(1);
  const [mustRoll, setMustRoll] = useState(true);
  const [sixes, setSixes] = useState(0);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [validPieces, setValidPieces] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("دور الأحمر - ارمِ النرد!");
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>("ludo");
  const [ludoDifficulty, setLudoDifficulty] = useState<LudoDifficulty>("medium");
  const [animating, setAnimating] = useState(false);
  const [animPiece, setAnimPiece] = useState<{ color: PlayerColor; id: number } | null>(null);
  const [animCoords, setAnimCoords] = useState<[number, number] | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const mp = useMultiplayerSync();
  const tournament = useTournament();
  const { play } = useGameSounds();
  const isHostPlayer = mp.role === "host";
  const isNetworkMode = gameMode === "network" && mp.status === "connected";
  const myColor: PlayerColor = mp.role === "host" ? "red" : "green";

  const activePlayers = useMemo(() => {
    if (isNetworkMode) return ["red", "green"] as PlayerColor[];
    return ALL_COLORS.slice(0, playerCount);
  }, [playerCount, isNetworkMode]);

  const initGame = useCallback(() => {
    const colors = isNetworkMode ? (["red", "green"] as PlayerColor[]) : ALL_COLORS.slice(0, playerCount);
    const ps: Piece[] = [];
    for (const c of colors) for (let i = 0; i < 4; i++) ps.push({ id: i, color: c, pos: -1 });
    setPieces(ps);
    setCurrent("red");
    setDice(null);
    setMustRoll(true);
    setSixes(0);
    setWinner(null);
    setValidPieces([]);
    setAnimating(false);
    setAnimPiece(null);
    setAnimCoords(null);
    setMessage(`دور ${COLOR_NAMES.red} - ارمِ النرد!`);
  }, [playerCount, isNetworkMode]);

  useEffect(() => { initGame(); }, [initGame]);

  useEffect(() => {
    if (!isNetworkMode) return;
    mp.onGameState((state: any) => {
      setPieces(state.pieces); setCurrent(state.current); setDice(state.dice);
      setMustRoll(state.mustRoll); setSixes(state.sixes); setWinner(state.winner);
      setValidPieces(state.validPieces); setMessage(state.message);
    });
    mp.onReset(() => { initGame(); });
  }, [isNetworkMode, mp, initGame]);

  const sendState = useCallback((overrides: any = {}) => {
    if (!isNetworkMode) return;
    mp.sendGameState({ pieces, current, dice, mustRoll, sixes, winner, validPieces, message, ...overrides });
  }, [isNetworkMode, mp, pieces, current, dice, mustRoll, sixes, winner, validPieces, message]);

  const getValid = useCallback((ps: Piece[], color: PlayerColor, d: number): number[] => {
    return ps.filter(p => p.color === color && p.pos !== 57).filter(p => {
      if (p.pos === -1) return d === 6;
      return p.pos + d <= 57;
    }).map(p => p.id);
  }, []);

  const nextPlayer = useCallback((cur: PlayerColor) => {
    const idx = activePlayers.indexOf(cur);
    return activePlayers[(idx + 1) % activePlayers.length];
  }, [activePlayers]);

  const isMyTurnNow = isNetworkMode ? current === myColor : true;

  const doRoll = useCallback(() => {
    if (!mustRoll || winner || rolling || animating) return;
    if (isNetworkMode && !isMyTurnNow) return;
    if (!isNetworkMode && aiPlayers.includes(current)) return;

    setRolling(true);
    if (soundOn) play("dice");
    let count = 0;
    const iv = setInterval(() => {
      setDispDice(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 12) {
        clearInterval(iv);
        const val = Math.floor(Math.random() * 6) + 1;
        setDispDice(val);
        setDice(val);
        setRolling(false);
        setMustRoll(false);

        const valid = getValid(pieces, current, val);
        if (valid.length === 0) {
          const msg = `${COLOR_NAMES[current]} لا يمكنه التحرك! الدور التالي.`;
          setMessage(msg);
          setTimeout(() => {
            const next = nextPlayer(current);
            setCurrent(next);
            setDice(null);
            setMustRoll(true);
            setSixes(0);
            setValidPieces([]);
            if (soundOn) play("turnChange");
            const nextMsg = `دور ${COLOR_NAMES[next]} - ارمِ النرد!`;
            setMessage(nextMsg);
            if (isNetworkMode) sendState({ current: next, dice: null, mustRoll: true, sixes: 0, validPieces: [], message: nextMsg });
          }, 800);
        } else {
          setValidPieces(valid);
          const msg = `${COLOR_NAMES[current]} رمى ${val}! اختر قطعة.`;
          setMessage(msg);
          if (isNetworkMode) sendState({ dice: val, mustRoll: false, validPieces: valid, message: msg });
        }
      }
    }, 70);
  }, [mustRoll, winner, rolling, animating, pieces, current, getValid, nextPlayer, isNetworkMode, isMyTurnNow, aiPlayers, sendState, soundOn, play]);

  const movePiece = useCallback((pieceId: number) => {
    if (!dice || !validPieces.includes(pieceId) || animating) return;
    if (isNetworkMode && !isMyTurnNow) return;

    const piece = pieces.find(p => p.color === current && p.id === pieceId)!;
    const fromPos = piece.pos;
    const toPos = fromPos === -1 ? 0 : fromPos + dice;
    const steps = getStepPositions(current, fromPos, toPos);

    setAnimating(true);
    setValidPieces([]);
    setAnimPiece({ color: current, id: pieceId });

    let stepIdx = 0;
    const animInterval = setInterval(() => {
      if (stepIdx < steps.length) {
        setAnimCoords(steps[stepIdx]);
        if (soundOn) play("pieceSlide");
        stepIdx++;
      } else {
        clearInterval(animInterval);
        setAnimPiece(null);
        setAnimCoords(null);

        const newPieces = pieces.map(p => ({ ...p }));
        const movedPiece = newPieces.find(p => p.color === current && p.id === pieceId)!;

        if (movedPiece.pos === -1) movedPiece.pos = 0;
        else movedPiece.pos += dice;

        let captured = false;
        if (movedPiece.pos >= 0 && movedPiece.pos <= 50) {
          const abs = getAbsTrack(movedPiece.color, movedPiece.pos);
          if (!SAFE.includes(abs)) {
            for (const other of newPieces) {
              if (other.color !== movedPiece.color && other.pos >= 0 && other.pos <= 50) {
                if (getAbsTrack(other.color, other.pos) === abs) {
                  other.pos = -1;
                  captured = true;
                }
              }
            }
          }
        }

        if (captured && soundOn) play("capture");

        if (movedPiece.pos === 57) {
          const allHome = newPieces.filter(p => p.color === movedPiece.color).every(p => p.pos === 57);
          if (allHome) {
            setWinner(movedPiece.color);
            setMessage(`🏆 ${COLOR_NAMES[movedPiece.color]} فاز!`);
            setPieces(newPieces);
            setAnimating(false);
            if (soundOn) play("win");
            if (isNetworkMode) sendState({ pieces: newPieces, winner: movedPiece.color, validPieces: [], message: `🏆 ${COLOR_NAMES[movedPiece.color]} فاز!` });
            return;
          }
        }

        setPieces(newPieces);

        let newCurrent = current;
        let newSixes = sixes;
        let msg = "";

        if (captured) {
          newSixes = 0;
          msg = `${COLOR_NAMES[current]} أكل قطعة! ارمِ مرة أخرى!`;
        } else if (dice === 6) {
          newSixes = sixes + 1;
          if (newSixes >= 3) {
            newSixes = 0;
            newCurrent = nextPlayer(current);
            msg = `${COLOR_NAMES[current]} رمى 3 ستات متتالية! الدور انتقل.`;
          } else {
            msg = `${COLOR_NAMES[current]} رمى 6! ارمِ مرة أخرى!`;
          }
        } else {
          newSixes = 0;
          newCurrent = nextPlayer(current);
          msg = `دور ${COLOR_NAMES[newCurrent]} - ارمِ النرد!`;
        }

        if (newCurrent !== current && soundOn) play("turnChange");

        setDice(null);
        setMustRoll(true);
        setSixes(newSixes);
        setCurrent(newCurrent);
        setMessage(msg);
        setAnimating(false);

        if (isNetworkMode) sendState({ pieces: newPieces, current: newCurrent, dice: null, mustRoll: true, sixes: newSixes, validPieces: [], message: msg });
      }
    }, 200);
  }, [dice, validPieces, animating, pieces, current, sixes, nextPlayer, isNetworkMode, isMyTurnNow, sendState, soundOn, play]);

  // AI move
  useEffect(() => {
    if (winner || mustRoll || animating || isNetworkMode) return;
    if (!aiPlayers.includes(current) || validPieces.length === 0) return;
    const timeout = setTimeout(() => {
      let bestId = validPieces[0];
      const myPieces = pieces.filter(p => p.color === current && validPieces.includes(p.id));
      for (const p of myPieces) {
        const newPos = p.pos === -1 ? 0 : p.pos + dice!;
        if (newPos === 57) { bestId = p.id; break; }
        if (newPos >= 0 && newPos <= 50) {
          const abs = getAbsTrack(p.color, newPos);
          if (pieces.some(o => o.color !== p.color && o.pos >= 0 && o.pos <= 50 && getAbsTrack(o.color, o.pos) === abs && !SAFE.includes(abs))) { bestId = p.id; break; }
        }
      }
      if (bestId === validPieces[0]) {
        const inBase = myPieces.find(p => p.pos === -1);
        if (inBase && dice === 6) bestId = inBase.id;
        else bestId = [...myPieces].sort((a, b) => b.pos - a.pos)[0].id;
      }
      movePiece(bestId);
    }, 600);
    return () => clearTimeout(timeout);
  }, [validPieces, current, aiPlayers, mustRoll, winner, pieces, dice, movePiece, isNetworkMode, animating]);

  // AI roll
  useEffect(() => {
    if (winner || !mustRoll || animating || isNetworkMode) return;
    if (!aiPlayers.includes(current)) return;
    const timeout = setTimeout(() => doRoll(), 700);
    return () => clearTimeout(timeout);
  }, [mustRoll, current, aiPlayers, winner, doRoll, isNetworkMode, animating]);

  const handleNetworkReset = useCallback(() => {
    initGame();
    if (isNetworkMode) mp.sendReset();
  }, [initGame, isNetworkMode, mp]);

  if (gameMode === "network" && mp.status !== "connected") {
    return (
      <NetworkLobby
        status={mp.status} role={mp.role} localCode={mp.localCode}
        answerCode={mp.answerCode} error={mp.error}
        onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom}
        onHandleAnswer={mp.handleAnswer} onGenerateNext={mp.generateOfferForNext}
        onDisconnect={mp.disconnect} onBack={() => setGameMode("local")}
        gameName="لودو" peerCount={mp.peerCount} peers={mp.peers}
      />
    );
  }

  const showTournament = isNetworkMode && mp.peerCount > 1 && tournament.state.phase !== "playing";
  const showSidebar = isNetworkMode && tournament.state.matches.length > 0;

  const pieceMap = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (animPiece && p.color === animPiece.color && p.id === animPiece.id) continue;
    const [r, c] = getCoords(p);
    const key = `${r},${c}`;
    if (!pieceMap.has(key)) pieceMap.set(key, []);
    pieceMap.get(key)!.push(p);
  }
  if (animPiece && animCoords) {
    const key = `${animCoords[0]},${animCoords[1]}`;
    const p = pieces.find(pp => pp.color === animPiece.color && pp.id === animPiece.id);
    if (p) {
      if (!pieceMap.has(key)) pieceMap.set(key, []);
      pieceMap.get(key)!.push(p);
    }
  }

  const getCellBg = (row: number, col: number): string | null => {
    if (row < 6 && col < 6) return COLOR_HEX.red.dark;
    if (row < 6 && col > 8) return COLOR_HEX.green.dark;
    if (row > 8 && col > 8) return COLOR_HEX.yellow.dark;
    if (row > 8 && col < 6) return COLOR_HEX.blue.dark;
    if (row === 7 && col === 7) return "#8b5e3c";
    if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
      if (row === 6 && col === 6) return COLOR_HEX.red.bg;
      if (row === 6 && col === 8) return COLOR_HEX.green.bg;
      if (row === 8 && col === 8) return COLOR_HEX.yellow.bg;
      if (row === 8 && col === 6) return COLOR_HEX.blue.bg;
      if (row === 7 && col === 6) return COLOR_HEX.red.light;
      if (row === 6 && col === 7) return COLOR_HEX.green.light;
      if (row === 7 && col === 8) return COLOR_HEX.yellow.light;
      if (row === 8 && col === 7) return COLOR_HEX.blue.light;
    }
    for (const [color, cells] of Object.entries(HOME_COLS)) {
      if (cells.some(([r, c]) => r === row && c === col)) return COLOR_HEX[color as PlayerColor].light;
    }
    const tIdx = MAIN_TRACK.findIndex(([r, c]) => r === row && c === col);
    if (tIdx >= 0) {
      if ([0].includes(tIdx)) return COLOR_HEX.red.light;
      if ([13].includes(tIdx)) return COLOR_HEX.green.light;
      if ([26].includes(tIdx)) return COLOR_HEX.yellow.light;
      if ([39].includes(tIdx)) return COLOR_HEX.blue.light;
      if (SAFE.includes(tIdx)) return "#f0e6d3";
      return "#faf3e8";
    }
    return "#faf3e8";
  };

  const isBaseSpot = (row: number, col: number): PlayerColor | null => {
    for (const [color, spots] of Object.entries(BASES)) {
      if (spots.some(([r, c]) => r === row && c === col)) return color as PlayerColor;
    }
    return null;
  };

  const isBoardCell = (row: number, col: number): boolean => {
    if (row < 6 && col < 6) return true;
    if (row < 6 && col > 8) return true;
    if (row > 8 && col > 8) return true;
    if (row > 8 && col < 6) return true;
    if ((row >= 6 && row <= 8) || (col >= 6 && col <= 8)) return true;
    return false;
  };

  const renderPiece = (p: Piece, canInteract: boolean, sizeClass: string) => {
    const isAnimatingThis = animPiece && animPiece.color === p.color && animPiece.id === p.id;
    const isLudo = pieceTheme === "ludo";
    const icon = !isLudo ? PIECE_ICONS[pieceTheme].render(p.color) : null;

    return (
      <button
        key={`${p.color}-${p.id}`}
        onClick={() => canInteract ? movePiece(p.id) : undefined}
        disabled={!canInteract}
        className={`${sizeClass} flex items-center justify-center transition-all duration-200 ${
          isAnimatingThis ? "z-20 scale-125 piece-bounce" : ""
        } ${canInteract ? "cursor-pointer z-10" : "cursor-default"}`}
        style={{ position: "relative" }}
      >
        {isLudo ? (
          // SVG Ludo pawn piece
          <svg viewBox="0 0 40 50" className="w-full h-full" style={{ filter: canInteract ? `drop-shadow(0 0 4px ${COLOR_HEX[p.color].glow})` : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
            <defs>
              <linearGradient id={`pawn-${p.color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLOR_HEX[p.color].light} />
                <stop offset="100%" stopColor={COLOR_HEX[p.color].dark} />
              </linearGradient>
              <radialGradient id={`shine-${p.color}`} cx="35%" cy="30%">
                <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Base */}
            <ellipse cx="20" cy="46" rx="14" ry="4" fill={COLOR_HEX[p.color].dark} />
            {/* Body */}
            <path d="M10,44 Q8,35 12,25 Q14,20 20,18 Q26,20 28,25 Q32,35 30,44 Z" fill={`url(#pawn-${p.color})`} stroke={COLOR_HEX[p.color].dark} strokeWidth="0.8" />
            {/* Head */}
            <circle cx="20" cy="13" r="9" fill={`url(#pawn-${p.color})`} stroke={COLOR_HEX[p.color].dark} strokeWidth="0.8" />
            {/* Shine */}
            <circle cx="20" cy="13" r="9" fill={`url(#shine-${p.color})`} />
            <path d="M12,30 Q20,28 28,30" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
            {canInteract && (
              <circle cx="20" cy="13" r="12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6">
                <animate attributeName="r" values="10;14;10" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        ) : (
          <span className="text-[10px] leading-none select-none piece-3d" style={{ filter: canInteract ? `drop-shadow(0 0 6px ${COLOR_HEX[p.color].glow})` : "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>
            {icon}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-[100dvh] wood-texture flex flex-col items-center px-1 py-1 sm:p-3">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-1 sm:mb-3">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>🎲 {t("ludo_title")}</h1>
        <div className="flex gap-1">
          <button onClick={() => setSoundOn(!soundOn)} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
            {soundOn ? <Volume2 className="w-4 h-4 text-gold" /> : <VolumeX className="w-4 h-4 text-gold" />}
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
            <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
          </button>
        </div>
      </div>

      {isNetworkMode && (
        <div className="flex items-center gap-2 mb-1 text-accent text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          متصل — أنت {mp.role === "host" ? COLOR_NAMES.red : COLOR_NAMES.green}
        </div>
      )}

      {/* Player indicators */}
      <div className="flex gap-1.5 sm:gap-2 mb-2 flex-wrap justify-center">
        {activePlayers.map(c => (
          <div
            key={c}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all border ${
              current === c ? "ring-2 ring-gold scale-110 border-gold" : "opacity-60 border-transparent"
            }`}
            style={{ backgroundColor: COLOR_HEX[c].bg + "30", color: COLOR_HEX[c].light }}
          >
            {aiPlayers.includes(c) && !isNetworkMode ? "🤖" : "👤"} {COLOR_NAMES[c]}
          </div>
        ))}
      </div>

      <p className="text-foreground text-[10px] sm:text-xs mb-2 text-center max-w-xs">{message}</p>

      {/* Board with 3D effect */}
      <div
        className="board-3d border-2 sm:border-4 border-gold rounded-xl overflow-hidden"
        style={{ width: "min(calc(100vw - 8px), 420px)", height: "min(calc(100vw - 8px), 420px)" }}
      >
        <div className="grid grid-cols-[repeat(15,1fr)] w-full h-full">
          {Array.from({ length: 225 }, (_, i) => {
            const row = Math.floor(i / 15);
            const col = i % 15;
            if (!isBoardCell(row, col)) return <div key={i} style={{ backgroundColor: "#2c1810" }} />;
            const bg = getCellBg(row, col);
            const piecesHere = pieceMap.get(`${row},${col}`) || [];
            const baseColor = isBaseSpot(row, col);
            const tIdx = MAIN_TRACK.findIndex(([r, c]) => r === row && c === col);
            const isStar = tIdx >= 0 && SAFE.includes(tIdx) && ![0, 13, 26, 39].includes(tIdx);

            return (
              <div
                key={i}
                className="relative flex items-center justify-center"
                style={{
                  backgroundColor: bg || "#2c1810",
                  borderRight: "0.5px solid rgba(0,0,0,0.1)",
                  borderBottom: "0.5px solid rgba(0,0,0,0.1)",
                }}
              >
                {baseColor && (
                  <div
                    className="w-[70%] h-[70%] rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${COLOR_HEX[baseColor].light}60, ${COLOR_HEX[baseColor].dark}40)`,
                      border: `1px solid ${COLOR_HEX[baseColor].light}30`,
                    }}
                  />
                )}
                {isStar && <span className="absolute text-[6px] sm:text-[7px] opacity-50 text-amber-700">★</span>}
                {piecesHere.length > 0 && (
                  <div className={`absolute inset-0 flex flex-wrap items-center justify-center ${piecesHere.length > 1 ? "gap-0" : ""}`}>
                    {piecesHere.map((p) => {
                      const isValid = validPieces.includes(p.id) && p.color === current;
                      const canInteract = isValid && !animating && (isNetworkMode ? isMyTurnNow : !aiPlayers.includes(current));
                      const size = piecesHere.length > 2 ? "w-[38%] h-[38%]" : piecesHere.length > 1 ? "w-[45%] h-[45%]" : "w-[65%] h-[65%]";
                      return renderPiece(p, canInteract, size);
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dice & Controls */}
      <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4">
        <Button onClick={handleNetworkReset} variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <button
          onClick={doRoll}
          disabled={!mustRoll || !!winner || rolling || animating || (isNetworkMode ? !isMyTurnNow : aiPlayers.includes(current))}
          className={`transition-all ${
            mustRoll && !winner && !rolling && !animating && (isNetworkMode ? isMyTurnNow : !aiPlayers.includes(current))
              ? "cursor-pointer hover:scale-110 active:scale-95"
              : "cursor-default opacity-70"
          }`}
        >
          <DiceFace value={rolling ? dispDice : dice || 1} size={56} rolling={rolling} />
        </button>
        <div className="text-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-gold mx-auto"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${COLOR_HEX[current]?.light}, ${COLOR_HEX[current]?.dark})`,
            }}
          />
          <p className="text-[10px] text-muted-foreground mt-1">{COLOR_NAMES[current]}</p>
        </div>
      </div>

      {/* Winner */}
      {winner && (
        <div className="mt-4 p-4 rounded-xl border-2 border-gold bg-card/80 text-center animate-celebrate">
          <p className="text-xl sm:text-2xl font-bold text-gold">🏆 {COLOR_NAMES[winner]} {t("wins")}</p>
          <Button onClick={handleNetworkReset} className="mt-2 gold-gradient text-background font-bold">{t("new_game")}</Button>
        </div>
      )}

      {/* Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="wood-texture border-2 border-gold max-w-sm">
          <DialogHeader><DialogTitle className="text-gold text-center" style={{ fontFamily: "'Cinzel', serif" }}>{t("game_settings")} {t("ludo_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-foreground text-sm mb-2 block">{t("game_mode")}</label>
              <Select value={gameMode} onValueChange={(v: GameMode) => { setGameMode(v); }}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">{t("local_play")}</SelectItem>
                  <SelectItem value="network">{t("online")} 📶</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {gameMode === "local" && (
              <>
                <div>
                  <label className="text-foreground text-sm mb-2 block">{t("num_players")}</label>
                  <Select value={String(playerCount)} onValueChange={(v) => { setPlayerCount(Number(v)); }}>
                    <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 لاعبين</SelectItem>
                      <SelectItem value="3">3 لاعبين</SelectItem>
                      <SelectItem value="4">4 لاعبين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-foreground text-sm mb-2 block">لاعبو الكمبيوتر 🤖</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COLORS.slice(1, playerCount).map(c => (
                      <button
                        key={c}
                        onClick={() => setAiPlayers(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${
                          aiPlayers.includes(c) ? "border-gold text-foreground" : "border-muted text-muted-foreground"
                        }`}
                        style={{ backgroundColor: aiPlayers.includes(c) ? COLOR_HEX[c].bg : "transparent" }}
                      >
                        {COLOR_NAMES[c]} {aiPlayers.includes(c) ? "🤖" : "👤"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-foreground text-sm mb-2 block">{t("piece_style")}</label>
              <Select value={pieceTheme} onValueChange={(v: PieceTheme) => setPieceTheme(v)}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ludo">🎯 لودو</SelectItem>
                  <SelectItem value="gems">💎 جواهر</SelectItem>
                  <SelectItem value="stars">⭐ نجوم</SelectItem>
                  <SelectItem value="classic">🏠 كلاسيكي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showTournament && (
        <div className="w-full max-w-lg mt-4">
          <TournamentManager state={tournament.state} isHost={isHostPlayer}
            onSetPlayersPerMatch={tournament.setPlayersPerMatch} onAutoGroup={tournament.autoGroupPlayers}
            onStartTournament={tournament.startTournament} onStartSetup={tournament.startSetup}
            getPlayerName={tournament.getPlayerName} />
        </div>
      )}
      {showSidebar && <MatchSidebar matches={tournament.state.matches} getPlayerName={tournament.getPlayerName} />}
    </div>
  );
};

export default LudoGame;
