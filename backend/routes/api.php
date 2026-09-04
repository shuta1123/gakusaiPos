<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API ルート
|--------------------------------------------------------------------------
|
| 認証方針:
|  客用モバイルオーダー(/order)は要件から削除されたため、
|  ログイン以外の全 API はスタッフ認証（共通パスワード由来の Bearer トークン）で保護する。
|
*/

// --- 認証（ログインのみ公開）---
Route::post('/auth/login', [AuthController::class, 'login']);

// --- スタッフ用（要認証）---
Route::middleware('staff.auth')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // 商品
    Route::get('/products', [ProductController::class, 'index']);
    Route::patch('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');

    // 注文（静的セグメントのルートは {order} ワイルドカードより先に登録する）
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/next-number', [OrderController::class, 'nextNumberEndpoint']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show'])->whereNumber('order');
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus'])->whereNumber('order');
    Route::delete('/orders/{order}', [OrderController::class, 'destroy'])->whereNumber('order');
});
