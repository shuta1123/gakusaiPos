<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthApiTest extends TestCase
{
    public function test_正しいパスワードでトークンが返る(): void
    {
        config(['pos.staff_password' => 'test-pass']);

        $this->postJson('/api/auth/login', ['password' => 'test-pass'])
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_誤ったパスワードは401(): void
    {
        config(['pos.staff_password' => 'test-pass']);

        $this->postJson('/api/auth/login', ['password' => 'wrong'])
            ->assertUnauthorized();
    }
}
