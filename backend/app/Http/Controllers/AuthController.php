<?php

namespace App\Http\Controllers;

use App\Support\StaffToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * 共通パスワードでログインし、無期限トークンを返す。
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! StaffToken::verifyPassword($validated['password'])) {
            return response()->json(['message' => 'パスワードが違います'], 401);
        }

        return response()->json([
            'token' => StaffToken::current(),
        ]);
    }

    /**
     * ログアウト。ステートレスなトークン方式のためサーバー側の処理は不要。
     * クライアントは保持しているトークンを破棄する。
     */
    public function logout(Request $request): JsonResponse
    {
        return response()->json(['message' => 'ログアウトしました']);
    }
}
