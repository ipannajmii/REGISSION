<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            if (!Schema::hasColumn('games', 'status')) {
                $table->string('status')->default('ongoing')->after('name');
            }

            if (!Schema::hasColumn('games', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            if (Schema::hasColumn('games', 'completed_at')) {
                $table->dropColumn('completed_at');
            }

            if (Schema::hasColumn('games', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};

