"use client";

import type { Piece } from "chess.js";

type Props = {
  board: (Piece | null)[][];
  flipped: boolean;
};

export default function ChessBoardView({ board, flipped }: Props) {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba".split("") : "abcdefgh".split("");

  const rows = flipped ? [...board].reverse() : board;
  const displayRows = rows.map((row) => (flipped ? [...row].reverse() : row));

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="grid grid-cols-[14px_1fr] grid-rows-[1fr_14px] gap-x-[6px] gap-y-[4px]">
          <div className="grid grid-rows-8">
            {ranks.map((rank) => (
              <div
                key={rank}
                className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]"
              >
                {rank}
              </div>
            ))}
          </div>

          <div className="overflow-hidden">
            <div className="grid aspect-square w-full grid-cols-8 border border-black/20 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
              {displayRows.flatMap((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const isLight = (rowIndex + colIndex) % 2 === 0;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="flex aspect-square items-center justify-center"
                      style={{
                        backgroundColor: isLight ? "#e6d2ad" : "#b98d63",
                      }}
                    >
                      {piece && (
                        <img
                          src={`/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-[74%] w-[74%] select-none object-contain"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div />

          <div className="grid grid-cols-8">
            {files.map((file) => (
              <div
                key={file}
                className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]"
              >
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}