<?php

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// The site itself is the Next.js frontend; the Laravel domain only serves the API.
Route::get('/', fn () => redirect()->away(config('app.frontend_url')))->name('home');

/*
| Legacy Chargily return URLs (checkouts created before the Next.js result page existed).
| Payment results are shown by the frontend, which verifies the payment through the API.
*/
$redirectToPaymentResult = function (Request $request) {
    $payment = Payment::query()->where('metadata->payment_id', (string) $request->query('payment_id'))->first();

    return redirect()->away(config('app.frontend_url').'/payment/result'.($payment ? '?payment='.$payment->id : ''));
};

Route::get('/payment/success', $redirectToPaymentResult)->name('payment.success');
Route::get('/payment/failed', $redirectToPaymentResult)->name('payment.failed');

/*
| The starter kit's web auth and settings routes (routes/auth.php, routes/settings.php) are
| intentionally not registered: they bypassed the API's rate limits, trial rules and account
| deletion logic. Accounts are managed only through the API (routes/api.php).
*/
