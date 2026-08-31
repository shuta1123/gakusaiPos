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
|  - 客用モバイルオーダー(/order)が呼ぶ最小限の API のみ公開。
|  - それ以外のスタッフ操作は staff.auth（共通パスワード由来の Bearer トークン）で保護。
|
*/

// --- 認証 ---
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('staff.auth');

// --- 商品 ---
Route::get('/products', [ProductController::class, 'index']); // 客用（認証なし）
Route::patch('/products/{product}', [ProductController::class, 'update'])->middleware('staff.auth');

// --- 注文 ---
// 静的セグメントのルートは {order} ワイルドカードより先に登録する。
Route::get('/orders', [OrderController::class, 'index'])->middleware('staff.auth');
Route::get('/orders/next-number', [OrderController::class, 'nextNumberEndpoint'])->middleware('staff.auth');
Route::post('/orders', [OrderController::class, 'store']); // 客用（認証なし）
Route::get('/orders/{order}', [OrderController::class, 'show']); // 客用（認証なし）: 自分の注文の状態確認
Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus'])->middleware('staff.auth');
Route::delete('/orders/{order}', [OrderController::class, 'destroy'])->middleware('staff.auth');
