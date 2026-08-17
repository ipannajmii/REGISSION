<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Move extends Model
{
    protected $fillable = [
        'game_id',
        'notation',
        'uci',
        'fen_before',
        'fen',
        'ply_before',
        'event_id',
        'source',
        'latency_ms',
    ];

    protected $casts = [
        'ply_before' => 'integer',
        'latency_ms' => 'integer',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
