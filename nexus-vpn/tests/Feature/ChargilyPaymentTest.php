<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChargilyPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_a_chargily_checkout(): void
    {
        config([
            'services.chargily.mode' => 'test',
            'services.chargily.secret_key' => 'test_sk_demo_secret',
        ]);

        Http::fake([
            'https://pay.chargily.net/test/api/v2/checkouts' => Http::response([
                'id' => 'chk_demo_123',
                'status' => 'pending',
                'checkout_url' => 'https://pay.chargily.dz/test/checkouts/chk_demo_123/pay',
            ], 201),
        ]);

        $user = User::factory()->create();
        $plan = Plan::create([
            'slug' => 'starter',
            'name' => 'Starter',
            'description' => 'Starter plan',
            'monthly_price' => 2500,
            'yearly_price' => 25000,
            'yearly_total' => 30000,
            'currency' => 'DZD',
            'features' => ['Unlimited devices'],
            'popular' => false,
            'cta' => 'Start now',
        ]);

        $response = $this->actingAs($user)->postJson('/api/checkout', [
            'plan_id' => $plan->id,
            'billing_period' => 'monthly',
        ]);

        $response->assertOk()
            ->assertJsonPath('checkout_url', 'https://pay.chargily.dz/test/checkouts/chk_demo_123/pay')
            ->assertJsonPath('status', 'pending');

        Http::assertSent(function ($request) {
            return $request->hasHeader('Authorization', 'Bearer test_sk_demo_secret')
                && $request['amount'] === 2500
                && $request['currency'] === 'dzd';
        });
    }

    public function test_database_seeders_are_idempotent_when_run_twice(): void
    {
        $this->artisan('db:seed')->assertSuccessful();
        $this->artisan('db:seed')->assertSuccessful();

        $this->assertDatabaseCount('plans', 3);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_payment_success_and_failure_pages_render(): void
    {
        $this->get('/payment/success?payment_id=pay_test_123')
            ->assertOk()
            ->assertSee('Payment successful')
            ->assertSee('pay_test_123');

        $this->get('/payment/failed?payment_id=pay_test_456')
            ->assertOk()
            ->assertSee('Payment failed')
            ->assertSee('pay_test_456');
    }

    public function test_user_can_cancel_their_subscription(): void
    {
        $user = User::factory()->create();
        $plan = Plan::create([
            'slug' => 'cancel-test',
            'name' => 'Cancel Test',
            'description' => 'Test plan',
            'monthly_price' => 1500,
            'yearly_price' => 15000,
            'yearly_total' => 18000,
            'currency' => 'DZD',
            'features' => ['Cancel test'],
            'popular' => false,
            'cta' => 'Start now',
        ]);

        $subscription = $user->subscriptions()->create([
            'plan_id' => $plan->id,
            'seats' => 1,
            'billing_period' => 'monthly',
            'status' => 'active',
            'current_period_end' => now()->addMonth(),
        ]);

        $response = $this->actingAs($user)->postJson('/api/subscriptions/cancel');

        $response->assertOk()
            ->assertJsonPath('subscription.id', $subscription->id)
            ->assertJsonPath('subscription.status', 'canceled');

        $this->assertDatabaseHas('subscriptions', [
            'id' => $subscription->id,
            'status' => 'canceled',
        ]);
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        config([
            'services.chargily.secret_key' => 'test_sk_demo_secret',
        ]);

        $payload = json_encode([
            'type' => 'checkout.paid',
            'data' => [
                'id' => 'chk_invalid',
                'status' => 'paid',
                'metadata' => ['payment_id' => 'pm_1'],
            ],
        ]);

        $response = $this->postJson('/api/webhooks/chargily', json_decode($payload, true), [
            'signature' => 'invalid-signature',
            'Content-Type' => 'application/json',
        ]);

        $response->assertStatus(403);
    }
}
