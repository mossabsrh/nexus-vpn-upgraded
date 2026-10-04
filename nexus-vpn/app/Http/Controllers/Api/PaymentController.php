<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function createCheckout(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => ['required_without:plan_slug', 'integer', 'exists:plans,id'],
            'plan_slug' => ['required_without:plan_id', 'string', 'exists:plans,slug'],
            'billing_period' => ['nullable', 'in:monthly,yearly'],
            'amount' => ['nullable', 'integer', 'min:1'],
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        $plan = $request->filled('plan_id')
            ? Plan::query()->findOrFail($request->input('plan_id'))
            : Plan::query()->where('slug', $request->input('plan_slug'))->firstOrFail();
        $billingPeriod = $request->input('billing_period', 'monthly');
        $amount = (int) ($request->input('amount') ?? match ($billingPeriod) {
            'yearly' => $plan->yearly_total ?? $plan->yearly_price ?? $plan->monthly_price,
            default => $plan->monthly_price ?? $plan->yearly_price ?? 0,
        });

        if ($amount <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'The selected plan does not have a valid amount.',
            ], 422);
        }

        $paymentId = 'pay_' . Str::uuid()->toString();
        $metadata = [
            'payment_id' => $paymentId,
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'billing_period' => $billingPeriod,
        ];

        $payload = [
            'amount' => $amount,
            'currency' => 'dzd',
            'success_url' => url('/payment/success?payment_id=' . $paymentId),
            'failure_url' => url('/payment/failed?payment_id=' . $paymentId),
            'chargily_pay_fees_allocation' => 'merchant',
            'description' => $plan->name . ' - ' . $billingPeriod . ' subscription',
            'locale' => 'fr',
            'metadata' => $metadata,
        ];

        $secretKey = (string) config('services.chargily.secret_key');

        if ($secretKey === '') {
            return response()->json([
                'success' => false,
                'message' => 'Chargily secret key is not configured.',
            ], 500);
        }

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $secretKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->acceptJson()->post($this->baseUrl() . '/checkouts', $payload);

        $body = $response->json() ?? [];

        if ($response->failed()) {
            Payment::query()->create([
                'user_id' => $user->id,
                'amount' => $amount,
                'currency' => 'DZD',
                'status' => 'failed',
                'provider' => 'chargily',
                'provider_response' => $body,
                'metadata' => $metadata,
            ]);

            return response()->json([
                'success' => false,
                'message' => $body['message'] ?? 'Chargily checkout could not be created.',
            ], $response->status());
        }

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'amount' => $amount,
            'currency' => 'DZD',
            'status' => 'pending',
            'provider' => 'chargily',
            'provider_reference' => $body['id'] ?? null,
            'provider_response' => $body,
            'metadata' => $metadata,
        ]);

        return response()->json([
            'success' => true,
            'status' => $body['status'] ?? 'pending',
            'checkout_id' => $body['id'] ?? null,
            'checkout_url' => $body['checkout_url'] ?? null,
            'payment_id' => $payment->id,
            'message' => 'Checkout created successfully.',
        ]);
    }

    public function verify(Request $request, string $checkoutId): JsonResponse
    {
        $secretKey = (string) config('services.chargily.secret_key');

        if ($secretKey === '') {
            return response()->json([
                'success' => false,
                'message' => 'Chargily secret key is not configured.',
            ], 500);
        }

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $secretKey,
            'Accept' => 'application/json',
        ])->acceptJson()->get($this->baseUrl() . '/checkouts/' . $checkoutId);

        $body = $response->json() ?? [];

        if ($response->failed()) {
            return response()->json([
                'success' => false,
                'message' => $body['message'] ?? 'Unable to verify checkout status.',
            ], $response->status());
        }

        $payment = Payment::query()->where('provider_reference', $checkoutId)->first();

        if ($payment && ($body['status'] ?? null) === 'paid') {
            $payment->update([
                'status' => 'succeeded',
                'provider_response' => array_merge((array) $payment->provider_response, $body),
                'paid_at' => now(),
            ]);

            $this->activateSubscription($payment);
        }

        return response()->json([
            'success' => true,
            'status' => $body['status'] ?? null,
            'checkout' => $body,
        ]);
    }

    public function cancelSubscription(Request $request, ?Subscription $subscription = null): JsonResponse
    {
        $target = $subscription ?? $request->user()?->subscriptions()->latest()->first();

        if (! $target) {
            return response()->json([
                'success' => false,
                'message' => 'No active subscription found.',
            ], 404);
        }

        if ($request->user()?->id !== $target->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot cancel another user\'s subscription.',
            ], 403);
        }

        $target->update([
            'status' => 'canceled',
            'current_period_end' => now(),
        ]);

        return response()->json([
            'success' => true,
            'subscription' => $target->fresh(),
            'message' => 'Subscription canceled successfully.',
        ]);
    }

    public function startTrial(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:plans,slug'],
        ]);

        $plan = Plan::query()->where('slug', $validated['plan_slug'])->firstOrFail();

        if ($plan->slug === 'team') {
            return response()->json([
                'success' => false,
                'message' => 'A trial is not available for the Team plan.',
            ], 422);
        }

        $user = $request->user();

        if ($user->subscriptions()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This account already has a subscription.',
            ], 409);
        }

        $trialEndsAt = now()->addDays(7);
        $subscription = $user->subscriptions()->create([
            'plan_id' => $plan->id,
            'seats' => 1,
            'billing_period' => 'monthly',
            'status' => 'trialing',
            'trial_ends_at' => $trialEndsAt,
            'current_period_end' => $trialEndsAt,
        ]);

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'planId' => $plan->slug,
                'subscriptionStatus' => 'trialing',
                'lastPlanId' => $plan->slug,
            ],
            'subscription' => [
                'id' => $subscription->id,
                'status' => $subscription->status,
                'planId' => $plan->slug,
                'trial_ends_at' => $subscription->trial_ends_at,
            ],
        ]);
    }

    public function webhook(Request $request): JsonResponse
    {
        $signature = (string) $request->header('signature', '');
        $rawBody = $request->getContent();

        if ($signature === '') {
            return response()->json(['message' => 'Missing signature'], 400);
        }

        if (! $this->verifySignature($rawBody, $signature)) {
            return response()->json(['message' => 'Invalid signature'], 403);
        }

        $payload = json_decode($rawBody, true);

        if (! is_array($payload)) {
            return response()->json(['message' => 'Invalid payload'], 400);
        }

        $eventData = $payload['data'] ?? $payload['checkout'] ?? $payload;
        $checkoutId = $eventData['id'] ?? null;
        $status = $eventData['status'] ?? null;

        if (($payload['type'] ?? null) === 'checkout.paid' || $status === 'paid') {
            $payment = $checkoutId
                ? Payment::query()->where('provider_reference', $checkoutId)->first()
                : null;

            if ($payment) {
                $payment->update([
                    'status' => 'succeeded',
                    'provider_response' => array_merge((array) $payment->provider_response, $eventData),
                    'paid_at' => now(),
                ]);

                $this->activateSubscription($payment);
            }
        }

        return response()->json(['status' => 'success']);
    }

    private function verifySignature(string $rawBody, string $signature): bool
    {
        $secretKey = (string) config('services.chargily.secret_key');

        if ($secretKey === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $rawBody, $secretKey);

        return hash_equals($expected, $signature);
    }

    private function baseUrl(): string
    {
        return config('services.chargily.mode', 'test') === 'live'
            ? 'https://pay.chargily.net/api/v2'
            : 'https://pay.chargily.net/test/api/v2';
    }

    private function activateSubscription(Payment $payment): void
    {
        $metadata = $payment->metadata ?? [];
        $userId = $metadata['user_id'] ?? $payment->user_id;
        $planId = $metadata['plan_id'] ?? null;

        if (! $userId || ! $planId) {
            return;
        }

        $user = User::query()->find($userId);
        $plan = Plan::query()->find($planId);

        if (! $user || ! $plan) {
            return;
        }

        $subscription = $user->subscriptions()->where('plan_id', $plan->id)->first();
        $billingPeriod = $metadata['billing_period'] ?? 'monthly';

        $data = [
            'plan_id' => $plan->id,
            'billing_period' => $billingPeriod,
            'status' => 'active',
            'trial_ends_at' => null,
            'current_period_end' => $billingPeriod === 'yearly' ? now()->addYear() : now()->addMonth(),
        ];

        if ($subscription) {
            $subscription->update($data);

            return;
        }

        $user->subscriptions()->create([
            'plan_id' => $plan->id,
            'seats' => 1,
            'billing_period' => $billingPeriod,
            'status' => 'active',
            'current_period_end' => now()->addMonth(),
        ]);
    }
}
