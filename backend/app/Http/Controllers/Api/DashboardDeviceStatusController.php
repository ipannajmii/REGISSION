<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardDeviceStatusController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $device = $this->latestDevice();

        $activeGameId = $this->read(
            $device,
            [
                'active_game_id',
                'assigned_game_id',
                'current_game_id',
                'game_id',
            ]
        );

        $game = $this->activeGame($activeGameId);

        if ($game) {
            $activeGameId = (int) $game->id;
        }

        $lastSeenAt = $this->read(
            $device,
            [
                'last_seen_at',
                'last_seen',
                'last_heartbeat_at',
                'heartbeat_at',
                'updated_at',
            ]
        );

        [$online, $ageSeconds] = $this->presence($lastSeenAt);

        $latencyMs = $this->read(
            $device,
            [
                'latency_ms',
                'heartbeat_latency_ms',
                'last_latency_ms',
            ]
        );

        $movesCount = $this->moveCount($activeGameId);

        $gamePayload = null;

        if ($game) {
            $gamePayload = [
                'id' => (int) $game->id,
                'name' => $this->read(
                    $game,
                    ['name', 'title', 'game_name'],
                    'Game '.$game->id
                ),
                'status' => $this->read(
                    $game,
                    ['status', 'game_status', 'state']
                ),
                'fen' => $this->read(
                    $game,
                    ['current_fen', 'final_fen', 'fen']
                ),
                'moves_count' => $movesCount,
            ];
        }

        return response()->json([
            'ok' => true,
            'source' => 'laravel_heartbeat',
            'online' => $online,
            'connected' => $online,
            'connection' => $online ? 'online' : 'offline',
            'status' => $online ? 'online' : 'offline',
            'device_online' => $online,
            'service_online' => $online,
            'last_seen_at' => $lastSeenAt,
            'last_seen' => $lastSeenAt,
            'latency_ms' => $latencyMs,
            'age_seconds' => $ageSeconds,
            'active_game_id' => $activeGameId
                ? (int) $activeGameId
                : null,
            'game_id' => $activeGameId
                ? (int) $activeGameId
                : null,
            'game_assigned' => (bool) $activeGameId,
            'has_active_game' => (bool) $activeGameId,
            'sync_required' => false,
            'device' => [
                'id' => $this->read($device, ['id']),
                'name' => $this->read(
                    $device,
                    ['name', 'device_name'],
                    'REGISSION Raspberry Pi'
                ),
                'online' => $online,
                'connected' => $online,
                'last_seen_at' => $lastSeenAt,
                'latency_ms' => $latencyMs,
                'active_game_id' => $activeGameId
                    ? (int) $activeGameId
                    : null,
            ],
            'heartbeat' => [
                'configured' => true,
                'online' => $online,
                'connected' => $online,
                'last_sent_at' => $lastSeenAt,
                'last_seen_at' => $lastSeenAt,
                'latency_ms' => $latencyMs,
                'error' => null,
            ],
            'active_game' => $gamePayload,
            'game' => $gamePayload,
            'message' => $online
                ? 'Raspberry Pi heartbeat is online.'
                : 'Raspberry Pi heartbeat is offline.',
        ]);
    }

    private function latestDevice(): ?object
    {
        if (! Schema::hasTable('devices')) {
            return null;
        }

        $columns = Schema::getColumnListing('devices');

        $orderColumn = in_array(
            'last_seen_at',
            $columns,
            true
        )
            ? 'last_seen_at'
            : (
                in_array('updated_at', $columns, true)
                    ? 'updated_at'
                    : 'id'
            );

        return DB::table('devices')
            ->orderByDesc($orderColumn)
            ->first();
    }

    private function activeGame(mixed $activeGameId): ?object
    {
        if (! Schema::hasTable('games')) {
            return null;
        }

        $columns = Schema::getColumnListing('games');

        if ($activeGameId) {
            $game = DB::table('games')
                ->where('id', $activeGameId)
                ->first();

            if ($game) {
                return $game;
            }
        }

        $query = DB::table('games');

        if (in_array('is_active', $columns, true)) {
            $query->where('is_active', 1);
        } elseif (in_array('active', $columns, true)) {
            $query->where('active', 1);
        } elseif (in_array('status', $columns, true)) {
            $query->whereIn(
                'status',
                ['active', 'ongoing', 'in_progress']
            );
        } else {
            return null;
        }

        $orderColumn = in_array(
            'updated_at',
            $columns,
            true
        )
            ? 'updated_at'
            : 'id';

        return $query
            ->orderByDesc($orderColumn)
            ->first();
    }

    private function moveCount(mixed $activeGameId): ?int
    {
        if (
            ! $activeGameId ||
            ! Schema::hasTable('moves')
        ) {
            return null;
        }

        $columns = Schema::getColumnListing('moves');

        if (! in_array('game_id', $columns, true)) {
            return null;
        }

        return DB::table('moves')
            ->where('game_id', $activeGameId)
            ->count();
    }

    private function presence(
        mixed $lastSeenAt
    ): array {
        if (! $lastSeenAt) {
            return [false, null];
        }

        try {
            $lastSeen = Carbon::parse($lastSeenAt);
            $now = now();

            $ageSeconds = max(
                0,
                $lastSeen->diffInSeconds($now, true)
            );

            $online = $lastSeen->greaterThanOrEqualTo(
                $now->copy()->subSeconds(40)
            );

            return [$online, $ageSeconds];
        } catch (\Throwable $exception) {
            return [false, null];
        }
    }

    private function read(
        ?object $row,
        array $names,
        mixed $default = null
    ): mixed {
        if (! $row) {
            return $default;
        }

        foreach ($names as $name) {
            if (! property_exists($row, $name)) {
                continue;
            }

            $value = $row->{$name};

            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return $default;
    }
}
