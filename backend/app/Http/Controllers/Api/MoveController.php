<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\Move;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MoveController extends Controller
{
    private function ensureOwner(Request $request, Game $game): void
    {
        abort_unless(
            $game->user_id === $request->user()->id ||
            $request->user()->role === 'admin',
            403,
            'You are not authorised to access this game.'
        );
    }

    public function index(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);

        return response()->json(
            $game->moves()->orderBy('id')->get()
        );
    }

    public function store(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);

        if ($game->status === 'completed') {
            return response()->json([
                'message' => 'Moves cannot be added to a completed game.',
            ], 422);
        }

        $validated = $request->validate([
            'notation' => ['required', 'string', 'max:50'],
            'uci' => [
                'nullable',
                'string',
                'max:10',
                'regex:/^[a-h][1-8][a-h][1-8][qrbn]?$/i',
            ],
            'fen_before' => ['nullable', 'string', 'max:255'],
            'fen' => ['nullable', 'string', 'max:255'],
            'ply_before' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'event_id' => [
                'nullable',
                'string',
                'size:64',
                'regex:/^[a-f0-9]{64}$/i',
            ],
            'source' => ['nullable', 'string', 'max:40'],
            'latency_ms' => ['nullable', 'integer', 'min:0', 'max:600000'],
        ]);

        $eventId = isset($validated['event_id'])
            ? strtolower(trim($validated['event_id']))
            : null;

        $attributes = [
            'notation' => trim($validated['notation']),
            'uci' => isset($validated['uci'])
                ? strtolower(trim($validated['uci']))
                : null,
            'fen_before' => isset($validated['fen_before'])
                ? trim($validated['fen_before'])
                : null,
            'fen' => isset($validated['fen'])
                ? trim($validated['fen'])
                : null,
            'ply_before' => $validated['ply_before'] ?? null,
            'event_id' => $eventId,
            'source' => isset($validated['source'])
                ? trim($validated['source'])
                : 'website',
            'latency_ms' => $validated['latency_ms'] ?? null,
        ];

        if ($eventId !== null) {
            $existing = $game->moves()
                ->where('event_id', $eventId)
                ->first();

            if ($existing) {
                return response()->json(array_merge(
                    $existing->toArray(),
                    [
                        'duplicate' => true,
                        'message' => 'Duplicate move event ignored.',
                    ]
                ));
            }
        }

        // Secondary position guard. The Pi creates a deterministic event_id,
        // but this also blocks the same UCI from the same FEN if an older or
        // manually edited client accidentally changes/omits that ID.
        if (
            !empty($attributes['fen_before']) &&
            !empty($attributes['uci'])
        ) {
            $existingPositionMove = $game->moves()
                ->where('fen_before', $attributes['fen_before'])
                ->where('uci', $attributes['uci'])
                ->first();

            if ($existingPositionMove) {
                return response()->json(array_merge(
                    $existingPositionMove->toArray(),
                    [
                        'duplicate' => true,
                        'message' => 'Duplicate board-position move ignored.',
                    ]
                ));
            }
        }

        try {
            $result = DB::transaction(function () use (
                $game,
                $eventId,
                $attributes
            ): array {
                if ($eventId !== null) {
                    $existing = Move::query()
                        ->where('game_id', $game->id)
                        ->where('event_id', $eventId)
                        ->lockForUpdate()
                        ->first();

                    if ($existing) {
                        return [
                            'move' => $existing,
                            'duplicate' => true,
                        ];
                    }
                }

                if (
                    !empty($attributes['fen_before']) &&
                    !empty($attributes['uci'])
                ) {
                    $existing = Move::query()
                        ->where('game_id', $game->id)
                        ->where('fen_before', $attributes['fen_before'])
                        ->where('uci', $attributes['uci'])
                        ->lockForUpdate()
                        ->first();

                    if ($existing) {
                        return [
                            'move' => $existing,
                            'duplicate' => true,
                        ];
                    }
                }

                $move = $game->moves()->create($attributes);

                return [
                    'move' => $move,
                    'duplicate' => false,
                ];
            }, 3);
        } catch (QueryException $exception) {
            // A simultaneous request may reach the unique index after another
            // request committed the same event. Return the stored row instead
            // of creating a second move or showing a server error.
            if ($eventId !== null) {
                $existing = $game->moves()
                    ->where('event_id', $eventId)
                    ->first();

                if ($existing) {
                    return response()->json(array_merge(
                        $existing->toArray(),
                        [
                            'duplicate' => true,
                            'message' => 'Duplicate move event ignored.',
                        ]
                    ));
                }
            }

            throw $exception;
        }

        /** @var Move $move */
        $move = $result['move'];
        $duplicate = (bool) $result['duplicate'];

        return response()->json(array_merge(
            $move->toArray(),
            [
                'duplicate' => $duplicate,
                'message' => $duplicate
                    ? 'Duplicate move event ignored.'
                    : 'Move saved.',
            ]
        ), $duplicate ? 200 : 201);
    }

    public function deleteLatest(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);

        $move = $game->moves()->latest('id')->first();

        if (!$move) {
            return response()->json([
                'message' => 'No move is available to delete.',
            ], 404);
        }

        $move->delete();

        return response()->json([
            'message' => 'Latest move deleted successfully.',
        ]);
    }

    public function destroy(Request $request, Move $move): JsonResponse
    {
        $move->load('game');

        abort_unless(
            $move->game &&
            (
                $move->game->user_id === $request->user()->id ||
                $request->user()->role === 'admin'
            ),
            403,
            'You are not authorised to delete this move.'
        );

        $move->delete();

        return response()->json([
            'message' => 'Move deleted successfully.',
        ]);
    }
}
