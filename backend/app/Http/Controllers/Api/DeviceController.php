<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Game;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    private function device(): Device
    {
        return Device::query()->firstOrFail();
    }

    public function show(Request $request): JsonResponse
    {
        $device = $this->device()->load([
            'activeGame.user:id,name,email',
            'activeGame.moves:id,game_id,notation,created_at',
        ]);

        $activeGame = $device->activeGame;

        if (
            $activeGame &&
            $request->user()->role !== 'admin' &&
            $activeGame->user_id !== $request->user()->id
        ) {
            $activeGame = null;
        }

        return response()->json([
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'enabled' => $device->enabled,
                'online' => $device->isOnline(),
                'last_seen_at' => $device->last_seen_at,
                'latency_ms' => $device->latency_ms,
                'active_game' => $activeGame,
            ],
        ]);
    }

    public function activate(
        Request $request,
        Game $game
    ): JsonResponse {
        abort_unless(
            $request->user()->role === 'admin' ||
            $game->user_id === $request->user()->id,
            403,
            'You are not authorised to activate this game.'
        );

        if ($game->status !== 'ongoing') {
            return response()->json([
                'message' => 'Only an ongoing game can be assigned to the Raspberry Pi.',
            ], 422);
        }

        $device = $this->device();

        $device->update([
            'active_game_id' => $game->id,
        ]);

        return response()->json([
            'message' => 'Game activated on the Raspberry Pi.',
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'online' => $device->isOnline(),
                'last_seen_at' => $device->last_seen_at,
                'latency_ms' => $device->latency_ms,
                'active_game' => $game->load('moves'),
            ],
        ]);
    }

    public function deactivate(Request $request): JsonResponse
    {
        $device = $this->device();

        $activeGame = $device->activeGame;

        if (
            $activeGame &&
            $request->user()->role !== 'admin' &&
            $activeGame->user_id !== $request->user()->id
        ) {
            return response()->json([
                'message' => 'Another user currently owns the active game.',
            ], 403);
        }

        $device->update([
            'active_game_id' => null,
        ]);

        return response()->json([
            'message' => 'Raspberry Pi game assignment cleared.',
        ]);
    }
}