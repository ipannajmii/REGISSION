<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceApiController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\MoveController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\StableDeviceStatusController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

/*
|--------------------------------------------------------------------------
| Password reset
|--------------------------------------------------------------------------
*/

Route::post('/forgot-password', [
    PasswordResetController::class,
    'forgotPassword',
])->middleware('throttle:5,1');

Route::post('/reset-password', [
    PasswordResetController::class,
    'resetPassword',
])->middleware('throttle:5,1');

/*
|--------------------------------------------------------------------------
| Authenticated user routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    /*
    |--------------------------------------------------------------------------
    | Raspberry Pi assignment
    |--------------------------------------------------------------------------
    */

    Route::get('/device', [
        DeviceController::class,
        'show',
    ]);

    Route::post('/games/{game}/activate-device', [
        DeviceController::class,
        'activate',
    ]);

    Route::delete('/device/active-game', [
        DeviceController::class,
        'deactivate',
    ]);

    Route::get('/device/status-stable', [
        StableDeviceStatusController::class,
        'show',
    ]);

    /*
    |--------------------------------------------------------------------------
    | User profile
    |--------------------------------------------------------------------------
    */

    Route::get('/profile', [
        ProfileController::class,
        'show',
    ]);

    Route::put('/profile', [
        ProfileController::class,
        'update',
    ]);

    Route::put('/profile/password', [
        ProfileController::class,
        'changePassword',
    ]);

    Route::post('/profile/avatar', [
        ProfileController::class,
        'uploadAvatar',
    ]);

    Route::delete('/profile/avatar', [
        ProfileController::class,
        'deleteAvatar',
    ]);

    /*
    |--------------------------------------------------------------------------
    | Games
    |--------------------------------------------------------------------------
    */

    Route::get('/games', [
        GameController::class,
        'index',
    ]);

    Route::post('/games', [
        GameController::class,
        'store',
    ]);

    Route::get('/games/{game}', [
        GameController::class,
        'show',
    ]);

    Route::delete('/games/{game}', [
        GameController::class,
        'destroy',
    ]);

    Route::post('/games/{game}/complete', [
        GameController::class,
        'complete',
    ]);

    /*
    |--------------------------------------------------------------------------
    | Moves
    |--------------------------------------------------------------------------
    */

    Route::get('/games/{game}/moves', [
        MoveController::class,
        'index',
    ]);

    Route::post('/games/{game}/moves', [
        MoveController::class,
        'store',
    ]);

    Route::delete('/games/{game}/moves/latest', [
        MoveController::class,
        'deleteLatest',
    ]);

    Route::delete('/moves/{move}', [
        MoveController::class,
        'destroy',
    ]);
});

/*
|--------------------------------------------------------------------------
| Raspberry Pi device API
|--------------------------------------------------------------------------
*/

Route::prefix('device-api')->group(function () {
    Route::post('/heartbeat', [
        DeviceApiController::class,
        'heartbeat',
    ])->middleware('throttle:120,1');

    Route::post('/moves', [
        DeviceApiController::class,
        'storeMove',
    ]);
});

/*
|--------------------------------------------------------------------------
| Administrator routes
|--------------------------------------------------------------------------
*/

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'admin'])
    ->group(function () {
        Route::get('/overview', [
            AdminController::class,
            'overview',
        ]);

        Route::get('/users', [
            AdminController::class,
            'users',
        ]);

        Route::delete('/users/{user}', [
            AdminController::class,
            'destroyUser',
        ]);

        Route::get('/games', [
            AdminController::class,
            'games',
        ]);

        Route::delete('/games/{game}', [
            AdminController::class,
            'destroyGame',
        ]);

        Route::get('/moves', [
            AdminController::class,
            'moves',
        ]);

        Route::delete('/moves/{move}', [
            AdminController::class,
            'destroyMove',
        ]);
    });

// REGISSION_AUTO_COMPLETE_ROUTE_V1
\Illuminate\Support\Facades\Route::post(
    '/games/{game}/auto-complete',
    function (\Illuminate\Http\Request $request, $game) {
        $gameId = (int) $game;

        if (
            !\Illuminate\Support\Facades\Schema::hasTable('games') ||
            !\Illuminate\Support\Facades\DB::table('games')
                ->where('id', $gameId)
                ->exists()
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Game not found.',
            ], 404);
        }

        $columns = array_flip(
            \Illuminate\Support\Facades\Schema::getColumnListing('games')
        );

        $result = (string) $request->input('result', '*');
        $termination = (string) $request->input(
            'termination',
            'game_over'
        );
        $winner = $request->input('winner');
        $finalFen = $request->input('final_fen');
        $lastMove = $request->input('last_move');
        $isCheckmate = (bool) $request->boolean('is_checkmate');

        $updates = [];

        $put = function ($column, $value) use (&$updates, $columns) {
            if (isset($columns[$column])) {
                $updates[$column] = $value;
            }
        };

        $put('status', 'completed');
        $put('game_status', 'completed');
        $put('state', 'completed');

        $put('completed', 1);
        $put('is_completed', 1);
        $put('finished', 1);
        $put('is_finished', 1);

        $put('active', 0);
        $put('is_active', 0);

        $put('completed_at', now());
        $put('finished_at', now());
        $put('ended_at', now());

        $put('result', $result);
        $put('outcome', $result);

        $put('termination', $termination);
        $put('end_reason', $termination);
        $put('result_reason', $termination);

        $put('winner', $winner);
        $put('winner_color', $winner);

        $put('final_fen', $finalFen);
        $put('fen', $finalFen);

        $put('last_move', $lastMove);
        $put('last_move_san', $lastMove);

        $put('checkmate', $isCheckmate ? 1 : 0);
        $put('is_checkmate', $isCheckmate ? 1 : 0);

        $gameRow = \Illuminate\Support\Facades\DB::table('games')
            ->where('id', $gameId)
            ->first();

        if (isset($columns['winner_id']) && $gameRow && $winner) {
            $whiteColumns = [
                'white_player_id',
                'white_user_id',
                'player_white_id',
            ];
            $blackColumns = [
                'black_player_id',
                'black_user_id',
                'player_black_id',
            ];

            $candidateColumns = (
                $winner === 'white'
                ? $whiteColumns
                : $blackColumns
            );

            foreach ($candidateColumns as $column) {
                if (
                    isset($columns[$column]) &&
                    isset($gameRow->{$column}) &&
                    $gameRow->{$column}
                ) {
                    $updates['winner_id'] = $gameRow->{$column};
                    break;
                }
            }
        }

        if (isset($columns['updated_at'])) {
            $updates['updated_at'] = now();
        }

        if (!$updates) {
            return response()->json([
                'ok' => false,
                'message' => (
                    'No supported completion columns were found '
                    . 'in the games table.'
                ),
            ], 422);
        }

        \Illuminate\Support\Facades\DB::table('games')
            ->where('id', $gameId)
            ->update($updates);

        return response()->json([
            'ok' => true,
            'game_id' => $gameId,
            'completed' => true,
            'result' => $result,
            'termination' => $termination,
            'winner' => $winner,
            'last_move' => $lastMove,
            'is_checkmate' => $isCheckmate,
            'updates' => $updates,
        ]);
    }
)->middleware('auth:sanctum');

// REGISSION_DASHBOARD_DEVICE_STATUS_FINAL
Route::get(
    '/device/dashboard-status',
    \App\Http\Controllers\Api\DashboardDeviceStatusController::class
);

// BEGIN REGISSION_PROFILE_AVATAR_UPLOAD_ROUTE
\Illuminate\Support\Facades\Route::post(
    '/profile/avatar-upload',
    [
        \App\Http\Controllers\Api\ProfileAvatarController::class,
        'store',
    ]
)->middleware('auth:sanctum');
// END REGISSION_PROFILE_AVATAR_UPLOAD_ROUTE
