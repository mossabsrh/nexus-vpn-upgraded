<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'plan_slug' => ['required', 'string', 'exists:plans,slug'],
        ]);

        try {
            $user = DB::transaction(function () use ($request) {
                $user = User::create([
                    'name' => $request->name,
                    'email' => $request->email,
                    'password' => Hash::make($request->password),
                ]);

                if ($request->input('plan_slug') !== 'team') {
                    $plan = Plan::query()->where('slug', $request->input('plan_slug'))->firstOrFail();
                    $trialEndsAt = now()->addDays(7);

                    $user->subscriptions()->create([
                        'plan_id' => $plan->id,
                        'seats' => 1,
                        'billing_period' => 'monthly',
                        'status' => 'trialing',
                        'trial_ends_at' => $trialEndsAt,
                        'current_period_end' => $trialEndsAt,
                    ]);
                }

                return $user;
            });

            Auth::login($user);
            $request->session()->regenerate();

            return response()->json([
                'success' => true,
                'user' => $this->userPayload($user),
                'message' => 'User registered successfully',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Registration failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Login a user.
     */
    public function login(Request $request): JsonResponse
    {
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid email or password.',
            ], 401);
        }

        $request->session()->regenerate();
        $user = $request->user();

        return response()->json([
            'success' => true,
            'user' => $this->userPayload($user),
            'message' => 'Logged in successfully',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    private function userPayload(User $user): array
    {
        $subscription = $user->subscriptions()
            ->with('plan')
            ->whereIn('status', ['active', 'trialing'])
            ->latest()
            ->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'planId' => $subscription?->plan?->slug,
        ];
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }
}
