<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Support\StaffToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StatsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\ProductSeeder::class);
    }

    private function token(): string
    {
        return StaffToken::current();
    }

    public function test_集計には認証が必要(): void
    {
        $this->getJson('/api/stats')->assertUnauthorized();
    }

    public function test_売上集計を返す(): void
    {
        [$yakisoba, $warabi] = [
            Product::where('name', '焼きそば')->first(),   // 300
            Product::where('name', 'わらび餅')->first(),   // 400
        ];

        $create = fn (string $source, array $items, int $discount = 0) => $this->withToken($this->token())
            ->postJson('/api/orders', [
                'source' => $source,
                'status' => '会計完了',
                'discount' => $discount,
                'items' => $items,
            ])->json();

        // 会計1: 焼きそば×2 = 600
        $create('会計1', [['product_id' => $yakisoba->id, 'quantity' => 2]]);
        // 会計2: わらび餅×1 = 400、割引100 → net 300
        $order2 = $create('会計2', [['product_id' => $warabi->id, 'quantity' => 1]], 100);
        // キャンセルされた注文は集計対象外
        $cancel = $create('会計1', [['product_id' => $yakisoba->id, 'quantity' => 1]]);
        $this->withToken($this->token())->deleteJson("/api/orders/{$cancel['id']}");

        $res = $this->withToken($this->token())->getJson('/api/stats')->assertOk();

        // total_sales = 600 + (400-100) = 900（キャンセル除外）
        $res->assertJsonPath('total_sales', 900)
            ->assertJsonPath('order_count', 2)
            ->assertJsonPath('total_discount', 100)
            ->assertJsonPath('by_source.会計1.count', 1)
            ->assertJsonPath('by_source.会計1.sales', 600)
            ->assertJsonPath('by_source.会計2.count', 1)
            ->assertJsonPath('by_source.会計2.sales', 300);

        // by_product: 焼きそば 2個/600、わらび餅 1個/400（販売数順）
        $byProduct = collect($res->json('by_product'))->keyBy('name');
        $this->assertSame(2, $byProduct['焼きそば']['units']);
        $this->assertSame(600, $byProduct['焼きそば']['sales']);
        $this->assertSame(1, $byProduct['わらび餅']['units']);
        $this->assertSame(400, $byProduct['わらび餅']['sales']);
    }
}
