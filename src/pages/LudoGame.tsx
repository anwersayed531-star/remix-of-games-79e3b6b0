import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Settings2, Dice5 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiplayerLobby from "@/components/MultiplayerLobby";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";

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
  red: { bg: "#c0392b", light: "#e74c3c", dark: "#922b21", glow: "#ff6b6b" },
  green: { bg: "#27ae60", light: "#2ecc71", dark: "#1e8449", glow: "#69ff97" },
  yellow: { bg: "#f39c12", light: "#f1c40f", dark: "#d68910", glow: "#ffe66d" },
  blue: { bg: "#2980b9", light: "#3498db", dark: "#1f618d", glow: "#74b9ff" },
};

type PieceTheme = "circles" | "pawns" | "stars" | "gems";
const PIECE_ICONS: Record<PieceTheme, { name: string; icons: Record<PlayerColor, string> }> = {
  circles: { name: "دوائر", icons: { red: "🔴", green: "🟢", yellow: "🟡", blue: "🔵" } },
  pawns: { name: "بيادق", icons: { red: "♟", green: "♟", yellow: "♟", blue: "♟" } },
  stars: { name: "نجوم", icons: { red: "⭐", green: "🌟", yellow: "✨", blue: "💫" } },
  gems: { name: "جواهر", icons: { red: "♦️", green: "💚", yellow: "💛", blue: "💎" } },
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

// Get all intermediate positions for step-by-step animation
function getStepPositions(color: PlayerColor, fromPos: number, toPos: number): [number, number][] {
  const steps: [number, number][] = [];
  if (fromPos === -1) {
    // Coming out of base - just show start position
    steps.push(MAIN_TRACK[(START[color]) % 52]);
    return steps;
  }
  for (let p = fromPos + 1; p <= toPos; p++) {
    if (p >= 51 && p <= 56) {
      steps.push(HOME_COLS[color][p - 51]);
    } else if (p === 57) {
      steps.push([7, 7]);
    } else {
      const abs = (START[color] + p) % 52;
      steps.push(MAIN_TRACK[abs]);
    }
  }
  return steps;
}

type GameMode = "local" | "network";

const LudoGame = () => {
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
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>("circles");
  const [animating, setAnimating] = useState(false);
  const [animPiece, setAnimPiece] = useState<{ color: PlayerColor; id: number } | null>(null);
  const [animCoords, setAnimCoords] = useState<[number, number] | null>(null);

  const mp = useMultiplayerSync();
  const isNetworkMode = gameMode === "network" && mp.status === "connected";
  const myColor: PlayerColor = mp.role === "host" ? "red" : "green";

  const activePlayers = useMemo(() => {
    if (isNetworkMode) return ["red", "green"] as PlayerColor[];
    return ALL_COLORS.slice(0, playerCount);
  }, [playerCount, isNetworkMode]);

  const initGame = useCallback(() => {
    const colors = isNetworkMode ? (["red", "green"] as PlayerColor[]) : ALL_COLORS.slice(0, playerCount);
    const ps: Piece[] = [];
    for (const c of colors) {
      for (let i = 0; i < 4; i++) ps.push({ id: i, color: c, pos: -1 });
    }
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

  // Listen for remote state
  useEffect(() => {
    if (!isNetworkMode) return;
    mp.onGameState((state: any) => {
      setPieces(state.pieces);
      setCurrent(state.current);
      setDice(state.dice);
      setMustRoll(state.mustRoll);
      setSixes(state.sixes);
      setWinner(state.winner);
      setValidPieces(state.validPieces);
      setMessage(state.message);
    });
    mp.onReset(() => { initGame(); });
  }, [isNetworkMode, mp, initGame]);

  const sendState = useCallback((overrides: any = {}) => {
    if (!isNetworkMode) return;
    const state = { pieces, current, dice, mustRoll, sixes, winner, validPieces, message, ...overrides };
    mp.sendGameState(state);
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
  }, [mustRoll, winner, rolling, animating, pieces, current, getValid, nextPlayer, isNetworkMode, isMyTurnNow, aiPlayers, sendState]);

  // Step-by-step animated move
  const movePiece = useCallback((pieceId: number) => {
    if (!dice || !validPieces.includes(pieceId) || animating) return;
    if (isNetworkMode && !isMyTurnNow) return;

    const piece = pieces.find(p => p.color === current && p.id === pieceId)!;
    const fromPos = piece.pos;
    const toPos = fromPos === -1 ? 0 : fromPos + dice;
    const steps = getStepPositions(current, fromPos, toPos);

    // Disable interactions during animation
    setAnimating(true);
    setValidPieces([]);
    setAnimPiece({ color: current, id: pieceId });

    // Animate step by step
    let stepIdx = 0;
    const animInterval = setInterval(() => {
      if (stepIdx < steps.length) {
        setAnimCoords(steps[stepIdx]);
        stepIdx++;
      } else {
        clearInterval(animInterval);
        setAnimPiece(null);
        setAnimCoords(null);

        // Now apply the actual move
        const newPieces = pieces.map(p => ({ ...p }));
        const movedPiece = newPieces.find(p => p.color === current && p.id === pieceId)!;

        if (movedPiece.pos === -1) {
          movedPiece.pos = 0;
        } else {
          movedPiece.pos += dice;
        }

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

        if (movedPiece.pos === 57) {
          const allHome = newPieces.filter(p => p.color === movedPiece.color).every(p => p.pos === 57);
          if (allHome) {
            setWinner(movedPiece.color);
            setMessage(`🏆 ${COLOR_NAMES[movedPiece.color]} فاز!`);
            setPieces(newPieces);
            setAnimating(false);
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

        setDice(null);
        setMustRoll(true);
        setSixes(newSixes);
        setCurrent(newCurrent);
        setMessage(msg);
        setAnimating(false);

        if (isNetworkMode) {
          sendState({ pieces: newPieces, current: newCurrent, dice: null, mustRoll: true, sixes: newSixes, validPieces: [], message: msg });
        }
      }
    }, 180); // 180ms per step
  }, [dice, validPieces, animating, pieces, current, sixes, nextPlayer, isNetworkMode, isMyTurnNow, sendState]);

  // AI move
  useEffect(() => {
    if (winner || mustRoll || animating) return;
    if (isNetworkMode) return;
    if (!aiPlayers.includes(current)) return;
    if (validPieces.length === 0) return;
    const timeout = setTimeout(() => {
      let bestId = validPieces[0];
      const myPieces = pieces.filter(p => p.color === current && validPieces.includes(p.id));

      for (const p of myPieces) {
        const newPos = p.pos === -1 ? 0 : p.pos + dice!;
        if (newPos === 57) { bestId = p.id; break; }
        if (newPos >= 0 && newPos <= 50) {
          const abs = getAbsTrack(p.color, newPos);
          const canCapture = pieces.some(o => o.color !== p.color && o.pos >= 0 && o.pos <= 50 && getAbsTrack(o.color, o.pos) === abs && !SAFE.includes(abs));
          if (canCapture) { bestId = p.id; break; }
        }
      }
      if (bestId === validPieces[0]) {
        const inBase = myPieces.find(p => p.pos === -1);
        if (inBase && dice === 6) bestId = inBase.id;
        else {
          const sorted = [...myPieces].sort((a, b) => b.pos - a.pos);
          bestId = sorted[0].id;
        }
      }
      movePiece(bestId);
    }, 600);
    return () => clearTimeout(timeout);
  }, [validPieces, current, aiPlayers, mustRoll, winner, pieces, dice, movePiece, isNetworkMode, animating]);

  // AI roll
  useEffect(() => {
    if (winner || !mustRoll || animating) return;
    if (isNetworkMode) return;
    if (!aiPlayers.includes(current)) return;
    const timeout = setTimeout(() => doRoll(), 700);
    return () => clearTimeout(timeout);
  }, [mustRoll, current, aiPlayers, winner, doRoll, isNetworkMode, animating]);

  const handleNetworkReset = useCallback(() => {
    initGame();
    if (isNetworkMode) mp.sendReset();
  }, [initGame, isNetworkMode, mp]);

  // Show lobby
  if (gameMode === "network" && mp.status !== "connected") {
    return (
      <MultiplayerLobby
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
        onBack={() => setGameMode("local")}
        gameName="لودو"
        peerCount={mp.peerCount}
        peers={mp.peers}
      />
    );
  }

  // Build piece map for rendering
  const pieceMap = new Map<string, Piece[]>();
  for (const p of pieces) {
    // Skip the animating piece from its original position
    if (animPiece && p.color === animPiece.color && p.id === animPiece.id) continue;
    const [r, c] = getCoords(p);
    const key = `${r},${c}`;
    if (!pieceMap.has(key)) pieceMap.set(key, []);
    pieceMap.get(key)!.push(p);
  }
  // Add animating piece at its current animated position
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
    if (row < 6 && (col < 6 || col > 8)) return null;
    if (row > 8 && (col < 6 || col > 8)) return null;
    if (col < 6 && (row < 6 || row > 8)) return null;
    if (col > 8 && (row < 6 || row > 8)) return null;
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

  const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  const renderPiece = (p: Piece, canInteract: boolean, size: string) => {
    const isAnimatingThis = animPiece && animPiece.color === p.color && animPiece.id === p.id;
    const useIcon = pieceTheme !== "circles";
    return (
      <button
        key={`${p.color}-${p.id}`}
        onClick={() => canInteract ? movePiece(p.id) : undefined}
        disabled={!canInteract}
        className={`${size} flex items-center justify-center transition-all duration-150 ${
          isAnimatingThis ? "z-20 scale-125" : ""
        } ${
          useIcon ? "" : "rounded-full border-2"
        } ${
          canInteract ? "animate-pulse cursor-pointer border-white shadow-lg scale-110 z-10" : useIcon ? "cursor-default" : "border-black/20 cursor-default"
        }`}
        style={{
          backgroundColor: useIcon ? "transparent" : COLOR_HEX[p.color].bg,
          boxShadow: canInteract ? `0 0 10px ${COLOR_HEX[p.color].glow}` : isAnimatingThis ? `0 0 12px ${COLOR_HEX[p.color].glow}` : "none",
        }}
      >
        {useIcon ? (
          <span className="text-[10px] leading-none select-none" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>
            {PIECE_ICONS[pieceTheme].icons[p.color]}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="min-h-screen wood-texture flex flex-col items-center p-3">
      <div className="w-full max-w-lg flex items-center justify-between mb-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold">
          <ArrowLeft className="w-5 h-5 text-gold" />
        </button>
        <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>🎲 لودو</h1>
        <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold">
          <Settings2 className="w-5 h-5 text-gold" />
        </button>
      </div>

      {isNetworkMode && (
        <div className="flex items-center gap-2 mb-1 text-accent text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          متصل — أنت {mp.role === "host" ? COLOR_NAMES.red : COLOR_NAMES.green}
        </div>
      )}

      {/* Player indicators */}
      <div className="flex gap-2 mb-2">
        {activePlayers.map(c => (
          <div
            key={c}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
              current === c ? "ring-2 ring-gold scale-110" : "opacity-60"
            }`}
            style={{ backgroundColor: COLOR_HEX[c].bg + "40", color: COLOR_HEX[c].light }}
          >
            {aiPlayers.includes(c) && !isNetworkMode ? "🤖" : "👤"} {COLOR_NAMES[c]}
          </div>
        ))}
      </div>

      <p className="text-foreground text-xs mb-2 text-center">{message}</p>

      {/* Board */}
      <div
        className="border-4 border-gold rounded-xl overflow-hidden shadow-2xl"
        style={{ width: "min(92vw, 420px)", height: "min(92vw, 420px)" }}
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
                className="relative flex items-center justify-center border border-black/10"
                style={{ backgroundColor: bg || "#2c1810" }}
              >
                {baseColor && (
                  <div
                    className="w-[70%] h-[70%] rounded-full border border-white/30"
                    style={{ backgroundColor: COLOR_HEX[baseColor].light + "40" }}
                  />
                )}
                {isStar && <span className="absolute text-[7px] opacity-40">★</span>}
                {piecesHere.length > 0 && (
                  <div className={`absolute inset-0 flex flex-wrap items-center justify-center ${piecesHere.length > 1 ? "gap-0" : ""}`}>
                    {piecesHere.map((p) => {
                      const isValid = validPieces.includes(p.id) && p.color === current;
                      const canInteract = isValid && !animating && (isNetworkMode ? isMyTurnNow : !aiPlayers.includes(current));
                      const size = piecesHere.length > 2 ? "w-[40%] h-[40%]" : piecesHere.length > 1 ? "w-[45%] h-[45%]" : "w-[65%] h-[65%]";
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
      <div className="flex items-center gap-4 mt-4">
        <Button onClick={handleNetworkReset} variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <button
          onClick={doRoll}
          disabled={!mustRoll || !!winner || rolling || animating || (isNetworkMode ? !isMyTurnNow : aiPlayers.includes(current))}
          className={`w-16 h-16 rounded-xl border-2 border-gold flex items-center justify-center text-4xl transition-all ${
            mustRoll && !winner && !rolling && !animating && (isNetworkMode ? isMyTurnNow : !aiPlayers.includes(current))
              ? "bg-card hover:bg-accent/20 cursor-pointer animate-bounce"
              : "bg-card/50 cursor-default"
          }`}
          style={{ color: COLOR_HEX[current]?.bg }}
        >
          {rolling ? DICE_FACES[dispDice - 1] : dice ? DICE_FACES[dice - 1] : <Dice5 className="w-8 h-8 text-gold" />}
        </button>
        <div className="text-center">
          <div className="w-6 h-6 rounded-full border-2 border-gold mx-auto" style={{ backgroundColor: COLOR_HEX[current]?.bg }} />
          <p className="text-[10px] text-muted-foreground mt-1">{COLOR_NAMES[current]}</p>
        </div>
      </div>

      {/* Winner */}
      {winner && (
        <div className="mt-4 p-4 rounded-xl border-2 border-gold bg-card/80 text-center animate-scale-in">
          <p className="text-2xl font-bold text-gold">🏆 فاز {COLOR_NAMES[winner]}!</p>
          <Button onClick={handleNetworkReset} className="mt-2 gold-gradient text-background font-bold">لعبة جديدة</Button>
        </div>
      )}

      {/* Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="wood-texture border-2 border-gold max-w-sm">
          <DialogHeader><DialogTitle className="text-gold text-center" style={{ fontFamily: "'Cinzel', serif" }}>إعدادات لودو</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-foreground text-sm mb-2 block">وضع اللعب</label>
              <Select value={gameMode} onValueChange={(v: GameMode) => { setGameMode(v); }}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">محلي</SelectItem>
                  <SelectItem value="network">عبر الشبكة 📶</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {gameMode === "local" && (
              <>
                <div>
                  <label className="text-foreground text-sm mb-2 block">عدد اللاعبين</label>
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
                  <p className="text-muted-foreground text-[10px] mt-1">اضغط لتبديل بين لاعب وكمبيوتر</p>
                </div>
              </>
            )}
            <div>
              <label className="text-foreground text-sm mb-2 block">شكل القطع</label>
              <Select value={pieceTheme} onValueChange={(v: PieceTheme) => setPieceTheme(v)}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="circles">🔴 دوائر</SelectItem>
                  <SelectItem value="pawns">♟ بيادق</SelectItem>
                  <SelectItem value="stars">⭐ نجوم</SelectItem>
                  <SelectItem value="gems">💎 جواهر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LudoGame;
