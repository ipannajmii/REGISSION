<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameController extends Controller
{
    private function userGames(Request $request): Builder
    {
        return Game::query()
            ->where('user_id', $request->user()->id);
    }

    private function ensureOwner(Request $request, Game $game): void
    {
        abort_unless(
            $game->user_id === $request->user()->id ||
            $request->user()->role === 'admin',
            403,
            'You are not authorised to access this game.'
        );
    }

    public function index(Request $request): JsonResponse
    {
        $query = $this->userGames($request)
            ->with([
                'moves' => fn ($q) => $q->orderBy('id'),
            ]);

        $status = $request->query('status');
        $search = trim((string) $request->query('search', ''));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        if (in_array($status, ['ongoing', 'completed'], true)) {
            $query->where('status', $status);
        }

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        if ($dateFrom) {
            $query->whereDate('completed_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('completed_at', '<=', $dateTo);
        }

        return response()->json(
            $query->orderByDesc('updated_at')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);

        $duplicate = $this->userGames($request)
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'You already have a game with this name.',
            ], 422);
        }

        $game = Game::create([
            'user_id' => $request->user()->id,
            'name' => $name,
            'status' => 'ongoing',
            'completed_at' => null,
        ]);

        return response()->json($game, 201);
    }

    public function show(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);

        return response()->json(
            $game->load([
                'moves' => fn ($q) => $q->orderBy('id'),
            ])
        );
    }

    public function complete(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);

        $game->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Game marked as completed.',
            'game' => $game->fresh()->load([
                'moves' => fn ($q) => $q->orderBy('id'),
            ]),
        ]);
    }

    public function destroy(Request $request, Game $game): JsonResponse
    {
        $this->ensureOwner($request, $game);
        $game->delete();

        return response()->json([
            'message' => 'Game deleted successfully.',
        ]);
    }
}