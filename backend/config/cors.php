<?php

// API のCORS設定。
// 本番(pos.shutay.com)はフロントとAPIが同一オリジンのためCORSは基本不要だが、
// Macフォールバック等でフロント(:3001)とAPI(:8001)がポート違い＝別オリジンになる
// ケースに備え、許可オリジンを env で指定できるようにする（既定は全許可）。
$origins = array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '*'))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins ?: ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    // Bearerトークン方式でCookie認証は使わないため false。
    'supports_credentials' => false,
];
