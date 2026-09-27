<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('admin:grant {email}', function (string $email) {
    $user = \App\Models\User::where('email', strtolower(trim($email)))->firstOrFail();
    $user->update(['role' => 'admin']);
    $this->info("Admin access granted to {$user->email}.");
})->purpose('Grant admin access to an existing user');
