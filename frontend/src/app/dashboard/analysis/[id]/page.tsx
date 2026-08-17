"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Piece, type Square } from "chess.js";
import PageShell from "@/components/page-shell";
import { getStoredToken } from "@/lib/auth";

type ApiMove = {
  id: number;
  notation: string;
};

type ApiGame = {
  id: number;
  name: string;
  status: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  moves?: ApiMove[];
};

type EngineResult = {
  ready: boolean;
  thinking: boolean;
  evaluation: number;
  bestMove: string;
  bestLine: string;
  depth: number;
  moveInfo: string;
};

const API_BASE = "/api/proxy/api";
async function apiFetch<T>(
  path: string,
  opts: { token?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function squareName(rowIndex: number, colIndex: number, flipped: boolean) {
  const files = flipped ? "hgfedcba".split("") : "abcdefgh".split("");
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  return `${files[colIndex]}${ranks[rowIndex]}` as Square;
}

function squareCenter(square: string, flipped: boolean) {
  if (!square || square.length < 2) return null;

  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);

  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;

  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: col * 12.5 + 6.25,
    y: row * 12.5 + 6.25,
  };
}

function formatUciMove(move: string) {
  if (!move || move.length < 4) return "-";
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const promo = move.length > 4 ? `=${move[4].toUpperCase()}` : "";
  return `${from} → ${to}${promo}`;
}

function evalText(evaluation: number) {
  if (evaluation >= 900) return "Mate for White";
  if (evaluation <= -900) return "Mate for Black";
  if (Math.abs(evaluation) < 0.2) return "Equal";
  if (evaluation > 0) return `White +${evaluation.toFixed(1)}`;
  return `Black +${Math.abs(evaluation).toFixed(1)}`;
}

function moveQuality(evaluation: number) {
  const abs = Math.abs(evaluation);

  if (evaluation >= 900 || evaluation <= -900) return "Forced mate found";
  if (abs < 0.3) return "Balanced position";
  if (abs < 1.0) return evaluation > 0 ? "Slight advantage for White" : "Slight advantage for Black";
  if (abs < 2.5) return evaluation > 0 ? "Clear advantage for White" : "Clear advantage for Black";
  return evaluation > 0 ? "Winning advantage for White" : "Winning advantage for Black";
}

function BoardView({
  board,
  flipped,
  selectedSquare,
  legalSquares,
  tryMode,
  bestMove,
  onSquareClick,
}: {
  board: (Piece | null)[][];
  flipped: boolean;
  selectedSquare: Square | null;
  legalSquares: Square[];
  tryMode: boolean;
  bestMove: string;
  onSquareClick: (square: Square) => void;
}) {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba".split("") : "abcdefgh".split("");
  const rows = flipped ? [...board].reverse() : board;
  const displayRows = rows.map((row) => (flipped ? [...row].reverse() : row));

  const bestFrom = bestMove?.slice(0, 2);
  const bestTo = bestMove?.slice(2, 4);
  const fromCenter = squareCenter(bestFrom, flipped);
  const toCenter = squareCenter(bestTo, flipped);

  return (
    <div className="w-full max-w-[560px]">
      <div className="grid grid-cols-[14px_1fr] grid-rows-[1fr_14px] gap-x-[6px] gap-y-[4px]">
        <div className="grid grid-rows-8">
          {ranks.map((r) => (
            <div key={r} className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]">
              {r}
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-none">
          <div className="grid aspect-square w-full grid-cols-8">
            {displayRows.flatMap((row, rr) =>
              row.map((sq, cc) => {
                const isLight = (rr + cc) % 2 === 0;
                const currentSquare = squareName(rr, cc, flipped);
                const isSelected = selectedSquare === currentSquare;
                const isLegal = legalSquares.includes(currentSquare);

                return (
                  <button
                    key={`${rr}-${cc}`}
                    type="button"
                    onClick={() => onSquareClick(currentSquare)}
                    disabled={!tryMode}
                    className="relative flex aspect-square items-center justify-center disabled:cursor-default"
                    style={{ backgroundColor: isLight ? "#e6d2ad" : "#b98d63" }}
                  >
                    {isSelected && <span className="absolute inset-0 z-10 bg-orange-400/45" />}
                    {isLegal && <span className="absolute z-20 h-5 w-5 rounded-full bg-orange-500/80" />}

                    {sq && (
                      <img
                        src={`/pieces/${sq.color}${sq.type.toUpperCase()}.svg`}
                        alt=""
                        draggable={false}
                        className="pointer-events-none relative z-30 h-[90%] w-[90%] select-none object-contain"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {fromCenter && toCenter && (
            <svg className="pointer-events-none absolute inset-0 z-40 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <marker id="best-arrow-head" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,4 L4,2 z" fill="#ff7a00" />
                </marker>
              </defs>
              <line
                x1={fromCenter.x}
                y1={fromCenter.y}
                x2={toCenter.x}
                y2={toCenter.y}
                stroke="#ff7a00"
                strokeWidth="1.8"
                strokeLinecap="round"
                markerEnd="url(#best-arrow-head)"
                opacity="0.78"
              />
            </svg>
          )}
        </div>

        <div />

        <div className="grid grid-cols-8">
          {files.map((f) => (
            <div key={f} className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]">
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvaluationGauge({ evaluation }: { evaluation: number }) {
  const whitePercent = Math.max(0, Math.min(100, 50 + evaluation * 8));

  return (
    <div className="flex h-[560px] w-[34px] overflow-hidden rounded-full border border-white/10 bg-black/40 shadow-inner">
      <div className="mt-auto w-full bg-white transition-all duration-300" style={{ height: `${whitePercent}%` }} />
    </div>
  );
}

export default function GameBoardAnalysisPage() {
  const params = useParams();
  const gameId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [token, setToken] = useState("");
  const [game, setGame] = useState<ApiGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [plyIndex, setPlyIndex] = useState(-1);

  const [tryMode, setTryMode] = useState(false);
  const [tryFen, setTryFen] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [tryLine, setTryLine] = useState<string[]>([]);

  const engineRef = useRef<Worker | null>(null);
  const [engine, setEngine] = useState<EngineResult>({
    ready: false,
    thinking: false,
    evaluation: 0,
    bestMove: "",
    bestLine: "",
    depth: 0,
    moveInfo: "Loading Stockfish...",
  });

  const [aiInfo, setAiInfo] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const savedToken = getStoredToken("user");

    if (!savedToken) {
      setError("Your user session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!gameId || !token) return;

    let active = true;

    async function loadGame() {
      try {
        setLoading(true);
        setError("");

        const data = await apiFetch<ApiGame>(
          `/games/${gameId}`,
          { token }
        );

        if (active) {
          setGame(data);
        }
      } catch (error) {
        if (!active) return;

        const message =
          error instanceof Error
            ? error.message
            : "Failed to load game.";

        if (
          message.includes("Unauthenticated") ||
          message.includes("401")
        ) {
          setError(
            "Your login session has expired. Please sign in again."
          );
        } else {
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadGame();

    return () => {
      active = false;
    };
  }, [gameId, token]);

  const orderedMoves = useMemo(() => {
    return [...(game?.moves ?? [])].sort((a, b) => a.id - b.id);
  }, [game]);

  const replayChess = useMemo(() => {
    const c = new Chess();
    const takeCount = plyIndex + 1;

    for (let i = 0; i < takeCount; i += 1) {
      const move = orderedMoves[i];
      if (!move) break;

      try {
        c.move(move.notation as any);
      } catch {
        break;
      }
    }

    return c;
  }, [orderedMoves, plyIndex]);

  const activeChess = useMemo(() => {
    if (tryMode && tryFen) return new Chess(tryFen);
    return replayChess;
  }, [replayChess, tryFen, tryMode]);

  const board = useMemo(() => activeChess.board(), [activeChess]);
  const fen = useMemo(() => activeChess.fen(), [activeChess]);

  const legalSquares = useMemo(() => {
    if (!tryMode || !selectedSquare) return [];

    try {
      return activeChess
        .moves({ square: selectedSquare, verbose: true })
        .map((m: any) => m.to as Square);
    } catch {
      return [];
    }
  }, [activeChess, selectedSquare, tryMode]);

  const pgn = useMemo(() => {
    if (!game) return "";

    const c = new Chess();

    for (const move of orderedMoves) {
      try {
        c.move(move.notation as any);
      } catch {
        break;
      }
    }

    const date = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
    const headers = [
      `[Event "${game.name}"]`,
      `[Site "Regission History"]`,
      `[Date "${date}"]`,
      `[Round "-"]`,
      `[White "-"]`,
      `[Black "-"]`,
      `[Result "*"]`,
      ``,
    ].join("\n");

    const movetext = c.pgn().trim();
    return `${headers}${movetext ? movetext + "\n" : ""}*`.trim();
  }, [game, orderedMoves]);

  const moveRows = useMemo(() => {
    const rows: { no: number; w: ApiMove | null; b: ApiMove | null }[] = [];

    for (let i = 0; i < orderedMoves.length; i += 2) {
      rows.push({ no: i / 2 + 1, w: orderedMoves[i] ?? null, b: orderedMoves[i + 1] ?? null });
    }

    return rows;
  }, [orderedMoves]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker("/stockfish/stockfish-18-asm.js");
    engineRef.current = worker;

    worker.onmessage = (event) => {
      const line = String(event.data || "");

      if (line.includes("uciok")) {
        setEngine((prev) => ({ ...prev, ready: true, moveInfo: "Engine ready" }));
        worker.postMessage("isready");
      }

      if (line.includes("readyok")) {
        setEngine((prev) => ({ ...prev, ready: true }));
      }

      if (line.startsWith("info depth")) {
        const depthMatch = line.match(/depth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)/);

        setEngine((prev) => {
          let evaluation = prev.evaluation;

          if (cpMatch) evaluation = Number(cpMatch[1]) / 100;
          if (mateMatch) evaluation = Number(mateMatch[1]) > 0 ? 999 : -999;

          return {
            ...prev,
            thinking: true,
            depth: depthMatch ? Number(depthMatch[1]) : prev.depth,
            evaluation,
            bestLine: pvMatch ? pvMatch[1] : prev.bestLine,
            moveInfo: moveQuality(evaluation),
          };
        });
      }

      if (line.startsWith("bestmove")) {
        const best = line.split(" ")[1] || "";
        setEngine((prev) => ({
          ...prev,
          thinking: false,
          bestMove: best === "(none)" ? "" : best,
          moveInfo: best && best !== "(none)" ? `Best move is ${formatUciMove(best)}` : prev.moveInfo,
        }));
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = engineRef.current;
    if (!worker || !engine.ready) return;

    setEngine((prev) => ({
      ...prev,
      thinking: true,
      bestMove: "",
      bestLine: "",
      depth: 0,
      moveInfo: "Analyzing position...",
    }));

    worker.postMessage("stop");
    worker.postMessage("ucinewgame");
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage("go depth 14");
  }, [fen, engine.ready]);

  async function generateAiInfo() {
    try {
      setAiLoading(true);
      setAiError("");
      setAiInfo("");

      const currentMove =
        plyIndex >= 0 && orderedMoves[plyIndex]
          ? orderedMoves[plyIndex].notation
          : "start position";

      const res = await fetch("/api/chess-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fen,
          move: currentMove,
          pgn,
          bestMove: formatUciMove(engine.bestMove),
          bestLine: engine.bestLine,
          evaluation: evalText(engine.evaluation),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate game info");
      }

      setAiInfo(data?.text || "No explanation generated.");
    } catch (e: any) {
      setAiError(e?.message || "Failed to generate game info.");
    } finally {
      setAiLoading(false);
    }
  }

  function exitTryMode() {
    setTryMode(false);
    setTryFen(null);
    setSelectedSquare(null);
    setTryLine([]);
  }

  function startTryMode() {
    setTryMode(true);
    setTryFen(replayChess.fen());
    setSelectedSquare(null);
    setTryLine([]);
  }

  function resetTryMode() {
    setTryFen(replayChess.fen());
    setSelectedSquare(null);
    setTryLine([]);
  }

  function handleMoveJump(index: number) {
    setPlyIndex(index);
    exitTryMode();
  }

  function handleSquareClick(square: Square) {
    if (!tryMode) return;

    const c = new Chess(activeChess.fen());

    if (!selectedSquare) {
      const piece = c.get(square);
      if (!piece) return;
      if (piece.color !== c.turn()) return;
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    try {
      const move = c.move({ from: selectedSquare, to: square, promotion: "q" });

      if (move) {
        setTryFen(c.fen());
        setTryLine((prev) => [...prev, move.san]);
        setSelectedSquare(null);
        return;
      }
    } catch {
      const piece = c.get(square);
      if (piece && piece.color === c.turn()) setSelectedSquare(square);
      else setSelectedSquare(null);
    }
  }

  return (
    <PageShell>
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[100] -translate-x-1/2">
          <div className="min-w-[280px] max-w-[90vw] rounded-2xl border border-emerald-400/25 bg-[#0b2b2a]/90 px-5 py-4 text-emerald-200 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {toast}
          </div>
        </div>
      )}

      <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2">
            <Link href="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 hover:text-white">
              ← Back to History
            </Link>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            {game?.name ?? "Game Analysis"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/70">
            Review completed games, replay each move, try alternatives, and analyze with Stockfish.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/25">
            {game?.status ?? "completed"}
          </div>

          {tryMode && (
            <div className="rounded-full bg-orange-400/15 px-4 py-2 text-sm font-bold text-orange-200 ring-1 ring-orange-400/25">
              Board Editor Mode
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-[#071121]/70 p-6 text-white/70 backdrop-blur-md">
          Loading analysis...
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-red-400/25 bg-red-500/10 p-6 text-red-200 backdrop-blur-md">
          {error}
        </div>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[24px] border border-white/10 bg-[rgba(15,22,45,0.72)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-black tracking-wide text-[#ff8a1c]">ANALYSIS BOARD</h2>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-[#b35f0f] px-4 py-2 text-sm font-bold text-white" onClick={() => setFlipped((v) => !v)} type="button">
                  Flip
                </button>

                {!tryMode ? (
                  <button className="rounded-full bg-[#ff7a00] px-4 py-2 text-sm font-black text-black" onClick={startTryMode} type="button">
                    Try Move
                  </button>
                ) : (
                  <>
                    <button className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black" onClick={resetTryMode} type="button">
                      Reset Try
                    </button>

                    <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white" onClick={exitTryMode} type="button">
                      Exit Try
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-start justify-center gap-4">
              <EvaluationGauge evaluation={engine.evaluation} />

              <BoardView
                board={board}
                flipped={flipped}
                selectedSquare={selectedSquare}
                legalSquares={legalSquares}
                tryMode={tryMode}
                bestMove={engine.bestMove}
                onSquareClick={handleSquareClick}
              />
            </div>

            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-[#ff8a1c]">STOCKFISH ANALYSIS</div>
                  <div className="mt-1 text-sm text-white/60">
                    {engine.ready ? (engine.thinking ? `Analyzing depth ${engine.depth}...` : "Engine ready") : "Loading engine..."}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-white/50">Evaluation</div>
                  <div className="text-3xl font-black text-white">{evalText(engine.evaluation)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Best Move</div>
                  <div className="mt-1 text-xl font-black text-[#ff8a1c]">{formatUciMove(engine.bestMove)}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Move Info</div>
                  <div className="mt-1 text-sm font-bold text-white/80">{engine.moveInfo}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Depth</div>
                  <div className="mt-1 text-xl font-black text-white">{engine.depth || "-"}</div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/50">Best Line</div>
                <div className="mt-1 break-all text-sm font-bold text-white/80">{engine.bestLine || "-"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-[#ff8a1c]">GAME INFO</div>
                  <div className="mt-1 text-sm text-white/60">
                    AI explanation for the current position and move.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={generateAiInfo}
                  disabled={aiLoading}
                  className="rounded-full bg-[#ff7a00] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiLoading ? "Explaining..." : "Explain Move"}
                </button>
              </div>

              <div className="mt-4 min-h-[140px] whitespace-pre-line rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">
                {aiError
                  ? aiError
                  : aiInfo ||
                    "Click Explain Move to generate simple Chess.com / Lichess-style notes for this position."}
              </div>
            </div>

            <div className="mt-3 text-center text-sm font-semibold text-[#d8c39f]">
              {tryMode ? "Board editor mode: click a piece, then click a target square." : `Current move: ${plyIndex >= 0 && orderedMoves[plyIndex] ? orderedMoves[plyIndex].notation : "start position"}`}
            </div>

            {tryMode && (
              <div className="mt-4 rounded-[20px] border border-orange-400/20 bg-orange-500/10 p-4">
                <div className="text-sm font-black text-orange-200">Try Line</div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tryLine.length > 0 ? (
                    tryLine.map((move, index) => (
                      <span key={`${move}-${index}`} className="rounded-full bg-orange-400/20 px-3 py-1 text-sm font-bold text-orange-100">
                        {index + 1}. {move}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-orange-100/70">No try moves yet.</span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/80 p-4 text-black">
                <div className="flex items-center justify-between">
                  <div className="text-base font-black text-[#8d4b0e]">FEN</div>
                  <button
                    className="rounded-full bg-[#b35f0f] px-3 py-1.5 text-xs font-bold text-white"
                    onClick={async () => setToast((await copyToClipboard(fen)) ? "FEN copied ✅" : "Copy failed")}
                    type="button"
                  >
                    Copy
                  </button>
                </div>

                <textarea value={fen} readOnly className="mt-2 h-24 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-3 text-xs text-black/70" />
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/80 p-4 text-black">
                <div className="flex items-center justify-between">
                  <div className="text-base font-black text-[#8d4b0e]">PGN</div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-[#8d4b0e]"
                      onClick={async () => setToast((await copyToClipboard(pgn)) ? "PGN copied ✅" : "Copy failed")}
                      type="button"
                    >
                      Copy
                    </button>

                    <button
                      className="rounded-full bg-[#b35f0f] px-3 py-1.5 text-xs font-bold text-white"
                      onClick={() => downloadTextFile(`${(game?.name ?? "game").replaceAll(" ", "_")}.pgn`, pgn)}
                      type="button"
                    >
                      Download
                    </button>
                  </div>
                </div>

                <textarea value={pgn} readOnly className="mt-2 h-24 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-3 text-xs text-black/70" />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(15,22,45,0.72)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <h2 className="text-[16px] font-black tracking-wide text-[#ff8a1c]">MOVE LIST</h2>

            <div className="mt-4 rounded-[20px] border border-white/10 bg-white/80 p-4 text-black">
              <div className="mb-3 text-sm">
                Completed at:{" "}
                <span className="font-black text-[#8d4b0e]">
                  {game?.completed_at ? new Date(game.completed_at).toLocaleString() : "-"}
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-black/10 bg-white">
                <div className="grid grid-cols-[48px_1fr_1fr] border-b border-black/10 px-3 py-3 text-xs font-bold text-black/45">
                  <span>#</span>
                  <span className="text-center">White</span>
                  <span className="text-center">Black</span>
                </div>

                {moveRows.length === 0 ? (
                  <div className="p-4 text-black/50">No moves yet.</div>
                ) : (
                  moveRows.map((r, rowIndex) => {
                    const whitePly = rowIndex * 2;
                    const blackPly = rowIndex * 2 + 1;

                    return (
                      <div key={r.no} className="grid grid-cols-[48px_1fr_1fr] px-3 py-3 text-base odd:bg-[#f7f2ea]">
                        <span className="font-bold text-black/45">{r.no}.</span>

                        <button
                          type="button"
                          onClick={() => handleMoveJump(whitePly)}
                          className={`text-center font-black ${plyIndex === whitePly ? "text-[#b35f0f]" : "text-[#5f2f0b]"}`}
                        >
                          {r.w?.notation ?? ""}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (r.b) handleMoveJump(blackPly);
                          }}
                          className={`text-center font-black ${plyIndex === blackPly ? "text-[#b35f0f]" : "text-[#5f2f0b]"}`}
                        >
                          {r.b?.notation ?? ""}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                <button type="button" onClick={() => handleMoveJump(-1)} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-black">
                  Start
                </button>

                <button type="button" onClick={() => handleMoveJump(Math.max(-1, plyIndex - 1))} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-black">
                  Prev
                </button>

                <button type="button" onClick={() => handleMoveJump(Math.min(orderedMoves.length - 1, plyIndex + 1))} className="rounded-full bg-[#ff7a00] px-3 py-2 text-sm font-bold text-black">
                  Next
                </button>

                <button type="button" onClick={() => handleMoveJump(orderedMoves.length - 1)} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-black">
                  End
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-xs text-black/50">Current ply</div>
                <div className="mt-1 text-base font-black text-[#8d4b0e]">
                  {plyIndex < 0 ? "Start position" : `Move ${plyIndex + 1}`}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}
