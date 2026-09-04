<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            // 注文番号（例: 142 = 会計1帯の末尾42）。source帯 + 末尾2桁00〜99。
            $table->unsignedSmallInteger('number');
            $table->enum('source', ['会計1', '会計2', 'モバイル']);
            $table->enum('status', ['注文完了', '会計完了', '準備完了', '受け渡し完了'])
                ->default('注文完了');
            $table->timestamps();

            $table->index('status');
            $table->index(['source', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
