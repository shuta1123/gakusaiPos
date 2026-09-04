<?php

namespace App\Http\Controllers;

use App\Events\ProductUpdated;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * 商品一覧を返す。
     */
    public function index(): JsonResponse
    {
        return response()->json(Product::orderBy('id')->get());
    }

    /**
     * 売り切れ設定などの更新。
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'is_sold_out' => ['sometimes', 'boolean'],
            'price' => ['sometimes', 'integer', 'min:0'],
        ]);

        $product->update($validated);

        broadcast(new ProductUpdated($product))->toOthers();

        return response()->json($product);
    }
}
