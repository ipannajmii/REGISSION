<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('moves', function (Blueprint $table) {
            $table->string('uci', 10)->nullable()->after('notation');
            $table->string('fen_before', 255)->nullable()->after('uci');
            $table->string('fen', 255)->nullable()->after('fen_before');
            $table->unsignedInteger('ply_before')->nullable()->after('fen');
            $table->string('event_id', 64)->nullable()->after('ply_before');
            $table->string('source', 40)->nullable()->after('event_id');
            $table->unsignedInteger('latency_ms')->nullable()->after('source');

            // One physical move event may be POSTed more than once because of
            // retries or concurrent AUTO/manual requests, but MySQL stores it once.
            $table->unique(
                ['game_id', 'event_id'],
                'moves_game_event_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('moves', function (Blueprint $table) {
            $table->dropUnique('moves_game_event_unique');
            $table->dropColumn([
                'uci',
                'fen_before',
                'fen',
                'ply_before',
                'event_id',
                'source',
                'latency_ms',
            ]);
        });
    }
};
