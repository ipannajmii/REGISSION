import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChessInfoRequest = {
  fen?: unknown;
  move?: unknown;
  pgn?: unknown;
  bestMove?: unknown;
  bestLine?: unknown;
  evaluation?: unknown;
  depth?: unknown;
  gameName?: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown OpenAI API error.";
}

function extractResponsesText(response: any): string {
  const direct =
    typeof response?.output_text === "string"
      ? response.output_text.trim()
      : "";

  if (direct) {
    return direct;
  }

  const parts: string[] = [];

  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string" &&
        content.text.trim()
      ) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n\n").trim();
}

function buildInstructions(): string {
  return [
    "You are REGISSION's chess coach.",
    "Explain the selected move in a clear Chess.com-style review, but do not claim to be Chess.com.",
    "Use simple English suitable for a university chess-club player.",
    "The supplied FEN is the board position after the selected move.",
    "The supplied Stockfish best move is the recommended next move from that FEN.",
    "Treat the supplied Stockfish evaluation, best move, and principal variation as authoritative.",
    "Do not invent pieces, squares, checks, captures, tactics, or engine values.",
    "Identify the opening name from the PGN when reasonably confident.",
    "When the exact variation is uncertain, give only the broad opening family and say that it is an approximate classification.",
    "Give a move verdict using one of: Best, Excellent, Good, Playable, Inaccuracy, Mistake, Blunder.",
    "Do not use Mistake or Blunder unless the supplied information clearly supports it.",
    "If there is not enough information for a precise accuracy grade, use Playable and explain the limitation.",
    "Explain both the benefits and drawbacks of the selected move.",
    "Use exactly this plain-text layout:",
    "OPENING: <opening name or broad family>",
    "MOVE VERDICT: <verdict>",
    "EVALUATION: <who is better and by how much>",
    "WHY IT IS GOOD:",
    "<short explanation>",
    "WHAT COULD BE BETTER:",
    "<short explanation>",
    "BEST REPLY:",
    "<Stockfish move and why>",
    "PLAN:",
    "<practical next plan for both sides>",
    "Keep the answer between 150 and 260 words.",
  ].join(" ");
}

function buildInput(data: {
  fen: string;
  move: string;
  pgn: string;
  bestMove: string;
  bestLine: string;
  evaluation: string;
  depth: string;
  gameName: string;
}): string {
  return [
    `Game: ${data.gameName || "REGISSION game"}`,
    `Selected move just played: ${data.move || "start position"}`,
    `FEN after the selected move: ${data.fen}`,
    `Stockfish evaluation: ${data.evaluation || "not supplied"}`,
    `Stockfish recommended next move: ${data.bestMove || "not supplied"}`,
    `Stockfish depth: ${data.depth || "not supplied"}`,
    `Stockfish principal variation: ${data.bestLine || "not supplied"}`,
    `PGN up to the game: ${data.pgn || "not supplied"}`,
    "",
    "Create the move review now.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is missing from regission-web/.env.local. " +
            "Add the key and restart npm run dev.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChessInfoRequest;

    const data = {
      fen: cleanText(body.fen, 200),
      move: cleanText(body.move, 100),
      pgn: cleanText(body.pgn, 14_000),
      bestMove: cleanText(body.bestMove, 100),
      bestLine: cleanText(body.bestLine, 3_000),
      evaluation: cleanText(body.evaluation, 100),
      depth:
        typeof body.depth === "number" ||
        typeof body.depth === "string"
          ? String(body.depth).slice(0, 30)
          : "",
      gameName: cleanText(body.gameName, 200),
    };

    if (!data.fen) {
      return NextResponse.json(
        { error: "FEN is required." },
        { status: 400 },
      );
    }

    const client = new OpenAI({ apiKey });
    const instructions = buildInstructions();
    const input = buildInput(data);

    const primaryModel =
      process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

    const primary = await client.responses.create({
      model: primaryModel,
      store: false,
      reasoning: {
        effort: "minimal",
      },
      max_output_tokens: 1_600,
      instructions,
      input,
    });

    let text = extractResponsesText(primary);
    let modelUsed = primaryModel;
    let responseId = primary.id;
    let usage: unknown = primary.usage ?? null;
    let usedFallback = false;

    // GPT-5 can occasionally spend the available output budget on
    // reasoning and return no visible text. Use a non-reasoning fallback
    // so the button always returns a readable explanation.
    if (!text) {
      const fallbackModel =
        process.env.OPENAI_FALLBACK_MODEL?.trim() ||
        "gpt-4.1-mini";

      const fallback = await client.chat.completions.create({
        model: fallbackModel,
        temperature: 0.25,
        max_tokens: 1_100,
        messages: [
          {
            role: "system",
            content: instructions,
          },
          {
            role: "user",
            content: input,
          },
        ],
      });

      text =
        fallback.choices?.[0]?.message?.content?.trim() || "";
      modelUsed = fallbackModel;
      responseId = fallback.id;
      usage = fallback.usage ?? null;
      usedFallback = true;
    }

    if (!text) {
      return NextResponse.json(
        {
          error:
            "OpenAI completed the request but returned no visible text. " +
            "Check the Next.js terminal for the response status and try again.",
          debug: {
            primaryModel,
            responseId: primary.id,
            status: primary.status,
            incompleteDetails:
              primary.incomplete_details ?? null,
            outputTypes: Array.isArray(primary.output)
              ? primary.output.map((item: any) => item?.type)
              : [],
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      text,
      model: modelUsed,
      responseId,
      usage,
      usedFallback,
    });
  } catch (error: unknown) {
    const message = errorText(error);
    const lower = message.toLowerCase();

    console.error("[REGISSION OPENAI EXPLANATION ERROR]", error);

    if (
      lower.includes("incorrect api key") ||
      lower.includes("invalid api key") ||
      lower.includes("401")
    ) {
      return NextResponse.json(
        {
          error:
            "The OpenAI API key is invalid. Create a new key, update .env.local, and restart Next.js.",
        },
        { status: 401 },
      );
    }

    if (
      lower.includes("insufficient_quota") ||
      lower.includes("quota") ||
      lower.includes("billing")
    ) {
      return NextResponse.json(
        {
          error:
            "The OpenAI API account has no available credit, or API billing is not active.",
        },
        { status: 402 },
      );
    }

    if (lower.includes("rate limit") || lower.includes("429")) {
      return NextResponse.json(
        {
          error:
            "The OpenAI API rate limit was reached. Wait briefly and click Explain Move again.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: message || "Failed to generate the move review.",
      },
      { status: 500 },
    );
  }
}
