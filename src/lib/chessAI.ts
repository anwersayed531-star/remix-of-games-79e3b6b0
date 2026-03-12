import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

// Piece-square tables for positional evaluation (from white's perspective)
const PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0,
];

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
  0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

const PST_KING_END = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

const PST: Record<string, number[]> = {
  p: PST_PAWN, n: PST_KNIGHT, b: PST_BISHOP, r: PST_ROOK, q: PST_QUEEN,
};

function isEndgame(chess: Chess): boolean {
  const board = chess.board();
  let queens = 0, minors = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (sq) {
      if (sq.type === 'q') queens++;
      if (sq.type === 'n' || sq.type === 'b') minors++;
    }
  }
  return queens === 0 || (queens <= 2 && minors <= 2);
}

function evaluate(chess: Chess, advanced = false): number {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  const board = chess.board();
  let score = 0;
  const endgame = advanced ? isEndgame(chess) : false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] || 0;
      const idx = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;

      let positional = 0;
      if (advanced) {
        if (sq.type === 'k') {
          positional = endgame ? PST_KING_END[idx] : PST_KING_MID[idx];
        } else if (PST[sq.type]) {
          positional = PST[sq.type][idx];
        }
      }

      score += sq.color === 'w' ? (val + positional) : -(val + positional);
    }
  }

  // Mobility bonus for advanced evaluation
  if (advanced) {
    const moves = chess.moves().length;
    score += chess.turn() === 'w' ? moves * 2 : -moves * 2;
  }

  return score;
}

function orderMoves(chess: Chess): string[] {
  const moves = chess.moves({ verbose: true });
  // Sort: captures first, then checks, then rest
  moves.sort((a, b) => {
    const aScore = (a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0) + (a.san.includes('+') ? 50 : 0);
    const bScore = (b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0) + (b.san.includes('+') ? 50 : 0);
    return bScore - aScore;
  });
  return moves.map(m => m.san);
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean, advanced = false): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess, advanced);

  const moves = advanced ? orderMoves(chess) : chess.moves();

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const val = minimax(chess, depth - 1, alpha, beta, false, advanced);
      chess.undo();
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      const val = minimax(chess, depth - 1, alpha, beta, true, advanced);
      chess.undo();
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function findBestMove(chess: Chess, difficulty: 'easy' | 'medium' | 'hard' | 'impossible'): string | null {
  const moves = chess.moves();
  if (moves.length === 0) return null;

  // Easy: random moves
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];

  // Medium: depth 2, basic eval
  // Hard: depth 3, basic eval
  // Impossible: depth 5, advanced eval with PST + move ordering
  const advanced = difficulty === 'impossible';
  const depth = difficulty === 'impossible' ? 5 : difficulty === 'hard' ? 3 : 2;
  const maximizing = chess.turn() === 'w';

  const orderedMoves = advanced ? orderMoves(chess) : moves;
  let bestMove = orderedMoves[0];
  let bestVal = maximizing ? -Infinity : Infinity;

  for (const move of orderedMoves) {
    chess.move(move);
    const val = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing, advanced);
    chess.undo();
    if (maximizing ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }
  return bestMove;
}
