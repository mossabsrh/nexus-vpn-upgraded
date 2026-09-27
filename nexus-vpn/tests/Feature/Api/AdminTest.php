<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_users_cannot_access_admin_api(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/users')
            ->assertForbidden();
    }

    public function test_admin_can_manage_users_and_plans(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create();

        $this->actingAs($admin)
            ->patchJson("/api/admin/users/{$user->id}", [
                'name' => 'Managed User',
                'role' => 'admin',
            ])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/plans', [
                'slug' => 'starter',
                'name' => 'Starter',
                'description' => 'A starter offer.',
                'monthly_price' => 500,
                'yearly_price' => 250,
                'yearly_total' => 3000,
                'currency' => 'DZD',
                'features' => ['Basic access'],
                'popular' => false,
                'cta' => 'Start now',
            ])
            ->assertCreated()
            ->assertJsonPath('plan.slug', 'starter');
    }
}
