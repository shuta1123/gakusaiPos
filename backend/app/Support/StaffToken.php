<?php

namespace App\Support;

/**
 * 共通パスワードからステートレスな認証トークンを導出するヘルパー。
 * ユーザーテーブルを持たず、共通シークレット方式で「無期限セッション」を実現する。
 */
class StaffToken
{
    /** 現在の共通パスワードに対応するトークンを返す。 */
    public static function current(): string
    {
        return hash('sha256', 'gakusai-pos|'.config('pos.staff_password'));
    }

    /** 送られてきたトークンが有効かをタイミングセーフに検証する。 */
    public static function verify(?string $token): bool
    {
        if ($token === null || $token === '') {
            return false;
        }

        return hash_equals(self::current(), $token);
    }

    /** 平文パスワードが共通パスワードと一致するかを検証する。 */
    public static function verifyPassword(?string $password): bool
    {
        if ($password === null || $password === '') {
            return false;
        }

        return hash_equals((string) config('pos.staff_password'), $password);
    }
}
