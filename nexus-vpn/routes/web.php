<?php

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

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
