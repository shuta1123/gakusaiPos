<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Support\StaffToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\ProductSeeder::class);
    }

    public function test_商品一覧が取得できる(): void
    {
        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonCount(4)
            ->assertJsonFragment(['name' => '焼きそば', 'price' => 300]);
    }

    public function test_未認証では売り切れ設定できない(): void
    {
        $product = Product::first();

        $this->patchJson("/api/products/{$product->id}", ['is_sold_out' => true])
            ->assertUnauthorized();
    }

    public function test_認証すれば売り切れ設定できる(): void
    {
        $product = Product::first();

        $this->withToken(StaffToken::current())
            ->patchJson("/api/products/{$product->id}", ['is_sold_out' => true])
            ->assertOk()
            ->assertJsonFragment(['is_sold_out' => true]);

        $this->assertTrue($product->fresh()->is_sold_out);
    }
}
