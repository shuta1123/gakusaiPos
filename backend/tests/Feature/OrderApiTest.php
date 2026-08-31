<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Support\StaffToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\ProductSeeder::class);
    }

    public function test_注文を作成できる(): void
    {
        $product = Product::first();

        $response = $this->postJson('/api/orders', [
            'source' => 'モバイル',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonFragment(['source' => 'モバイル', 'status' => '注文完了'])
            ->assertJsonPath('number', 700);

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
    }

    public function test_番号は帯ごとに循環する(): void
    {
        $product = Product::first();

        // 会計1帯: 100 から始まる
        $first = Order::create(['number' => 100, 'source' => '会計1', 'status' => '注文完了']);
        $this->assertSame(101, app(\App\Http\Controllers\OrderController::class)->nextNumber('会計1'));

        // 末尾99の次は00に戻る（会計1なら 100）
        Order::create(['number' => 199, 'source' => '会計1', 'status' => '注文完了']);
        $this->assertSame(100, app(\App\Http\Controllers\OrderController::class)->nextNumber('会計1'));
    }

    public function test_ステータス更新には認証が必要(): void
    {
        $order = Order::create(['number' => 100, 'source' => '会計1', 'status' => '注文完了']);

        $this->patchJson("/api/orders/{$order->id}/status", ['status' => '会計完了'])
            ->assertUnauthorized();

        $this->withToken(StaffToken::current())
            ->patchJson("/api/orders/{$order->id}/status", ['status' => '会計完了'])
            ->assertOk()
            ->assertJsonFragment(['status' => '会計完了']);
    }
}
