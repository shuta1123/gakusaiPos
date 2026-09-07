<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            ['name' => '焼きそば', 'price' => 300],
            ['name' => '焼きそばパン', 'price' => 350],
            ['name' => 'フランクフルト', 'price' => 200],
            ['name' => 'ホットドッグ', 'price' => 250],
            ['name' => 'わらび餅', 'price' => 400],
        ];

        // firstOrCreate で「無ければ作る」。既存商品の is_sold_out や price は
        // 運用中の状態を尊重して上書きしない（再起動時のリセット防止）。
        foreach ($products as $product) {
            Product::firstOrCreate(
                ['name' => $product['name']],
                ['price' => $product['price'], 'is_sold_out' => false],
            );
        }
    }
}
