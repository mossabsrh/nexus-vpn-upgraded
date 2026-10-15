<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The starter kit's web auth/settings routes must stay unregistered (R-03):
 * they bypassed the API's rate limits, trial rules and account deletion logic.
 */
class LegacyRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_guest_routes_are_not_registered(): void
    {
        $this->post('/register', [
            'name' => 'Mallory', 'email' => 'mallory@example.com',
            'password' => 'password', 'password_confirmation' => 'password',
        ])->assertNotFound();
        $this->post('/login', ['email' => 'mallory@example.com', 'password' => 'password'])->assertNotFound();
        $this->post('/forgot-password', ['email' => 'mallory@example.com'])->assertNotFound();
        $this->post('/reset-password', ['email' => 'mallory@example.com'])->assertNotFound();

        $this->assertDatabaseMissing('users', ['email' => 'mallory@example.com']);
    }

    public function test_legacy_account_routes_are_not_registered(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/dashboard')->assertNotFound();
        $this->actingAs($user)->patch('/settings/profile', ['name' => 'Changed', 'email' => $user->email])->assertNotFound();
        $this->actingAs($user)->put('/settings/password', ['password' => 'new-password'])->assertNotFound();
        $this->actingAs($user)->delete('/settings/profile', ['password' => 'password'])->assertNotFound();

        $this->assertNotSoftDeleted($user);
        $this->assertSame($user->name, $user->fresh()->name);
    }

    public function test_backend_root_redirects_to_the_frontend(): void
    {
        config(['app.frontend_url' => 'https://frontend.example']);

        $this->get('/')->assertRedirect('https://frontend.example');
    }

    public function test_guest_api_request_without_json_accept_header_gets_401_not_a_login_redirect(): void
    {
        $this->get('/api/me')->assertUnauthorized();
    }
}
