import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Chess } from "chess.js";
import { ArrowLeft, RotateCcw, Settings2, Undo2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findBestMove } from "@/lib/chessAI";
import NetworkLobby from "@/components/NetworkLobby";
import TournamentManager from "@/components/TournamentManager";
import MatchSidebar from "@/components/MatchSidebar";
import { useMultiplayerSync } from "@/hooks/useMultiplayerSync";
import { useTournament } from "@/hooks/useTournament";
import { useGameSounds } from "@/hooks/useGameSounds";

type Mode = "local" | "ai" | "network";
type Difficulty = "easy" | "medium" | "hard" | "impossible";
type BoardTheme = "wood" | "marble" | "plain" | "emerald";
type PieceTheme = "classic" | "neo" | "staunton" | "minimal";

const THEMES: Record<BoardTheme, { light: string; dark: string; nameKey: string }> = {
  wood: { light: "#d4a76a", dark: "#8b5e3c", nameKey: "theme_wood" },
  marble: { light: "#e8e0d0", dark: "#8a8178", nameKey: "theme_marble" },
  plain: { light: "#f0d9b5", dark: "#b58863", nameKey: "theme_plain" },
  emerald: { light: "#ffffdd", dark: "#6baa58", nameKey: "theme_emerald" },
};

// More realistic-looking piece sets using distinct Unicode/emoji combinations
const PIECE_THEMES: Record<PieceTheme, { name: string; w: Record<string, string>; b: Record<string, string> }> = {
  classic: {
    name: "كلاسيكي",
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  },
  neo: {
    name: "حديث",
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  },
  staunton: {
    name: "ستاونتن",
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  },
  minimal: {
    name: "بسيط",
    w: { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" },
    b: { k: "k", q: "q", r: "r", b: "b", n: "n", p: "p" },
  },
};

// Piece styling per theme
const PIECE_STYLES: Record<PieceTheme, (color: "w" | "b") => React.CSSProperties> = {
  classic: (color) => ({
    fontSize: "min(5.5vw, 36px)",
    lineHeight: 1,
    color: color === "w" ? "#fff" : "#1a1a1a",
    textShadow: color === "w"
      ? "0 1px 3px rgba(0,0,0,0.6), 0 0 8px rgba(255,255,255,0.2)"
      : "0 1px 2px rgba(255,255,255,0.3), 0 0 6px rgba(0,0,0,0.4)",
    filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.4))`,
  }),
  neo: (color) => ({
    fontSize: "min(5.5vw, 36px)",
    lineHeight: 1,
    color: color === "w" ? "#f5f0e8" : "#2c1810",
    textShadow: color === "w"
      ? "0 0 10px rgba(212,167,106,0.6), 0 2px 4px rgba(0,0,0,0.5)"
      : "0 0 8px rgba(139,94,60,0.4), 0 2px 4px rgba(0,0,0,0.3)",
    filter: `drop-shadow(0 3px 4px rgba(0,0,0,0.5))`,
    fontWeight: "bold",
  }),
  staunton: (color) => ({
    fontSize: "min(6vw, 38px)",
    lineHeight: 1,
    color: color === "w" ? "#faf3e8" : "#3d2b1f",
    textShadow: color === "w"
      ? "0 1px 2px rgba(0,0,0,0.5), 1px 0 0 rgba(139,94,60,0.3), -1px 0 0 rgba(139,94,60,0.3)"
      : "0 1px 1px rgba(255,255,255,0.15), 1px 0 0 rgba(0,0,0,0.2), -1px 0 0 rgba(0,0,0,0.2)",
    filter: `drop-shadow(0 3px 5px rgba(0,0,0,0.5))`,
    WebkitTextStroke: color === "w" ? "0.5px rgba(139,94,60,0.4)" : "0.5px rgba(0,0,0,0.3)",
  }),
  minimal: (color) => ({
    fontSize: "min(4.5vw, 26px)",
    lineHeight: 1,
    fontWeight: "bold",
    fontFamily: "'Cinzel', serif",
    color: color === "w" ? "#faf3e8" : "#2c1810",
    textShadow: "none",
    background: color === "w"
      ? "linear-gradient(135deg, #faf3e8 0%, #d4a76a 100%)"
      : "linear-gradient(135deg, #5a3e28 0%, #2c1810 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  }),
};

const PROMO_PIECES = ["q", "r", "b", "n"] as const;

const ChessGame = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [selected, setSelected] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [mode, setMode] = useState<Mode>("local");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [theme, setTheme] = useState<BoardTheme>("wood");
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>("classic");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promoDialog, setPromoDialog] = useState<{ from: string; to: string } | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const mp = useMultiplayerSync();
  const tournament = useTournament();
  const { play } = useGameSounds();
  const isHost = mp.role === "host";

  const chess = chessRef.current;
  const board = chess.board();
  const turn = chess.turn();
  const isCheck = chess.isCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();

  const isNetworkMode = mode === "network" && mp.status === "connected";
  const myColor = mp.role === "host" ? "w" : "b";
  const isMyTurn = isNetworkMode ? turn === myColor : true;

  const currentPieces = PIECE_THEMES[pieceTheme];

  const sync = useCallback(() => setFen(chess.fen()), [chess]);

  const resetGame = useCallback(() => {
    chess.reset();
    setSelected(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromoDialog(null);
    setAiThinking(false);
    sync();
  }, [chess, sync]);

  // Listen for remote moves
  useEffect(() => {
    if (!isNetworkMode) return;
    mp.onAction((action: { from: string; to: string; promotion?: string }) => {
      const result = chess.move(action);
      if (result) {
        setLastMove({ from: result.from, to: result.to });
        setSelected(null);
        setLegalMoves([]);
        if (soundOn) play(result.captured ? "capture" : "move");
        sync();
      }
    });
    mp.onReset(() => resetGame());
  }, [isNetworkMode, mp, chess, sync, resetGame, play, soundOn]);

  // Sound effects for game state changes
  useEffect(() => {
    if (!soundOn) return;
    if (isCheckmate) play("win");
    else if (isCheck) play("check");
    else if (isDraw || isStalemate) play("draw");
  }, [isCheckmate, isCheck, isDraw, isStalemate, soundOn, play]);

  const handleSquareClick = useCallback((sq: string) => {
    if (isGameOver || aiThinking) return;
    if (mode === "ai" && turn === "b") return;
    if (isNetworkMode && !isMyTurn) return;

    if (selected) {
      const moves = chess.moves({ square: selected as any, verbose: true }) as any[];
      const matchingMoves = moves.filter((m: any) => m.to === sq);
      
      if (matchingMoves.length > 0) {
        if (matchingMoves.some((m: any) => m.promotion)) {
          setPromoDialog({ from: selected, to: sq });
          return;
        }
        const result = chess.move({ from: selected, to: sq });
        if (result) {
          setLastMove({ from: selected, to: sq });
          if (soundOn) play(result.captured ? "capture" : "move");
          if (isNetworkMode) mp.sendAction({ from: selected, to: sq });
        }
        setSelected(null);
        setLegalMoves([]);
        sync();
        return;
      }
    }

    const piece = chess.get(sq as any);
    if (piece && piece.color === turn) {
      if (isNetworkMode && piece.color !== myColor) return;
      if (soundOn) play("click");
      setSelected(sq);
      const moves = chess.moves({ square: sq as any, verbose: true }) as any[];
      setLegalMoves([...new Set(moves.map((m: any) => m.to))]);
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  }, [selected, chess, turn, isGameOver, mode, aiThinking, sync, isNetworkMode, isMyTurn, myColor, mp, soundOn, play]);

  const handlePromotion = useCallback((piece: string) => {
    if (!promoDialog) return;
    const result = chess.move({ from: promoDialog.from, to: promoDialog.to, promotion: piece });
    if (result) {
      setLastMove({ from: promoDialog.from, to: promoDialog.to });
      if (soundOn) play("move");
      if (isNetworkMode) mp.sendAction({ from: promoDialog.from, to: promoDialog.to, promotion: piece });
    }
    setPromoDialog(null);
    setSelected(null);
    setLegalMoves([]);
    sync();
  }, [promoDialog, chess, sync, isNetworkMode, mp, soundOn, play]);

  const handleUndo = useCallback(() => {
    if (isNetworkMode) return;
    if (mode === "ai") { chess.undo(); chess.undo(); }
    else chess.undo();
    setSelected(null);
    setLegalMoves([]);
    sync();
  }, [chess, mode, sync, isNetworkMode]);

  const handleNetworkReset = useCallback(() => {
    resetGame();
    if (isNetworkMode) mp.sendReset();
  }, [resetGame, isNetworkMode, mp]);

  // AI move
  useEffect(() => {
    if (mode !== "ai" || turn !== "b" || isGameOver) return;
    setAiThinking(true);
    const timeout = setTimeout(() => {
      const move = findBestMove(chess, difficulty);
      if (move) {
        const result = chess.move(move);
        if (result) {
          setLastMove({ from: result.from, to: result.to });
          if (soundOn) play(result.captured ? "capture" : "move");
        }
      }
      setAiThinking(false);
      sync();
    }, 500);
    return () => clearTimeout(timeout);
  }, [fen, mode, turn, isGameOver, chess, difficulty, sync, soundOn, play]);

  // Show lobby
  if (mode === "network" && mp.status !== "connected") {
    return (
      <NetworkLobby
        status={mp.status} role={mp.role} localCode={mp.localCode}
        answerCode={mp.answerCode} error={mp.error}
        onCreateRoom={mp.createRoom} onJoinRoom={mp.joinRoom}
        onHandleAnswer={mp.handleAnswer} onGenerateNext={mp.generateOfferForNext}
        onDisconnect={mp.disconnect} onBack={() => setMode("local")}
        gameName="شطرنج" peerCount={mp.peerCount} peers={mp.peers}
      />
    );
  }

  const showTournament = isNetworkMode && mp.peerCount > 1 && tournament.state.phase !== "playing";
  const showSidebar = isNetworkMode && tournament.state.matches.length > 0;

  const getSquareName = (r: number, c: number) => `${String.fromCharCode(97 + c)}${8 - r}`;
  const themeColors = THEMES[theme];

  const statusText = isCheckmate
    ? `🏆 ${turn === "w" ? t("checkmate_black") : t("checkmate_white")}`
    : isStalemate ? `🤝 ${t("stalemate")}`
    : isDraw ? `🤝 ${t("draw_game")}`
    : isCheck ? `⚠️ ${t("check")} ${turn === "w" ? t("white_turn") : t("black_turn")}`
    : isNetworkMode
      ? (isMyTurn ? t("your_turn") : t("opponent_turn"))
      : `${turn === "w" ? t("white_turn") : t("black_turn")}${aiThinking ? ` (${t("ai_thinking")})` : ""}`;

  return (
    <div className="min-h-[100dvh] wood-texture flex flex-col items-center px-1 py-1 sm:p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-1 sm:mb-4">
        <button onClick={() => navigate("/home")} className="p-1.5 sm:p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
        </button>
        <h1 className="text-lg sm:text-2xl font-bold text-gold" style={{ fontFamily: "'Cinzel', serif" }}>♟️ {t("chess_title")}</h1>
        <div className="flex gap-1">
          <button onClick={() => setSoundOn(!soundOn)} className="p-1.5 sm:p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
            {soundOn ? <Volume2 className="w-4 h-4 text-gold" /> : <VolumeX className="w-4 h-4 text-gold" />}
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-1.5 sm:p-2 rounded-full bg-secondary/80 hover:bg-secondary border border-gold transition-colors">
            <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
          </button>
        </div>
      </div>

      {isNetworkMode && (
        <div className="flex items-center gap-2 mb-1 text-accent text-xs">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          متصل — أنت {mp.role === "host" ? "الأبيض" : "الأسود"}
        </div>
      )}

      <p className="text-foreground text-xs sm:text-sm mb-1 sm:mb-3">{statusText}</p>

      {/* Board with 3D effect */}
      <div className="board-3d border-2 sm:border-4 border-gold rounded-lg">
        <div className="grid grid-cols-8 overflow-hidden rounded-sm" style={{ width: "min(calc(100vw - 16px), 420px)", height: "min(calc(100vw - 16px), 420px)" }}>
          {Array.from({ length: 64 }, (_, i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const sq = getSquareName(r, c);
            const isLight = (r + c) % 2 === 0;
            const piece = board[r][c];
            const isSelected = selected === sq;
            const isLegal = legalMoves.includes(sq);
            const isLast = lastMove?.from === sq || lastMove?.to === sq;
            const isKingCheck = isCheck && piece?.type === "k" && piece?.color === turn;

            return (
              <button
                key={i}
                onClick={() => handleSquareClick(sq)}
                className="relative flex items-center justify-center transition-all duration-150"
                style={{
                  backgroundColor: isKingCheck ? "hsl(0 70% 50%)"
                    : isSelected ? "hsl(50 80% 55%)"
                    : isLast ? "hsl(50 50% 60% / 0.7)"
                    : isLight ? themeColors.light : themeColors.dark,
                  aspectRatio: "1",
                  boxShadow: isSelected ? "inset 0 0 12px hsl(50 80% 40% / 0.5)" : isKingCheck ? "inset 0 0 15px hsl(0 70% 30% / 0.6)" : "none",
                }}
              >
                {isLegal && !piece && (
                  <div className="w-[28%] h-[28%] rounded-full" style={{
                    background: "radial-gradient(circle, hsl(0 0% 0% / 0.35) 0%, hsl(0 0% 0% / 0.15) 100%)",
                  }} />
                )}
                {isLegal && piece && (
                  <div className="absolute inset-[3px] rounded-sm border-[3px]" style={{
                    borderColor: "hsl(0 0% 0% / 0.3)",
                  }} />
                )}
                {piece && (
                  <span className="select-none piece-3d flex items-center justify-center w-full h-full" style={{ ...PIECE_STYLES[pieceTheme](piece.color), overflow: "hidden" }}>
                    {currentPieces[piece.color][piece.type]}
                  </span>
                )}
                {r === 7 && <span className="absolute bottom-0 left-0.5 text-[7px] sm:text-[8px] opacity-30 font-sans">{String.fromCharCode(97 + c)}</span>}
                {c === 0 && <span className="absolute top-0 left-0.5 text-[7px] sm:text-[8px] opacity-30 font-sans">{8 - r}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-4">
        <Button onClick={handleNetworkReset} variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10">
          <RotateCcw className="w-4 h-4 mr-1" /> {t("new_game")}
        </Button>
        {!isNetworkMode && (
          <Button onClick={handleUndo} variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10" disabled={chess.history().length === 0}>
            <Undo2 className="w-4 h-4 mr-1" /> {t("undo")}
          </Button>
        )}
      </div>

      {/* Promotion Dialog */}
      <Dialog open={!!promoDialog} onOpenChange={() => setPromoDialog(null)}>
        <DialogContent className="wood-texture border-2 border-gold max-w-xs">
          <DialogHeader><DialogTitle className="text-gold text-center">{t("promote_to")}</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-3 sm:gap-4 py-4">
            {PROMO_PIECES.map((p) => (
              <button
                key={p}
                onClick={() => handlePromotion(p)}
                className="p-2 sm:p-3 rounded-xl hover:bg-gold/20 transition-all hover:scale-110 piece-3d"
                style={{ ...PIECE_STYLES[pieceTheme](turn), fontSize: "min(10vw, 44px)" }}
              >
                {currentPieces[turn][p]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="wood-texture border-2 border-gold max-w-sm">
          <DialogHeader><DialogTitle className="text-gold text-center" style={{ fontFamily: "'Cinzel', serif" }}>{t("game_settings")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-foreground text-sm mb-2 block">{t("game_mode")}</label>
              <Select value={mode} onValueChange={(v: Mode) => { setMode(v); resetGame(); }}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">{t("local_play")}</SelectItem>
                  <SelectItem value="ai">{t("vs_ai")}</SelectItem>
                  <SelectItem value="network">{t("online")} 📶</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "ai" && (
              <div>
              <label className="text-foreground text-sm mb-2 block">{t("difficulty")}</label>
                <Select value={difficulty} onValueChange={(v: Difficulty) => { setDifficulty(v); resetGame(); }}>
                  <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t("easy")}</SelectItem>
                    <SelectItem value="medium">{t("medium")}</SelectItem>
                    <SelectItem value="hard">{t("hard")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-foreground text-sm mb-2 block">{t("board_theme")}</label>
              <Select value={theme} onValueChange={(v: BoardTheme) => setTheme(v)}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(THEMES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{t(v.nameKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-foreground text-sm mb-2 block">{t("piece_theme")}</label>
              <Select value={pieceTheme} onValueChange={(v: PieceTheme) => setPieceTheme(v)}>
                <SelectTrigger className="bg-card/60 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">♔ {t("piece_classic")}</SelectItem>
                  <SelectItem value="neo">✦ {t("piece_neo")}</SelectItem>
                  <SelectItem value="staunton">♚ {t("piece_staunton")}</SelectItem>
                  <SelectItem value="minimal">Aa {t("piece_minimal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showTournament && (
        <div className="w-full max-w-lg mt-4">
          <TournamentManager
            state={tournament.state} isHost={isHost}
            onSetPlayersPerMatch={tournament.setPlayersPerMatch}
            onAutoGroup={tournament.autoGroupPlayers}
            onStartTournament={tournament.startTournament}
            onStartSetup={tournament.startSetup}
            getPlayerName={tournament.getPlayerName}
          />
        </div>
      )}

      {showSidebar && (
        <MatchSidebar matches={tournament.state.matches} getPlayerName={tournament.getPlayerName} />
      )}
    </div>
  );
};

export default ChessGame;
