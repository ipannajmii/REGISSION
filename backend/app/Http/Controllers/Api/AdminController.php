<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\Move;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function overview(): JsonResponse
    {
        return response()->json([
            'total_users' => User::where('role', 'user')->count(),
            'total_admins' => User::where('role', 'admin')->count(),
            'total_games' => Game::count(),
            'ongoing_games' => Game::where('status', 'ongoing')->count(),
            'completed_games' => Game::where('status', 'completed')->count(),
            'total_moves' => Move::count(),

            'recent_users' => User::latest()
                ->limit(5)
                ->get(),

            'recent_games' => Game::with('user:id,name,email')
                ->withCount('moves')
                ->latest()
                ->limit(5)
                ->get(),

            'recent_moves' => Move::with([
                'game:id,user_id,name',
                'game.user:id,name,email',
            ])
                ->latest()
                ->limit(10)
                ->get(),
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $query = User::query()->withCount('games');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->latest()->paginate(15)
        );
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'You cannot delete your own administrator account.',
            ], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }

    public function games(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');

        $query = Game::with('user:id,name,email')
            ->withCount('moves');

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        if (in_array($status, ['ongoing', 'completed'], true)) {
            $query->where('status', $status);
        }

        return response()->json(
            $query->latest()->paginate(15)
        );
    }

    public function destroyGame(Game $game): JsonResponse
    {
        $game->delete();

        return response()->json([
            'message' => 'Game and its moves deleted successfully.',
        ]);
    }

    public function moves(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $query = Move::with([
            'game:id,user_id,name',
            'game.user:id,name,email',
        ]);

        if ($search !== '') {
            $query->where('notation', 'like', "%{$search}%");
        }

        return response()->json(
            $query->latest()->paginate(20)
        );
    }

    public function destroyMove(Move $move): JsonResponse
    {
        // REGISSION_SAFE_ADMIN_MOVE_DELETE_V2
        // Only the latest move may be removed. Device assignment,
        // heartbeat and Raspberry Pi connection fields are never touched.
        $arguments = func_get_args();
        $moveModel = null;

        foreach ($arguments as $argument) {
            if (
                $argument instanceof
                    \Illuminate\Database\Eloquent\Model
                && $argument->getTable() === 'moves'
            ) {
                $moveModel = $argument;
                break;
            }
        }

        if (!$moveModel) {
            foreach (array_reverse($arguments) as $argument) {
                if (
                    is_int($argument)
                    || (
                        is_string($argument)
                        && ctype_digit($argument)
                    )
                ) {
                    $moveModel = \Illuminate\Support\Facades\DB::table(
                        'moves'
                    )
                        ->where('id', $argument)
                        ->first();

                    if ($moveModel) {
                        $moveModel = new \App\Models\Move(
                            (array) $moveModel
                        );
                        $moveModel->exists = true;
                        $moveModel->setAttribute('id', $argument);
                    }

                    break;
                }
            }
        }

        if (!$moveModel) {
            return response()->json([
                'message' => 'The move could not be resolved safely.',
            ], 422);
        }

        $moveId = $moveModel->getAttribute('id');
        $gameId = $moveModel->getAttribute('game_id');

        if (!$moveId || !$gameId) {
            return response()->json([
                'message' => 'The selected move has invalid identifiers.',
            ], 422);
        }

        $moveColumns = \Illuminate\Support\Facades\Schema::getColumnListing(
            'moves'
        );

        $gameColumns = \Illuminate\Support\Facades\Schema::getColumnListing(
            'games'
        );

        $latestId = \Illuminate\Support\Facades\DB::table('moves')
            ->where('game_id', $gameId)
            ->max('id');

        if ((string) $latestId !== (string) $moveId) {
            return response()->json([
                'message' => (
                    'Only the latest move can be deleted safely. '
                    . 'Delete newer moves first.'
                ),
                'game_id' => (int) $gameId,
                'selected_move_id' => (int) $moveId,
                'latest_move_id' => $latestId,
            ], 409);
        }

        $deletedRow = \Illuminate\Support\Facades\DB::table('moves')
            ->where('id', $moveId)
            ->where('game_id', $gameId)
            ->first();

        if (!$deletedRow) {
            return response()->json([
                'message' => 'The move no longer exists.',
            ], 404);
        }

        $sanColumn = null;

        foreach ([
            'san',
            'notation',
            'move_san',
            'move_notation',
            'move',
        ] as $column) {
            if (in_array($column, $moveColumns, true)) {
                $sanColumn = $column;
                break;
            }
        }

        $deletedFenBefore = null;

        foreach ([
            'fen_before',
            'before_fen',
            'previous_fen',
            'from_fen',
        ] as $column) {
            if (
                in_array($column, $moveColumns, true)
                && !empty($deletedRow->{$column})
            ) {
                $deletedFenBefore = trim(
                    (string) $deletedRow->{$column}
                );
                break;
            }
        }

        $result = \Illuminate\Support\Facades\DB::transaction(
            function () use (
                $moveId,
                $gameId,
                $moveColumns,
                $gameColumns,
                $sanColumn,
                $deletedFenBefore
            ) {
                $deleted = \Illuminate\Support\Facades\DB::table('moves')
                    ->where('id', $moveId)
                    ->where('game_id', $gameId)
                    ->delete();

                if ($deleted !== 1) {
                    throw new \RuntimeException(
                        'Expected to delete exactly one move.'
                    );
                }

                $latest = \Illuminate\Support\Facades\DB::table('moves')
                    ->where('game_id', $gameId)
                    ->orderByDesc('id')
                    ->first();

                $count = \Illuminate\Support\Facades\DB::table('moves')
                    ->where('game_id', $gameId)
                    ->count();

                $restoredSan = null;
                $restoredFen = null;

                if ($latest) {
                    if ($sanColumn) {
                        $restoredSan = trim(
                            (string) (
                                $latest->{$sanColumn}
                                ?? ''
                            )
                        );
                    }

                    foreach ([
                        'fen_after',
                        'after_fen',
                        'resulting_fen',
                        'current_fen',
                        'fen',
                    ] as $column) {
                        if (
                            in_array($column, $moveColumns, true)
                            && !empty($latest->{$column})
                        ) {
                            $restoredFen = trim(
                                (string) $latest->{$column}
                            );
                            break;
                        }
                    }
                } else {
                    $restoredFen = (
                        'rnbqkbnr/pppppppp/8/8/8/8/'
                        . 'PPPPPPPP/RNBQKBNR w KQkq - 0 1'
                    );
                }

                if (!$restoredFen && $deletedFenBefore) {
                    $restoredFen = $deletedFenBefore;
                }

                $updates = [];

                if ($restoredFen) {
                    foreach ([
                        'fen',
                        'current_fen',
                        'position_fen',
                        'last_fen',
                    ] as $column) {
                        if (in_array($column, $gameColumns, true)) {
                            $updates[$column] = $restoredFen;
                        }
                    }
                }

                foreach ([
                    'last_move',
                    'last_move_san',
                ] as $column) {
                    if (in_array($column, $gameColumns, true)) {
                        $updates[$column] = $restoredSan ?: null;
                    }
                }

                foreach ([
                    'move_count',
                    'moves_count',
                    'ply_count',
                ] as $column) {
                    if (in_array($column, $gameColumns, true)) {
                        $updates[$column] = $count;
                    }
                }

                if (in_array('updated_at', $gameColumns, true)) {
                    $updates['updated_at'] = now();
                }

                if ($updates) {
                    \Illuminate\Support\Facades\DB::table('games')
                        ->where('id', $gameId)
                        ->update($updates);
                }

                return [
                    'count' => $count,
                    'fen' => $restoredFen,
                    'san' => $restoredSan,
                ];
            }
        );

        return response()->json([
            'message' => 'Latest move deleted safely.',
            'deleted_move_id' => (int) $moveId,
            'game_id' => (int) $gameId,
            'remaining_moves' => $result['count'],
            'restored_fen' => $result['fen'],
            'restored_last_move' => $result['san'],
            'device_connection_changed' => false,
        ]);
}
}