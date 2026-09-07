<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counters', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->unsignedInteger('value')->default(0);
            $table->timestamps();
        });

        // 会計1/会計2 で共有する採番シーケンス（末尾2桁 XX の直近位置）。
        DB::table('counters')->insert([
            'key' => 'order_seq',
            'value' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('counters');
    }
};
