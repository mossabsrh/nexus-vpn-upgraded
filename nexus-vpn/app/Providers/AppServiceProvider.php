<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use RuntimeException;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        $this->guardProductionConfiguration();
        $this->configureRateLimiting();
        $this->configureEmailLinks();
        $this->configureMailTransports();
    }

    /**
     * Brevo's HTTP API ("brevo" mailer), used in production where outbound SMTP is blocked.
     */
    private function configureMailTransports(): void
    {
        Mail::extend('brevo', fn () => (new BrevoTransportFactory)->create(
            new Dsn('brevo+api', 'default', config('services.brevo.key'))
        ));
    }

    private function configureRateLimiting(): void
    {
        $byUserOrIp = fn (Request $request): string => (string) ($request->user()?->id ?: $request->ip());

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($byUserOrIp($request)));
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('register', fn (Request $request) => [
            Limit::perMinute(3)->by($request->ip()),
            Limit::perDay(20)->by($request->ip()),
        ]);
        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(3)->by($request->ip()),
            Limit::perHour(10)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
        ]);
        RateLimiter::for('account', fn (Request $request) => Limit::perMinute(6)->by($byUserOrIp($request)));
        RateLimiter::for('verification', fn (Request $request) => Limit::perMinute(6)->by($byUserOrIp($request)));
        RateLimiter::for('checkout', fn (Request $request) => [
            Limit::perMinute(5)->by($byUserOrIp($request)),
            Limit::perDay(30)->by($byUserOrIp($request)),
        ]);
        RateLimiter::for('trial', fn (Request $request) => Limit::perMinute(3)->by($byUserOrIp($request)));
        RateLimiter::for('testimonials', fn (Request $request) => Limit::perHour(3)->by($byUserOrIp($request)));
        RateLimiter::for('vpn', fn (Request $request) => Limit::perMinute(10)->by($byUserOrIp($request)));
        RateLimiter::for('contact', fn (Request $request) => [
            Limit::perMinute(2)->by($request->ip()),
            Limit::perDay(10)->by($request->ip()),
        ]);
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
    }

    /**
     * Account emails link to the Next.js frontend, which calls the JSON API.
     */
    private function configureEmailLinks(): void
    {
        ResetPassword::createUrlUsing(fn (object $user, string $token): string => config('app.frontend_url').'/reset-password?'.http_build_query([
            'token' => $token,
            'email' => $user->getEmailForPasswordReset(),
        ]));

        VerifyEmail::createUrlUsing(function (object $user): string {
            $signed = URL::temporarySignedRoute('api.verification.verify', now()->addMinutes(60), [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ], absolute: false);

            parse_str((string) parse_url($signed, PHP_URL_QUERY), $query);

            return config('app.frontend_url').'/verify-email?'.http_build_query([
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
                'expires' => $query['expires'] ?? null,
                'signature' => $query['signature'] ?? null,
            ]);
        });
    }

    /**
     * Refuse to serve with debug output in production and flag development defaults.
     */
    private function guardProductionConfiguration(): void
    {
        if (! $this->app->isProduction()) {
            return;
        }

        if (config('app.debug')) {
            throw new RuntimeException('APP_DEBUG must be false in production.');
        }

        $warnings = array_filter([
            config('database.default') === 'sqlite' ? 'DB_CONNECTION is sqlite' : null,
            config('services.chargily.mode') !== 'live' ? 'CHARGILY_MODE is not live' : null,
            str_ends_with((string) config('mail.from.address'), '@example.com') ? 'MAIL_FROM_ADDRESS is a placeholder' : null,
            in_array(config('mail.default'), ['log', 'array'], true) ? 'MAIL_MAILER does not deliver email' : null,
            config('mail.default') === 'brevo' && blank(config('services.brevo.key')) ? 'BREVO_API_KEY is missing' : null,
            config('session.encrypt') ? null : 'SESSION_ENCRYPT is false',
            config('logging.channels.'.config('logging.default').'.level') === 'debug' ? 'LOG_LEVEL is debug' : null,
        ]);

        if ($warnings !== []) {
            Log::warning('Production configuration uses development defaults.', ['issues' => array_values($warnings)]);
        }
    }
}
