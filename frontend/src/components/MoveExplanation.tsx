"use client";

import { useState } from "react";

type MoveExplanationProps = {
  fen: string;
  pgn?: string;
  currentMove?: string;
  bestMove?: string;
  evaluation?: string;
  depth?: number | string;
  principalVariation?: string;
  gameTitle?: string;
};

type ExplainResponse = {
  ok: boolean;
  explanation?: string;
  error?: string;
  model?: string;
};

export default function MoveExplanation({
  fen,
  pgn = "",
  currentMove = "start position",
  bestMove = "",
  evaluation = "",
  depth = "",
  principalVariation = "",
  gameTitle = "REGISSION game",
}: MoveExplanationProps) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");

  async function explainMove() {
    if (!fen.trim()) {
      setError("A valid FEN is required before the move can be explained.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analysis/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          fen,
          pgn,
          currentMove,
          bestMove,
          evaluation,
          depth,
          principalVariation,
          gameTitle,
        }),
      });

      const data = (await response.json()) as ExplainResponse;

      if (!response.ok || !data.ok || !data.explanation) {
        throw new Error(data.error || "The move explanation failed.");
      }

      setExplanation(data.explanation);
      setModel(data.model || "");
    } catch (requestError: unknown) {
      setExplanation("");
      setModel("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The move explanation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "22px",
        padding: "18px",
        background: "rgba(7, 16, 38, 0.78)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#ff9818",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            GAME INFO
          </h2>
          <p
            style={{
              margin: "5px 0 0",
              color: "#aeb5c6",
              fontSize: "14px",
            }}
          >
            AI explanation for the current position and move
          </p>
        </div>

        <button
          type="button"
          onClick={explainMove}
          disabled={loading || !fen.trim()}
          style={{
            border: 0,
            borderRadius: "999px",
            padding: "12px 20px",
            background: loading ? "#756d65" : "#ff8a00",
            color: "#111827",
            fontWeight: 800,
            cursor: loading ? "wait" : "pointer",
            opacity: !fen.trim() ? 0.55 : 1,
          }}
        >
          {loading ? "Explaining..." : "Explain Move"}
        </button>
      </div>

      <div
        aria-live="polite"
        style={{
          minHeight: "140px",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "16px",
          padding: "16px",
          background: "rgba(255,255,255,0.025)",
          color: error ? "#ff9a9a" : "#e8ebf2",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {error ||
          explanation ||
          "Click Explain Move to generate simple Chess.com / Lichess-style notes for this position."}
      </div>

      {model && (
        <p
          style={{
            margin: "10px 2px 0",
            color: "#7f899e",
            fontSize: "12px",
          }}
        >
          Generated with {model}
        </p>
      )}
    </section>
  );
}
