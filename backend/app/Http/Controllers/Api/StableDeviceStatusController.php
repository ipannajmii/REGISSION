<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class StableDeviceStatusController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /*
         * REGISSION currently uses one physical Raspberry Pi.
         * Always read that same device row so the response cannot
         * alternate between different devices.
         */
        $device = DB::table('devices')
            ->where('enabled', 1)
            ->orderBy('id')
            ->first();

        if (!$device) {
            return response()->json([
                'device' => null,
                'device_online' => false,
                'session_active' => false,
                'active_game' => null,
                'latency_ms' => null,
                'last_seen_at' => null,
            ]);
        }

        /*
         * The Pi sends a heartbeat every 10 seconds.
         * Consider it online for 45 seconds after the last heartbeat.
         */
        $lastSeen = $device->last_seen_at
            ? Carbon::parse($device->last_seen_at)
            : null;

        $deviceOnline = $lastSeen !== null
            && $lastSeen->greaterThanOrEqualTo(now()->subSeconds(45));

        $activeGame = null;

        if (!empty($device->active_game_id)) {
            $game = DB::table('games')
                ->where('id', $device->active_game_id)
                ->where('status', 'ongoing')
                ->first();

            if ($game) {
                /*
                 * Users only see their own active session.
                 * Admins can still inspect everything from admin pages.
                 */
                $userId = optional($request->user())->id;

                if ($userId === null || (int) $game->user_id === (int) $userId) {
                    $activeGame = [
                        'id' => (int) $game->id,
                        'name' => (string) $game->name,
                        'status' => (string) $game->status,
                    ];
                }
            }
        }

        $sessionActive = $deviceOnline && $activeGame !== null;

        return response()->json([
            'device' => [
                'id' => (int) $device->id,
                'name' => (string) $device->name,
            ],
            'device_online' => $deviceOnline,
            'session_active' => $sessionActive,
            'active_game' => $activeGame,
            'latency_ms' => is_numeric($device->latency_ms)
                ? (int) $device->latency_ms
                : null,
            'last_seen_at' => $device->last_seen_at,
        ]);
    }
}