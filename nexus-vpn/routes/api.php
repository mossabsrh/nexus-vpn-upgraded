<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TestimonialController;
use App\Http\Controllers\Api\AdminController;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

Route::post('checkout', function (Request $request) {
    return response()->json([
        'received' => $request->all(),
        'headers' => $request->headers->all(),
    ])->header('Access-Control-Allow-Origin', '*');
});
