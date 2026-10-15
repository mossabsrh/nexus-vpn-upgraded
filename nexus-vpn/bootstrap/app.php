<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);

        // There is no Laravel login page (the starter kit's web auth routes are not registered):
        // API guests get a JSON 401, anything else is sent to the Next.js frontend.
        $middleware->redirectGuestsTo(fn () => config('app.frontend_url'));

        // Requests arrive through the Next.js rewrite / hosting proxy; without this every
        // visitor shares the proxy's IP and per-IP rate limits would lock everyone out together.
        $trustedProxies = env('TRUSTED_PROXIES');
        if ($trustedProxies) {
            $middleware->trustProxies(at: $trustedProxies === '*' ? '*' : array_map('trim', explode(',', $trustedProxies)));
        }

        // Every session-authenticated API route is CSRF-protected; the frontend sends X-XSRF-TOKEN.
        // The Chargily webhook is outside the "web" group (no session, no CSRF) and is HMAC-verified.
        $middleware->append(SecurityHeaders::class);
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function ($request, $exception) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })->create();
