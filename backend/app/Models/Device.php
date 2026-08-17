<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Device extends Model
{
    protected $fillable = [
        'name',
        'token_hash',
        'active_game_id',
        'last_seen_at',
        'latency_ms',
        'enabled',
    ];

    protected $hidden = [
        'token_hash',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
        'latency_ms' => 'integer',
        'enabled' => 'boolean',
    ];

    public function activeGame(): BelongsTo
    {
        return $this->belongsTo(Game::class, 'active_game_id');
    }

    public function isOnline(): bool
    {
        return $this->last_seen_at !== null
            && $this->last_seen_at->greaterThan(now()->subMinutes(2));
    }
}