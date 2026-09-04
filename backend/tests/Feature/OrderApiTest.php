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

    public function test_未認証では注文を作成できない(): void
    {
        $product = Product::first();

        $this->postJson('/api/orders', [
            'source' => '会計1',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertUnauthorized();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_注文を作成できる(): void
    {
        $product = Product::first();

        $response = $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonFragment(['source' => '会計1', 'status' => '注文完了'])
            ->assertJsonPath('number', 100);

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        // 単価スナップショットが保存される
        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'quantity' => 2,
            'unit_price' => $product->price,
        ]);
    }

    public function test_会計完了ステータスで原子的に作成できる(): void
    {
        $product = Product::first();

        $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'status' => '会計完了',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertCreated()
            ->assertJsonFragment(['status' => '会計完了', 'number' => 100]);
    }

    public function test_不正なステータスは拒否される(): void
    {
        $product = Product::first();

        $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'status' => '存在しない',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    public function test_番号は帯ごとに循環する(): void
    {
        // 会計1帯: 100 から始まる
        Order::create(['number' => 100, 'source' => '会計1', 'status' => '注文完了']);
        $this->assertSame(101, app(\App\Http\Controllers\OrderController::class)->nextNumber('会計1'));

        // 末尾99の次は00に戻る（会計1なら 100）
        Order::create(['number' => 199, 'source' => '会計1', 'status' => '注文完了']);
        $this->assertSame(100, app(\App\Http\Controllers\OrderController::class)->nextNumber('会計1'));

        // 会計2帯は 200 から
        $this->assertSame(200, app(\App\Http\Controllers\OrderController::class)->nextNumber('会計2'));
    }

    public function test_売り切れ商品は注文できない(): void
    {
        $product = Product::first();
        $product->update(['is_sold_out' => true]);

        $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ])->assertStatus(422);

        $this->assertDatabaseCount('orders', 0);
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
