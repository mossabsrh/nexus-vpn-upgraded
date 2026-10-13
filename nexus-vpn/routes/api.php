<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\TestimonialController;
use App\Http\Controllers\Api\AdminController;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\Rule;

Route::get('csrf-cookie', function () {
    return response()->noContent();
})->middleware('web');

Route::middleware('web')->group(function () {
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/logout', [AuthController::class, 'logout'])->middleware('auth');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth');
    Route::post('testimonials', [TestimonialController::class, 'store'])->middleware('auth');

    Route::prefix('admin')->middleware(['auth', 'admin'])->group(function () {
        Route::get('users', [AdminController::class, 'users']);
        Route::patch('users/{user}', [AdminController::class, 'updateUser']);
        Route::get('plans', [AdminController::class, 'plans']);
        Route::post('plans', [AdminController::class, 'storePlan']);
        Route::patch('plans/{plan}', [AdminController::class, 'updatePlan']);
        Route::delete('plans/{plan}', [AdminController::class, 'destroyPlan']);
    });
});

Route::get('testimonials', [TestimonialController::class, 'index']);

Route::get('pricing', function () {
    return response()->json([
        'plans' => Plan::query()->latest()->get()->map(fn (Plan $plan) => [
            'slug' => $plan->slug,
            'name' => $plan->name,
            'description' => $plan->description,
            'monthlyPrice' => $plan->monthly_price,
            'yearlyPrice' => $plan->yearly_price,
            'yearlyTotal' => $plan->yearly_total,
            'features' => $plan->features ?? [],
            'popular' => $plan->popular,
            'cta' => $plan->cta,
        ])->values(),
    ])->header('Access-Control-Allow-Origin', '*');
});

Route::middleware(['web', 'auth'])->group(function () {
    Route::post('checkout', [PaymentController::class, 'createCheckout']);
    Route::get('checkout/{checkoutId}/verify', [PaymentController::class, 'verify']);
    Route::post('subscriptions/trial', [PaymentController::class, 'startTrial']);
    Route::post('subscriptions/cancel', [PaymentController::class, 'cancelSubscription']);
    Route::post('subscriptions/{subscription}/cancel', [PaymentController::class, 'cancelSubscription']);

    // Settings API Endpoints
    Route::patch('settings/profile', function (Request $request) {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($request->user()->id)],
        ]);

        $user = $request->user();
        $user->fill($request->only('name', 'email'));

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    });

    Route::put('settings/password', function (Request $request) {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $request->user()->update([
            'password' => Hash::make($request->input('password')),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    });

    Route::delete('settings/account', function (Request $request) {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        Auth::guard('web')->logout();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'message' => 'Account deleted successfully.',
        ]);
    });
});

Route::post('webhooks/chargily', [PaymentController::class, 'webhook']);
