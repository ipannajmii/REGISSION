<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DeviceApiController extends Controller
{
    public function heartbeat(Request $request): JsonResponse
    {
        $plainToken = trim((string) $request->header('X-Device-Token'));

        if ($plainToken === '') {
            return response()->json([
                'message' => 'Missing device token.',
            ], 401);
        }

        if (!Schema::hasTable('devices')) {
            return response()->json([
                'message' => 'Devices table is missing.',
            ], 500);
        }

        $tokenHash = hash('sha256', $plainToken);

        $device = DB::table('devices')
            ->where('token_hash', $tokenHash)
            ->where('enabled', 1)
            ->first();

        if (!$device) {
            return response()->json([
                'message' => 'Invalid device token.',
            ], 401);
        }

        $updates = [
            'last_seen_at' => now(),
            'updated_at' => now(),
        ];

        $latency = $request->input('latency_ms');

        if (is_numeric($latency)) {
            $updates['latency_ms'] = max(
                0,
                min((int) $latency, 60000)
            );
        }

        DB::table('devices')
            ->where('id', $device->id)
            ->update($updates);

        $freshDevice = DB::table('devices')
            ->where('id', $device->id)
            ->first();

        $activeGame = null;

        if (
            $freshDevice &&
            !empty($freshDevice->active_game_id) &&
            Schema::hasTable('games')
        ) {
            $game = DB::table('games')
                ->where('id', $freshDevice->active_game_id)
                ->first();

            if ($game) {
                $activeGame = [
                    'id' => $game->id,
                    'name' => $game->name,
                    'status' => $game->status,
                ];
            }
        }

        return response()->json([
            'message' => 'Heartbeat received.',
            'device' => [
                'id' => $freshDevice->id,
                'name' => $freshDevice->name,
                'online' => true,
                'last_seen_at' => $freshDevice->last_seen_at,
                'latency_ms' => $freshDevice->latency_ms,
                'active_game' => $activeGame,
            ],
        ]);
    }
}