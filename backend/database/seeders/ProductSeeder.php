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
        ];

        foreach ($products as $product) {
            Product::updateOrCreate(
                ['name' => $product['name']],
                ['price' => $product['price'], 'is_sold_out' => false],
            );
        }
    }
}
