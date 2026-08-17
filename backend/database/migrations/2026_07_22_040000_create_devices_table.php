<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('REGISSION Raspberry Pi');
            $table->string('token_hash', 64)->unique();
            $table->foreignId('active_game_id')
                ->nullable()
                ->constrained('games')
                ->nullOnDelete();
            $table->timestamp('last_seen_at')->nullable();
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};

