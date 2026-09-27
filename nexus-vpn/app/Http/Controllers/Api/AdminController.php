<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function users(): JsonResponse
    {
        return response()->json([
            'users' => User::query()->latest()->get(['id', 'name', 'email', 'role', 'created_at']),
        ]);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'role' => ['sometimes', Rule::in(['user', 'admin'])],
        ]);

        if ($user->is($request->user()) && ($validated['role'] ?? $user->role) !== 'admin') {
            return response()->json(['message' => 'You cannot remove your own admin access.'], 422);
        }

        $user->update($validated);

        return response()->json(['user' => $user->fresh()]);
    }

    public function plans(): JsonResponse
    {
        return response()->json(['plans' => Plan::query()->latest()->get()]);
    }

    public function storePlan(Request $request): JsonResponse
    {
        $plan = Plan::create($this->validatePlan($request));

        return response()->json(['plan' => $plan], 201);
    }

    public function updatePlan(Request $request, Plan $plan): JsonResponse
    {
        $plan->update($this->validatePlan($request, $plan));

        return response()->json(['plan' => $plan->fresh()]);
    }

    public function destroyPlan(Plan $plan): JsonResponse
    {
        if ($plan->subscriptions()->exists()) {
            return response()->json(['message' => 'Plans with subscriptions cannot be deleted.'], 409);
        }

        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }

    private function validatePlan(Request $request, ?Plan $plan = null): array
    {
        return $request->validate([
            'slug' => ['required', 'string', 'max:100', Rule::unique('plans')->ignore($plan?->id)],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'monthly_price' => ['nullable', 'integer', 'min:0'],
            'yearly_price' => ['nullable', 'integer', 'min:0'],
            'yearly_total' => ['nullable', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'max:10'],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:255'],
            'popular' => ['boolean'],
            'cta' => ['nullable', 'string', 'max:100'],
        ]);
    }
}