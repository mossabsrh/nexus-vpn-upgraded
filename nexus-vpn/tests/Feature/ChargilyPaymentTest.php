<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Payment;
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
            'plan_slug' => $plan->slug,
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

    public function test_registration_starts_a_trial_for_the_selected_plan(): void
    {
        $plan = Plan::create([
            'slug' => 'signup-trial',
            'name' => 'Signup Trial',
            'description' => 'Signup trial plan',
            'monthly_price' => 1500,
            'yearly_price' => 15000,
            'yearly_total' => 18000,
            'currency' => 'DZD',
            'features' => ['Signup trial'],
            'popular' => false,
            'cta' => 'Start trial',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Trial User',
            'email' => 'trial-user@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'plan_slug' => $plan->slug,
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.planId', 'signup-trial');

        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $response->json('user.id'),
            'plan_id' => $plan->id,
            'status' => 'trialing',
        ]);
    }

    public function test_payment_success_and_failure_pages_render(): void
    {
        config(['services.frontend_url' => 'https://nexus-vpn-upgraded.vercel.app']);

        $this->get('/payment/success?payment_id=pay_test_123')
            ->assertOk()
            ->assertSee('Payment successful')
            ->assertSee('pay_test_123')
            ->assertSee('href="https://nexus-vpn-upgraded.vercel.app"', false);

        $this->get('/payment/failed?payment_id=pay_test_456')
            ->assertOk()
            ->assertSee('Payment failed')
            ->assertSee('pay_test_456')
            ->assertSee('href="https://nexus-vpn-upgraded.vercel.app"', false);
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

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertJsonPath('user.planId', null)
            ->assertJsonPath('user.subscriptionStatus', 'canceled')
            ->assertJsonPath('user.lastPlanId', 'cancel-test');
    }

    public function test_paid_checkout_reactivates_a_canceled_subscription(): void
    {
        config([
            'services.chargily.mode' => 'test',
            'services.chargily.secret_key' => 'test_sk_demo_secret',
        ]);

        Http::fake([
            'https://pay.chargily.net/test/api/v2/checkouts/chk_resubscribe' => Http::response([
                'id' => 'chk_resubscribe',
                'status' => 'paid',
            ]),
        ]);

        $user = User::factory()->create();
        $plan = Plan::create([
            'slug' => 'resubscribe-test',
            'name' => 'Resubscribe Test',
            'description' => 'Resubscribe plan',
            'monthly_price' => 1500,
            'yearly_price' => 15000,
            'yearly_total' => 18000,
            'currency' => 'DZD',
            'features' => ['Resubscribe test'],
            'popular' => false,
            'cta' => 'Subscribe',
        ]);
        $subscription = $user->subscriptions()->create([
            'plan_id' => $plan->id,
            'seats' => 1,
            'billing_period' => 'yearly',
            'status' => 'canceled',
            'trial_ends_at' => now()->subDay(),
            'current_period_end' => now()->subDay(),
        ]);
        Payment::query()->create([
            'user_id' => $user->id,
            'subscription_id' => $subscription->id,
            'amount' => 18000,
            'currency' => 'DZD',
            'status' => 'pending',
            'provider' => 'chargily',
            'provider_reference' => 'chk_resubscribe',
            'metadata' => [
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'billing_period' => 'yearly',
            ],
        ]);

        $this->actingAs($user)
            ->getJson('/api/checkout/chk_resubscribe/verify')
            ->assertOk()
            ->assertJsonPath('status', 'paid');

        $subscription->refresh();
        $this->assertSame('active', $subscription->status);
        $this->assertNull($subscription->trial_ends_at);
        $this->assertSame('yearly', $subscription->billing_period);
        $this->assertTrue($subscription->current_period_end->isFuture());
    }

    public function test_user_can_start_a_seven_day_trial_once(): void
    {
        $user = User::factory()->create();
        $plan = Plan::create([
            'slug' => 'trial-test',
            'name' => 'Trial Test',
            'description' => 'Trial plan',
            'monthly_price' => 1500,
            'yearly_price' => 15000,
            'yearly_total' => 18000,
            'currency' => 'DZD',
            'features' => ['Trial test'],
            'popular' => false,
            'cta' => 'Start trial',
        ]);

        $response = $this->actingAs($user)->postJson('/api/subscriptions/trial', [
            'plan_slug' => $plan->slug,
        ]);

        $response->assertOk()
            ->assertJsonPath('subscription.status', 'trialing')
            ->assertJsonPath('subscription.planId', 'trial-test')
            ->assertJsonPath('user.planId', 'trial-test');

        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'trialing',
        ]);

        $this->actingAs($user)->postJson('/api/subscriptions/trial', [
            'plan_slug' => $plan->slug,
        ])->assertStatus(409)
            ->assertJsonPath('user.subscriptionStatus', 'trialing')
            ->assertJsonPath('user.lastPlanId', 'trial-test');
    }

    public function test_authenticated_user_payload_includes_active_subscription_plan(): void
    {
        $user = User::factory()->create();
        $plan = Plan::create([
            'slug' => 'account-plan',
            'name' => 'Account Plan',
            'description' => 'Account plan',
            'monthly_price' => 1500,
            'yearly_price' => 15000,
            'yearly_total' => 18000,
            'currency' => 'DZD',
            'features' => ['Account test'],
            'popular' => false,
            'cta' => 'Start now',
        ]);

        $user->subscriptions()->create([
            'plan_id' => $plan->id,
            'seats' => 1,
            'billing_period' => 'monthly',
            'status' => 'active',
            'current_period_end' => now()->addMonth(),
        ]);

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.planId', 'account-plan');
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
