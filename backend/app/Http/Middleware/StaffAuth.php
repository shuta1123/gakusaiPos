<?php

namespace App\Http\Middleware;

use App\Support\StaffToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! StaffToken::verify($request->bearerToken())) {
            return response()->json(['message' => '認証が必要です'], 401);
        }

        return $next($request);
    }
}
