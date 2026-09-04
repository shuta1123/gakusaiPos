<?php

// API のCORS設定。
// 本番(pos.shutay.com)はフロントとAPIが同一オリジンのためCORSは発生しない（許可リストは空でよい）。
// Macフォールバック等でフロント(:3001)とAPI(:8001)がポート違い＝別オリジンになる場合のみ、
// CORS_ALLOWED_ORIGINS に許可オリジンをカンマ区切りで明示する（未設定なら許可なし＝安全側）。
$origins = array_values(array_filter(
    array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))),
    static fn ($o) => $o !== '',
));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    // 未設定時は空（全許可のフォールバックはしない）。
    'allowed_origins' => $origins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 600,
    // Bearerトークン方式でCookie認証は使わないため false。
    'supports_credentials' => false,
];
