<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::get('/payment/success', function (Request $request) {
    $paymentId = $request->query('payment_id');

    return response()->view('payment.success', [
        'payment_id' => $paymentId,
    ]);
})->name('payment.success');

Route::get('/payment/failed', function (Request $request) {
    $paymentId = $request->query('payment_id');

    return response()->view('payment.failed', [
        'payment_id' => $paymentId,
    ]);
})->name('payment.failed');

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::patch('/api/settings/profile', [AuthController::class, 'updateProfile']);
    Route::put('/api/settings/password', [AuthController::class, 'updatePassword']);
    Route::delete('/api/settings/account', [AuthController::class, 'deleteAccount']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
