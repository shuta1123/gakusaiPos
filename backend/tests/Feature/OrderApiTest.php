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
            ->assertJsonPath('number', 101);

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
            ->assertJsonFragment(['status' => '会計完了', 'number' => 101]);
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

    public function test_XXは会計1会計2で独立の連番になる(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        // XX(1〜50) は会計1/会計2でそれぞれ独立。会計1=1XX / 会計2=2XX。
        // 会計1と会計2で同じ XX（例: 102 と 202）が同時に出るのは許容。
        $create('会計1')->assertJsonPath('number', 101); // 会計1 XX=1
        $create('会計2')->assertJsonPath('number', 201); // 会計2 XX=1（独立）
        $create('会計1')->assertJsonPath('number', 102); // 会計1 XX=2
        $create('会計2')->assertJsonPath('number', 202); // 会計2 XX=2
    }

    public function test_使用中の番号はスキップし受け渡し完了後は再利用する(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        $create('会計1')->assertJsonPath('number', 101); // XX=1（使用中）

        // カウンタを 0 に戻して次の候補を XX=1 にする → 使用中なのでスキップして 2
        \App\Models\Counter::where('key', 'order_seq:会計1')->update(['value' => 0]);
        $create('会計1')->assertJsonPath('number', 102); // XX=1 は使用中→XX=2

        // 101 を受け渡し完了にすると XX=1 が解放され、同じ会計1で再利用される
        Order::where('number', 101)->update(['status' => '受け渡し完了']);
        \App\Models\Counter::where('key', 'order_seq:会計1')->update(['value' => 0]);
        $create('会計1')->assertJsonPath('number', 101); // XX=1 再利用
    }

    public function test_会計1が満杯でも会計2は発番でき満杯は409(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        // 会計1 の XX=1〜50 を使用中(注文完了)で埋める
        for ($xx = 1; $xx <= 50; $xx++) {
            Order::create(['number' => 100 + $xx, 'source' => '会計1', 'status' => '注文完了']);
        }

        // 会計1 は満杯 → 409（ロールバックで注文は増えない）
        $create('会計1')->assertStatus(409);
        $this->assertDatabaseCount('orders', 50);

        // 会計2 は独立なので発番できる（201）
        $create('会計2')->assertJsonPath('number', 201);
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
