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

    public function test_XXは会計1会計2で共有の連番になる(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        // XX(1〜50) はレジをまたいで共有。先頭はレジ、末尾2桁は共有で進む。
        // 例: 102 → 203 → 204 → 105（ここでは 101 → 202 → 203 → 104）。
        $create('会計1')->assertJsonPath('number', 101); // XX=1
        $create('会計2')->assertJsonPath('number', 202); // XX=2（共有で進む）
        $create('会計2')->assertJsonPath('number', 203); // XX=3
        $create('会計1')->assertJsonPath('number', 104); // XX=4
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
        \App\Models\Counter::where('key', 'order_seq')->update(['value' => 0]);
        $create('会計2')->assertJsonPath('number', 202); // XX=1 は使用中→XX=2（共有）

        // 101 を受け渡し完了にすると XX=1 が解放され、再利用される（会計2帯なら201）
        Order::where('number', 101)->update(['status' => '受け渡し完了']);
        \App\Models\Counter::where('key', 'order_seq')->update(['value' => 0]);
        $create('会計2')->assertJsonPath('number', 201); // XX=1 再利用
    }

    public function test_1から50が全て使用中なら発番できない(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        // XX=1〜50 を使用中(注文完了)で埋める（共有なのでどのレジでも満杯）
        for ($xx = 1; $xx <= 50; $xx++) {
            Order::create(['number' => 100 + $xx, 'source' => '会計1', 'status' => '注文完了']);
        }

        // 共有カウンタが満杯 → 会計1・会計2いずれも 409
        $create('会計1')->assertStatus(409);
        $create('会計2')->assertStatus(409);
        $this->assertDatabaseCount('orders', 50); // ロールバックで増えない
    }

    public function test_割引を指定して注文できる(): void
    {
        $product = Product::first(); // 焼きそば 300

        $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'status' => '会計完了',
            'discount' => 100,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])
            ->assertCreated()
            ->assertJsonFragment(['discount' => 100]);
    }

    public function test_割引は小計を超えない(): void
    {
        $product = Product::first(); // 300

        // 小計300に対し割引1000を指定 → 300に丸められる
        $this->withToken(StaffToken::current())->postJson('/api/orders', [
            'source' => '会計1',
            'status' => '会計完了',
            'discount' => 1000,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertCreated()
            ->assertJsonFragment(['discount' => 300]);
    }

    public function test_呼び出し中を経由して受け渡し完了にできる(): void
    {
        $order = Order::create(['number' => 101, 'source' => '会計1', 'status' => '準備完了']);
        $token = StaffToken::current();

        $this->withToken($token)->patchJson("/api/orders/{$order->id}/status", ['status' => '呼び出し中'])
            ->assertOk()->assertJsonFragment(['status' => '呼び出し中']);

        $this->withToken($token)->patchJson("/api/orders/{$order->id}/status", ['status' => '受け渡し完了'])
            ->assertOk()->assertJsonFragment(['status' => '受け渡し完了']);
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

    public function test_キャンセルは論理削除で番号を解放し再利用できる(): void
    {
        $product = Product::first();
        $create = fn (string $source) => $this->withToken(StaffToken::current())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ]);

        $orderId = $create('会計1')->assertJsonPath('number', 101)->json('id');

        // キャンセル（DELETE）→ 削除ではなく status=キャンセル で残る
        $this->withToken(StaffToken::current())
            ->deleteJson("/api/orders/{$orderId}")
            ->assertOk();

        $this->assertDatabaseHas('orders', ['id' => $orderId, 'status' => 'キャンセル']);
        $this->assertDatabaseCount('orders', 1); // 物理削除されていない

        // 番号 101 は解放され、再利用できる
        \App\Models\Counter::where('key', 'order_seq')->update(['value' => 0]);
        $create('会計1')->assertJsonPath('number', 101);
    }

    public function test_キャンセル履歴を絞り込み取得できる(): void
    {
        Order::create(['number' => 101, 'source' => '会計1', 'status' => 'キャンセル']);
        Order::create(['number' => 102, 'source' => '会計1', 'status' => '会計完了']);

        $this->withToken(StaffToken::current())
            ->getJson('/api/orders?status='.rawurlencode('キャンセル'))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['number' => 101, 'status' => 'キャンセル']);
    }

    public function test_キャンセル済みはステータスを戻せない(): void
    {
        $order = Order::create(['number' => 101, 'source' => '会計1', 'status' => 'キャンセル']);

        $this->withToken(StaffToken::current())
            ->patchJson("/api/orders/{$order->id}/status", ['status' => '準備完了'])
            ->assertStatus(422);
    }

    public function test_受け渡し完了からは戻せない(): void
    {
        $order = Order::create(['number' => 101, 'source' => '会計1', 'status' => '受け渡し完了']);

        $this->withToken(StaffToken::current())
            ->patchJson("/api/orders/{$order->id}/status", ['status' => '準備完了'])
            ->assertStatus(422);

        $this->assertSame('受け渡し完了', $order->fresh()->status);
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
