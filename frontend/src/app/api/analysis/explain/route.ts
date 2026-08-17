import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExplainMoveRequest = {
  fen: string;
  pgn?: string;
  currentMove?: string;
  bestMove?: string;
  evaluation?: string;
  depth?: number | string;
  principalVariation?: string;
  gameTitle?: string;
};

const MAX_FEN_LENGTH = 200;
const MAX_PGN_LENGTH = 12_000;
const MAX_TEXT_LENGTH = 2_000;

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown OpenAI API error.";
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "OPENAI_API_KEY is missing. Add it to regission-web/.env.local and restart Next.js.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Partial<ExplainMoveRequest>;

    const fen = cleanString(body.fen, MAX_FEN_LENGTH);
    const pgn = cleanString(body.pgn, MAX_PGN_LENGTH);
    const currentMove = cleanString(body.currentMove, MAX_TEXT_LENGTH);
    const bestMove = cleanString(body.bestMove, MAX_TEXT_LENGTH);
    const evaluation = cleanString(body.evaluation, MAX_TEXT_LENGTH);
    const principalVariation = cleanString(
      body.principalVariation,
      MAX_TEXT_LENGTH,
    );
    const gameTitle = cleanString(body.gameTitle, 200);
    const depth =
      typeof body.depth === "number" || typeof body.depth === "string"
        ? String(body.depth).slice(0, 30)
        : "";

    if (!fen) {
      return NextResponse.json(
        {
          ok: false,
          error: "FEN is required.",
        },
        { status: 400 },
      );
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

    const response = await client.responses.create({
      model,
      store: false,
      max_output_tokens: 650,
      instructions: [
        "You are REGISSION's chess coach.",
        "Explain chess positions in clear, simple English for university students.",
        "Use only the supplied FEN, PGN, current move, Stockfish evaluation, depth, best move, and principal variation.",
        "Do not invent a move, evaluation, tactic, check, checkmate, capture, or board fact that is not supported by the supplied data.",
        "Treat Stockfish as the authority for the best move and evaluation.",
        "When the current move is 'start position', explain the recommended opening move.",
        "Use concise headings: Move summary, Why it works, Threats and ideas, and Best continuation.",
        "Use SAN when it is available. When only UCI is supplied, show both the UCI move and a plain-language square explanation.",
        "Keep the answer between 120 and 230 words.",
      ].join(" "),
      input: [
        `Game: ${gameTitle || "REGISSION game"}`,
        `FEN: ${fen}`,
        `Current move: ${currentMove || "start position"}`,
        `Stockfish best move: ${bestMove || "not supplied"}`,
        `Stockfish evaluation: ${evaluation || "not supplied"}`,
        `Stockfish depth: ${depth || "not supplied"}`,
        `Principal variation: ${principalVariation || "not supplied"}`,
        `PGN: ${pgn || "not supplied"}`,
        "",
        "Explain the current position and move to the player.",
      ].join("\n"),
    });

    const explanation = response.output_text?.trim();

    if (!explanation) {
      return NextResponse.json(
        {
          ok: false,
          error: "OpenAI returned an empty explanation.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      explanation,
      model,
      responseId: response.id,
      usage: response.usage ?? null,
    });
  } catch (error: unknown) {
    const message = errorMessage(error);
    const lower = message.toLowerCase();

    let status = 500;
    let publicMessage = message;

    if (
      lower.includes("incorrect api key") ||
      lower.includes("invalid api key") ||
      lower.includes("401")
    ) {
      status = 401;
      publicMessage =
        "The OpenAI API key is invalid. Create a new key, update .env.local, and restart Next.js.";
    } else if (
      lower.includes("insufficient_quota") ||
      lower.includes("billing") ||
      lower.includes("quota")
    ) {
      status = 402;
      publicMessage =
        "The OpenAI API account has no available credit or billing is not active.";
    } else if (lower.includes("rate limit") || lower.includes("429")) {
      status = 429;
      publicMessage =
        "The OpenAI API rate limit was reached. Wait briefly and try again.";
    }

    console.error("[REGISSION OPENAI EXPLAIN ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: publicMessage,
      },
      { status },
    );
  }
}
