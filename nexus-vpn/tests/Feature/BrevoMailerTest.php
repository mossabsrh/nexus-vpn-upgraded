<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use ReflectionProperty;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoApiTransport;
use Tests\TestCase;

/**
 * Production e-mail goes through Brevo's HTTP API (Render's free tier blocks outbound SMTP).
 */
class BrevoMailerTest extends TestCase
{
    public function test_brevo_mailer_uses_the_brevo_http_api_with_the_configured_key(): void
    {
        config(['services.brevo.key' => 'xkeysib-test-key']);

        $transport = Mail::mailer('brevo')->getSymfonyTransport();

        $this->assertInstanceOf(BrevoApiTransport::class, $transport);
        $this->assertSame('brevo+api://api.brevo.com', (string) $transport);
        $this->assertSame('xkeysib-test-key', (new ReflectionProperty($transport, 'key'))->getValue($transport));
    }
}
