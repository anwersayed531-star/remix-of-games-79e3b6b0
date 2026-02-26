import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiplayerLobby from "@/components/MultiplayerLobby";
import TournamentManager from "@/components/TournamentManager";
import MatchSidebar from "@/components/MatchSidebar";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useTournament } from "@/hooks/useTournament";
import { useGameSounds } from "@/hooks/useGameSounds";

type Cell = string | null;
type Mode = "local" | "ai" | "network";
type Difficulty = "easy" | "medium" | "hard";

const SYMBOL_SETS: Record<string, [string, string]> = {
  classic: ["✕", "◯"],
  emoji: ["😎", "🤖"],
  hearts: ["❤️", "💙"],
  stars: ["⭐", "🌙"],
  animals: ["🐱", "🐶"],
};

const XOGame = () => {
  const navigate = useNavigate();
  const [gridSize, setGridSize] = useState(3);
  const [symbolSet, setSymbolSet] = useState("classic");
  const [mode, setMode] = useState<Mode>("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isXTurn, setIsXTurn] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scores, setScores] = useState({ x: 0, o: 0, draw: 0 });
  const [soundOn, setSoundOn] = useState(true);

  const mp = useMultiplayerSync();
  const tournament = useTournament();
  const { play } = useGameSounds();
  const isHost = mp.role === "host";

  const symbols = SYMBOL_SETS[symbolSet];
  const totalCells = gridSize * gridSize;
  const winLength = gridSize >= 5 ? 4 : 3;

  const isNetworkMode = mode === "network" && mp.status === "connected";
  const mySymbol = mp.role === "host" ? "X" : "O";
  const isMyTurn = isNetworkMode ? mp.isMyTurn(isXTurn ? "X" : "O", "X", "O") : true;

  const resetBoard = useCallback(() => {
    setBoard(Array(totalCells).fill(null));
    setIsXTurn(true);
    setWinner(null);
    setWinLine(null);
  }, [totalCells]);

  useEffect(() => { resetBoard(); }, [gridSize, resetBoard]);

  useEffect(() => {
    if (!isNetworkMode) return;
    mp.onGameState((state: { board: Cell[]; isXTurn: boolean; winner: string | null; winLine: number[] | null; scores: typeof scores }) => {
      setBoard(state.board);
      setIsXTurn(state.isXTurn);
      setWinner(state.winner);
      setWinLine(state.winLine);
      if (state.scores) setScores(state.scores);
      if (soundOn) play("move");
    });
    mp.onReset(() => resetBoard());
  }, [isNetworkMode, mp, resetBoard, soundOn, play]);

  const checkWinner = useCallback((b: Cell[]): { winner: string | null; line: number[] | null } => {
    const lines: number[][] = [];
    for (let r = 0; r < gridSize; r++) for (let c = 0; c <= gridSize - winLength; c++) lines.push(Array.from({ length: winLength }, (_, i) => r * gridSize + c + i));
    for (let c = 0; c < gridSize; c++) for (let r = 0; r <= gridSize - winLength; r++) lines.push(Array.from({ length: winLength }, (_, i) => (r + i) * gridSize + c));
    for (let r = 0; r <= gridSize - winLength; r++) for (let c = 0; c <= gridSize - winLength; c++) lines.push(Array.from({ length: winLength }, (_, i) => (r + i) * gridSize + (c + i)));
    for (let r = 0; r <= gridSize - winLength; r++) for (let c = winLength - 1; c < gridSize; c++) lines.push(Array.from({ length: winLength }, (_, i) => (r + i) * gridSize + (c - i)));
    for (const line of lines) {
      const first = b[line[0]];
      if (first && line.every((idx) => b[idx] === first)) return { winner: first, line };
    }
    if (b.every((c) => c !== null)) return { winner: "draw", line: null };
    return { winner: null, line: null };
  }, [gridSize, winLength]);

  const aiMove = useCallback((b: Cell[]): number => {
    const empty = b.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    if (empty.length === 0) return -1;
    if (difficulty === "easy") return empty[Math.floor(Math.random() * empty.length)];
    for (const i of empty) { const t = [...b]; t[i] = "O"; if (checkWinner(t).winner === "O") return i; }
    for (const i of empty) { const t = [...b]; t[i] = "X"; if (checkWinner(t).winner === "X") return i; }
    if (difficulty === "hard") {
      const center = Math.floor(totalCells / 2);
      if (b[center] === null) return center;
      const corners = [0, gridSize - 1, totalCells - gridSize, totalCells - 1].filter((i) => b[i] === null);
      if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }, [difficulty, checkWinner, gridSize, totalCells]);

  const handleClick = useCallback((index: number) => {
    if (board[index] || winner) return;
    if (mode === "ai" && !isXTurn) return;
    if (isNetworkMode && !isMyTurn) return;

    if (soundOn) play("click");
    const newBoard = [...board];
    newBoard[index] = isXTurn ? "X" : "O";
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    let newScores = scores;
    let newWinner = null;
    let newWinLine = null;
    let nextIsXTurn = !isXTurn;

    if (result.winner) {
      newWinner = result.winner;
      newWinLine = result.line;
      setWinner(newWinner);
      setWinLine(newWinLine);
      if (result.winner === "X") newScores = { ...scores, x: scores.x + 1 };
      else if (result.winner === "O") newScores = { ...scores, o: scores.o + 1 };
      else newScores = { ...scores, draw: scores.draw + 1 };
      setScores(newScores);
      if (soundOn) play(result.winner === "draw" ? "draw" : "win");
    }

    if (isNetworkMode) {
      mp.sendGameState({ board: newBoard, isXTurn: nextIsXTurn, winner: newWinner, winLine: newWinLine, scores: newScores });
      if (!result.winner) setIsXTurn(nextIsXTurn);
      return;
    }

    if (result.winner) return;

    if (mode === "ai" && isXTurn) {
      setIsXTurn(false);
      setTimeout(() => {
        const aiIdx = aiMove(newBoard);
        if (aiIdx >= 0) {
          const aiBoard = [...newBoard];
          aiBoard[aiIdx] = "O";
          setBoard(aiBoard);
          if (soundOn) play("move");
          const aiResult = checkWinner(aiBoard);
          if (aiResult.winner) {
            setWinner(aiResult.winner);
            setWinLine(aiResult.line);
            if (aiResult.winner === "O") setScores((s) => ({ ...s, o: s.o + 1 }));
            else if (aiResult.winner === "draw") setScores((s) => ({ ...s, draw: s.draw + 1 }));
            if (soundOn) play(aiResult.winner === "draw" ? "draw" : "win");
          } else setIsXTurn(true);
        }
      }, 400);
    } else setIsXTurn(nextIsXTurn);
  }, [board, winner, isXTurn, mode, checkWinner, aiMove, isNetworkMode, isMyTurn, mp, scores, soundOn, play]);

  const handleNetworkReset = useCallback(() => {
    resetBoard();
    if (isNetworkMode) mp.sendReset();
  }, [resetBoard, isNetworkMode, mp]);

  if (mode === "network" && mp.status !== "connected") {
    return (
      <MultiplayerLobby
        status={mp.status} role={mp.role} localCode={mp.localCode}
        answerCode={mp.answerCode} error={mp.error}
        onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom}
        onHandleAnswer={mp.handleAnswer} onGenerateNext={mp.generateOfferForNext}
        onDisconnect={mp.disconnect} onBack={() => setMode("local")}
        gameName="XO" peerCount={mp.peerCount} peers={mp.peers}
      />
    );
  }

  const showTournament = isNetworkMode && mp.peerCount > 1 && tournament.state.phase !== "playing";
  const showSidebar = isNetworkMode && tournament.state.matches.length > 0;

  const cellSize = gridSize <= 3 ? "w-[min(22vw,5rem)] h-[min(22vw,5rem)] sm:w-24 sm:h-24 text-2xl sm:text-4xl"
    : gridSize <= 4 ? "w-[min(18vw,4rem)] h-[min(18vw,4rem)] sm:w-20 sm:h-20 text-xl sm:text-3xl"
    : "w-[min(14vw,3rem)] h-[min(14vw,3rem)] sm:w-16 sm:h-16 text-lg sm:text-2xl";

  const turnLabel = isNetworkMode
    ? (isMyTurn ? `دورك (${symbols[mySymbol === "X" ? 0 : 1]})` : `دور الخصم (${symbols[mySymbol === "X" ? 1 : 0]})`)
    : `دور: ${isXTurn ? symbols[0] : symbols[1]} ${mode === "ai" && !isXTurn ? "(يفكر...)" : ""}`;

  return (
    <div className="min-h-[100dvh] wood-texture flex flex-col items-center px-1 py-1 sm:p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-2 sm:mb-6">
        <button onClick={() => navigate("/")} className="p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
        </button>
        <h1 className="text-xl sm:text-3xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>❌⭕ XO</h1>
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
        <div className="flex items-center gap-2 mb-2 text-accent text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          متصل — أنت {mp.role === "host" ? "المضيف (X)" : "الضيف (O)"}
        </div>
      )}

      {/* Scores with 3D cards */}
      <div className="flex gap-4 sm:gap-6 mb-4 text-sm">
        {[
          { score: scores.x, label: `${symbols[0]} ${mode === "ai" ? "أنت" : isNetworkMode ? "المضيف" : "لاعب 1"}`, color: "text-destructive" },
          { score: scores.draw, label: "تعادل", color: "text-muted-foreground" },
          { score: scores.o, label: `${symbols[1]} ${mode === "ai" ? "الكمبيوتر" : isNetworkMode ? "الضيف" : "لاعب 2"}`, color: "text-primary" },
        ].map((s, i) => (
          <div key={i} className="text-center px-3 py-1.5 rounded-lg bg-card/40 border border-border">
            <span className={`${s.color} font-bold text-lg`}>{s.score}</span>
            <p className="text-muted-foreground text-[10px] sm:text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {!winner && <p className="text-foreground mb-3 sm:mb-4 text-xs sm:text-sm animate-pulse">{turnLabel}</p>}

      {winner && (
        <div className="mb-4 text-center animate-celebrate">
          <p className="text-xl sm:text-2xl font-bold text-gold">
            {winner === "draw" ? "🤝 تعادل!" : `🎉 فاز ${winner === "X" ? symbols[0] : symbols[1]}!`}
          </p>
        </div>
      )}

      {/* Board with 3D effect */}
      <div
        className="grid gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl board-3d border-2 border-gold"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          background: "linear-gradient(145deg, hsl(30 30% 20%) 0%, hsl(25 35% 15%) 100%)",
        }}
      >
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!!cell || !!winner || (mode === "ai" && !isXTurn) || (isNetworkMode && !isMyTurn)}
              className={`${cellSize} rounded-lg border-2 transition-all duration-200 font-bold flex items-center justify-center
                ${cell ? "cursor-default" : "cursor-pointer hover:scale-105 hover:bg-accent/20 active:scale-95"}
                ${isWinCell ? "border-gold scale-105" : "border-border/50"}
                ${cell === "X" ? "text-destructive" : "text-primary"}
              `}
              style={{
                background: isWinCell
                  ? "linear-gradient(145deg, hsl(43 80% 55% / 0.2) 0%, hsl(40 65% 40% / 0.15) 100%)"
                  : "linear-gradient(145deg, hsl(30 30% 22%) 0%, hsl(25 25% 16%) 100%)",
                boxShadow: isWinCell
                  ? "0 0 15px hsl(43 80% 55% / 0.3), inset 0 1px 2px hsl(0 0% 100% / 0.05)"
                  : "0 2px 4px hsl(0 0% 0% / 0.3), inset 0 1px 1px hsl(0 0% 100% / 0.03)",
              }}
            >
              <span className={cell ? "piece-3d" : ""}>
                {cell === "X" ? symbols[0] : cell === "O" ? symbols[1] : ""}
              </span>
            </button>
          );
        })}
      </div>

      <Button onClick={handleNetworkReset} variant="outline" className="mt-4 sm:mt-6 border-gold text-gold hover:bg-gold/10">
        <RotateCcw className="w-4 h-4 mr-2" /> جولة جديدة
      </Button>

      {showTournament && (
        <div className="w-full max-w-lg mt-4">
          <TournamentManager state={tournament.state} isHost={isHost}
            onSetPlayersPerMatch={tournament.setPlayersPerMatch} onAutoGroup={tournament.autoGroupPlayers}
            onStartTournament={tournament.startTournament} onStartSetup={tournament.startSetup}
            getPlayerName={tournament.getPlayerName} />
        </div>
      )}
      {showSidebar && <MatchSidebar matches={tournament.state.matches} getPlayerName={tournament.getPlayerName} />}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="wood-texture border-2 border-gold max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gold text-center" style={{ fontFamily: "'Cinzel', serif" }}>إعدادات XO</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <label className="text-foreground text-sm mb-2 block">وضع اللعب</label>
              <Select value={mode} onValueChange={(v: Mode) => { setMode(v); resetBoard(); }}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">لاعبين محليين</SelectItem>
                  <SelectItem value="ai">ضد الكمبيوتر</SelectItem>
                  <SelectItem value="network">عبر الشبكة 📶</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "ai" && (
              <div>
                <label className="text-foreground text-sm mb-2 block">مستوى الصعوبة</label>
                <Select value={difficulty} onValueChange={(v: Difficulty) => { setDifficulty(v); resetBoard(); }}>
                  <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">سهل</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="hard">صعب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {mode !== "network" && (
              <>
                <div>
                  <label className="text-foreground text-sm mb-2 block">حجم الشبكة</label>
                  <Select value={String(gridSize)} onValueChange={(v) => setGridSize(Number(v))}>
                    <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 × 3</SelectItem>
                      <SelectItem value="4">4 × 4</SelectItem>
                      <SelectItem value="5">5 × 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-foreground text-sm mb-2 block">شكل الرموز</label>
                  <Select value={symbolSet} onValueChange={setSymbolSet}>
                    <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">كلاسيكي ✕ ◯</SelectItem>
                      <SelectItem value="emoji">إيموجي 😎 🤖</SelectItem>
                      <SelectItem value="hearts">قلوب ❤️ 💙</SelectItem>
                      <SelectItem value="stars">نجوم ⭐ 🌙</SelectItem>
                      <SelectItem value="animals">حيوانات 🐱 🐶</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default XOGame;
