# CHAPTER IV — Implementation and Deployment

## Introduction

The previous chapter translated the requirements into a design — actors, use cases, data model and business rules. This chapter turns that design into a working system and prepares its deployment. It presents, in order, the technologies and tools chosen for the project (IV.1), the overall software architecture (IV.2), the functional modules that make up the portal (IV.3), a walk-through of the user interface (IV.4), the implementation of the most critical components with excerpts from the source code (IV.5), the quality-assurance and testing work (IV.6), and finally the deployment: production environment, request flow, release process, continuous integration, live verification, problems met and monitoring (IV.7).

The chapter is precise about the state of the system. The portal is fully implemented and covered by an automated backend test suite; it is deployed on free hosting tiers (Vercel and Render) and was checked against its public addresses. Wherever a claim would require evidence not yet captured (security scans, load tests, dashboard screenshots), the chapter states what can be shown today and marks the remaining evidence as a clearly identified item of future work.

## IV.1 Technologies and Tools

The portal is built as two applications — a **Next.js** front end and a **Laravel** REST API — supported by a small, deliberately conventional set of tools. This section presents each technology with its logo, its role and the exact version in use, grouped by purpose; Figure IV.1 gathers the main ones in a single view. The versions were read from `nexus-vpn/composer.lock` and the frontend `package.json` / `pnpm-lock.yaml`.

### IV.1.1 Languages and frameworks

![](../figures/logos/png/php.png){height=0.6cm} **PHP**[^php] 8.2 (8.3 in the production image) — the back-end language.

![](../figures/logos/png/laravel.png){height=0.6cm} **Laravel**[^laravel] 12.60.2 — the back-end framework: routing, the Eloquent ORM, request validation, sessions and CSRF protection, rate limiting, a task scheduler, an HTTP client (used to call Chargily) and an encryption layer (used to encrypt the stored VPN private keys). The API exposes JSON only; it renders no HTML for the real application.

![](../figures/logos/png/nextjs.png){height=0.6cm} **Next.js**[^nextjs] 16.2.6 — the front-end framework. It uses the App Router, server-side rendering and middleware (`proxy.ts`) to gate the private areas and to rewrite API calls to the Laravel service on the same origin.

![](../figures/logos/png/react.png){height=0.6cm} **React**[^react] 19.2.4 — the user-interface library the front end is built on.

![](../figures/logos/png/typescript.png){height=0.6cm} **TypeScript**[^typescript] 5.7.3 — static typing (`strict` mode) across the whole front end.

![](../figures/logos/png/tailwindcss.png){height=0.6cm} **Tailwind CSS**[^tailwind] 4.2.0 — the utility-first CSS framework; the interface is composed from accessible **shadcn/ui** components built on the Radix UI primitives.

### IV.1.2 Database management systems

Data is stored in a relational database accessed exclusively through Laravel's **Eloquent ORM**, so the same code runs on two engines.

![](../figures/logos/png/sqlite.png){height=0.6cm} **SQLite**[^sqlite] — the development database; the automated tests run on an in-memory SQLite database, which keeps them fast and isolated.

![](../figures/logos/png/postgresql.png){height=0.6cm} **PostgreSQL**[^postgresql] — the production database, hosted on Render. The schema is created and evolved by Laravel migrations, and no raw SQL is written by hand.

### IV.1.3 Security and payment technologies

![](../figures/logos/png/laravel.png){height=0.6cm} **Laravel Sanctum**[^sanctum] 4.3.3 — issues personal access tokens for the (postponed) mobile client, on routes kept outside the session/CSRF web group (IV.5.2).

![](../figures/logos/png/chargily.png){height=0.6cm} **Chargily Pay**[^chargily4] v2 — the payment gateway for the Algerian market: it accepts EDAHABIA and CIB cards in Algerian dinars through a hosted checkout and a signed webhook. No SDK is used — the integration goes through Laravel's HTTP client against the Chargily REST API.

![](../figures/logos/png/wireguard-icon.png){height=0.6cm} **WireGuard**[^wgproto4] — the VPN protocol. The PHP `sodium` extension generates its Curve25519 key pairs and Laravel's encrypter protects the private keys at rest (IV.1.6, IV.5.4).

Multi-factor authentication is **not** implemented and is listed as future work; the account-security measures actually in place — e-mail verification, a login throttle (per e-mail and IP) after repeated failures, named rate limiters and bcrypt password hashing — are described in IV.5.

### IV.1.4 Development and operations tools

![](../figures/logos/png/git.png){height=0.6cm} **Git** · ![](../figures/logos/png/github.png){height=0.6cm} **GitHub** — version control and repository hosting, where the continuous-integration workflows run (IV.7.2).

![](../figures/logos/png/composer.png){height=0.6cm} **Composer 2** — the PHP dependency manager.

![](../figures/logos/png/nodejs.png){height=0.6cm} **Node.js 22** with **pnpm 10** — the JavaScript runtime and package manager used to build the front end.

![](../figures/logos/png/docker.png){height=0.6cm} **Docker** — containerises the back end (base image `php:8.3-apache-bookworm`) for deployment on Render.

![](../figures/logos/png/vercel.png){height=0.6cm} **Vercel** — the hosting platform for the Next.js front end. **Render** — the hosting platform for the backend container and the managed PostgreSQL database. **Brevo** is the planned production e-mail service, to be used over its HTTP API (Gmail SMTP in development).

![](../figures/logos/png/phpunit.png){height=0.6cm} **PHPUnit**[^phpunit] 11.5.55 — the back-end test framework (110 tests, IV.6).

![](../figures/logos/png/eslint.png){height=0.6cm} **ESLint 9.39** with **Laravel Pint 1.29** — static analysis and code style for the front end and the back end.

![](../figures/logos/png/playwright.png){height=0.6cm} **Playwright**[^playwright] 1.63 — drives a headless browser to capture the interface screenshots of this chapter.

### IV.1.5 Modelling tools

The UML and architecture diagrams of Chapter III were produced as **diagram-as-code**, so they live in the repository next to the chapters and are regenerated from text.

![](../figures/logos/png/plantuml.png){height=0.6cm} **PlantUML**[^plantuml] — the use-case diagrams, laid out with the **Graphviz** engine.

![](../figures/logos/png/mermaid.png){height=0.6cm} **Mermaid**[^mermaid] — the sequence, class, architecture and entity-relationship diagrams.

This diagram-as-code approach keeps every diagram versioned, reviewable and reproducible, and is used in place of a dedicated graphical UML editor.

### IV.1.6 Focus on a key technology: WireGuard provisioning

This section places the spotlight on **WireGuard provisioning** rather than the payment gateway. The choice is deliberate: WireGuard is the product itself (it gives the portal and the company their name), and, unlike the payment flow — which delegates to an external gateway — the provisioning logic is implemented from first principles inside the API, which makes it the most technically interesting component to examine.

WireGuard is a modern VPN protocol designed to be simpler and faster than IPsec or OpenVPN, using a fixed, modern set of cryptographic primitives.[^wgproto4] A WireGuard peer is identified by a **Curve25519** key pair: the client keeps a private key and shares its public key with the server. In this project the server generates the client's key pair, stores the private key **encrypted**, allocates a unique tunnel address from a private pool, and assembles a ready-to-import `nexusvpn.conf` file. The implementation is examined in IV.5.4; the limit of the current version — no live gateway is operated by the project — is stated there and in the conclusion.

![Technology stack](../figures/tech-stack.png){width=15cm}

**Figure IV.1 — Main technologies of the portal.** *Source: prepared by the authors; logos are the property of their respective projects.*

## IV.2 System Architecture

### IV.2.1 Architectural pattern

The system follows a **decoupled client–server** pattern: a Next.js front end and a single Laravel REST API, each deployed and scaled independently. The browser never calls the API across origins; instead it calls a same-origin path (`/backend-api/*`) that the Next.js layer rewrites to the Laravel service. This keeps the session cookie first-party and removes cross-origin complexity, while still allowing the two applications to be hosted on different platforms (Vercel and Render). The overall component view was given in Figure III.1.

The back end is a **modular monolith**, not a set of microservices. For a project built by a small team around a single bounded domain (selling and provisioning one VPN service), a monolith is the appropriate choice: it is simpler to develop, test and deploy, it keeps all business rules and the database under one transaction boundary, and it avoids the operational overhead (service discovery, inter-service contracts, distributed transactions) that microservices would add without a matching benefit at this scale. The code is nonetheless organised into clear modules (IV.3) so that responsibilities stay separated inside the single deployable unit.

### IV.2.2 Logical layers

Inside each application the code is organised in three layers:

| Layer | Front end (Next.js) | Back end (Laravel) |
|---|---|---|
| Presentation | React components, pages (App Router), `proxy.ts` route guard | JSON responses; no server-rendered HTML for the real app |
| Business logic | client-side form handling and view state | controllers, services (e.g. `ChargilyGateway`), domain methods on the models |
| Data | API client (`lib/api.ts`) over the same-origin rewrite | Eloquent models, migrations, SQLite / PostgreSQL |

**Table IV.1 — Logical layers of the system.** *Source: prepared by the authors.*

### IV.2.3 Third-party services

The API depends on three external services, each isolated behind a small, replaceable integration point:

- **Chargily Pay v2** — hosted checkout and signed webhook for EDAHABIA/CIB payments (IV.5.3).
- **E-mail** — Gmail SMTP in development; in production, Brevo's HTTP API is planned, because Render's free tier blocks outbound SMTP. Account e-mails are transactional (verification, password reset, welcome, receipt, reminders).
- **WireGuard gateway** — the server that terminates the tunnels. The portal issues peers and configuration files; running the gateway is the network team's responsibility and is not part of this repository.

## IV.3 Functional Modules

The portal is organised into nine functional modules. Each one groups a set of API endpoints and the business rules that govern them, and corresponds to the routes declared in `routes/api.php` and their controllers; the full list of endpoints is given in Appendix A.

### IV.3.1 Offers and pricing

Publishes the plans shown on the public pricing page. `GET /api/pricing` returns the active plans (cached for ten minutes); administrators manage them through the offers module (IV.3.8 / admin). Prices are stored in Algerian dinars and are never supplied by the client — the server always computes the amount from the plan.

### IV.3.2 Order management

Turns a chosen plan into a pending order. `POST /api/checkout` validates the selection, records a **pending payment first**, then creates a Chargily checkout and returns its hosted-payment URL. Recording the payment before contacting Chargily is what later lets the webhook find and complete the order idempotently (IV.5.3).

### IV.3.3 Billing and payment

Confirms payments and keeps the billing history. It handles the Chargily webhook (`POST /api/webhooks/chargily`) and the active verification fallback (`GET /api/payments/{id}/verify`), exposes the user's payment history and receipts, and lets an administrator record a refund (`POST /api/admin/payments/{payment}/refund`). Because Chargily Pay v2 has no refund API, a refund is **recorded** in the portal and reconciled manually in the Chargily dashboard.

### IV.3.4 Subscription management

Owns the subscription lifecycle: a seven-day trial once per account (`POST /api/subscriptions/trial`), activation and renewal on payment, cancellation (`POST /api/subscriptions/cancel`), and the scheduled expiry of ended periods. Access follows the paid period, not the status: a cancelled **paid** period keeps access until its end, while a cancelled **trial** ends immediately (IV.5).

### IV.3.5 VPN account provisioning (WireGuard keys and configuration files)

Issues and revokes the WireGuard peer that backs a user's access. On the first configuration download (`GET /api/vpn/config`), the server creates a key pair and tunnel address and returns a `nexusvpn.conf` file; the peer is revoked automatically when no subscription grants access any more (cancellation, expiry, refund or removal from a team). The cryptographic details are in IV.5.4.

### IV.3.6 User profile and account

Lets a signed-in user manage their account: change e-mail (which requires re-verification) or password (`PUT /api/account/email`, `PUT /api/account/password`), view their subscriptions and receipts, and permanently delete the account (`DELETE /api/account`). Deletion **anonymises and soft-deletes** the user while keeping the (anonymised) billing history, and frees the e-mail for reuse.

### IV.3.7 Authentication and access control

Provides registration, login, logout, e-mail verification and password reset for the web session, the equivalent token endpoints for the mobile client (`/api/mobile/*`), and role-based access control for the administration area. Its security-critical parts are detailed in IV.5.1–IV.5.2.

### IV.3.8 Support and administration

Covers the back-office console and the merged support activity (a dedicated ticketing system is future work). Administrators manage users, offers, subscriptions and payments, consult the audit log, and handle the two support channels — **contact requests** (`/api/admin/contact-requests`) and **testimonial moderation** (`/api/admin/testimonials`). Every administrative action is written to the audit log.

### IV.3.9 Team management

Lets the owner of a team plan manage their organisation: view or rename the team and adjust the number of seats (`GET /api/team`, `PATCH /api/team`), and invite or remove members (`POST /api/team/members`, `DELETE /api/team/members/{member}`). The seat count is enforced from the team's subscription, and a member removed from a team loses VPN access like any other loss of entitlement.

| Module | Key endpoints |
|---|---|
| Offers and pricing | `GET /api/pricing` |
| Order management | `POST /api/checkout` |
| Billing and payment | `POST /api/webhooks/chargily`, `GET /api/payments/{id}/verify`, `POST /api/admin/payments/{id}/refund` |
| Subscription management | `POST /api/subscriptions/trial`, `POST /api/subscriptions/cancel` |
| VPN provisioning | `GET /api/vpn/config` |
| User profile and account | `PUT /api/account/email`, `PUT /api/account/password`, `DELETE /api/account` |
| Authentication and access control | `POST /api/auth/register`, `POST /api/auth/login`, `/api/mobile/*` |
| Support and administration | `GET /api/admin/*` (users, plans, subscriptions, payments, testimonials, contact-requests, audit-logs) |
| Team management | `GET /api/team`, `PATCH /api/team`, `POST /api/team/members`, `DELETE /api/team/members/{member}` |

**Table IV.2 — Functional modules and their main endpoints.** *Source: prepared by the authors, from `routes/api.php`.*

## IV.4 User Interface Walkthrough

This section walks through the main screens of the running application, captured with Playwright on seeded demonstration data. The client interface comes first, then the administration console and the support views, and finally the responsive (mobile-width) views and the postponed native client.

### IV.4.1 Client interface

The public site is a single scrolling landing page followed by the authenticated dashboard.

The page opens with the navigation bar and the hero section (Figure IV.2), which states the value proposition and carries the primary call to action.

![Home — navigation bar and hero](../pfe/memoire-assets/screenshots/memoire/01-home-navbar-hero.png){width=14cm}

**Figure IV.2 — Public home page: navigation bar and hero.** *Source: prepared by the authors.*

Below it, the features section (Figure IV.3) summarises what the service offers to a subscriber.

![Features section](../pfe/memoire-assets/screenshots/memoire/02-features.png){width=14cm}

**Figure IV.3 — Home page: features section.** *Source: prepared by the authors.*

The network section (Figure IV.4) illustrates how a subscriber's traffic is routed privately over WireGuard.

![Network section](../pfe/memoire-assets/screenshots/memoire/03-map-stats.png){width=14cm}

**Figure IV.4 — Home page: the network section (private routing over WireGuard).** *Source: prepared by the authors.*

Approved customer testimonials follow (Figure IV.5); each one is moderated by an administrator before it appears.

![Testimonials](../pfe/memoire-assets/screenshots/memoire/04-testimonials.png){width=14cm}

**Figure IV.5 — Home page: approved customer testimonials.** *Source: prepared by the authors.*

The pricing section (Figure IV.6) lists the plans, with every amount shown in Algerian dinars and computed on the server.

![Pricing cards](../pfe/memoire-assets/screenshots/memoire/05-pricing-cards.png){width=14cm}

**Figure IV.6 — Home page: pricing plans (in Algerian dinars).** *Source: prepared by the authors.*

Organisations that need several seats use the Team-plan contact form (Figure IV.7) to request a sales-assisted quote.

![Contact form](../pfe/memoire-assets/screenshots/memoire/06-contact-form.png){width=14cm}

**Figure IV.7 — Home page: Team-plan contact form.** *Source: prepared by the authors.*

The footer (Figure IV.8) closes the page with the secondary navigation links.

![Footer](../pfe/memoire-assets/screenshots/memoire/07-footer.png){width=14cm}

**Figure IV.8 — Home page: footer.** *Source: prepared by the authors.*

Authentication takes place in modal dialogs layered over the landing page; the sign-in dialog is shown in Figure IV.9.

![Sign-in dialog](../pfe/memoire-assets/screenshots/memoire/08-auth-signin.png){width=10cm}

**Figure IV.9 — Authentication: sign-in dialog.** *Source: prepared by the authors.*

A visitor can create an account and choose a plan at the same time in the sign-up dialog (Figure IV.10).

![Sign-up dialog](../pfe/memoire-assets/screenshots/memoire/09-auth-signup.png){width=10cm}

**Figure IV.10 — Authentication: sign-up dialog (with plan selection).** *Source: prepared by the authors.*

Validation errors returned by the API are surfaced inline, as in Figure IV.11.

![Validation error](../pfe/memoire-assets/screenshots/memoire/10-auth-validation-error.png){width=10cm}

**Figure IV.11 — Authentication: server-side validation error.** *Source: prepared by the authors.*

A user who has forgotten their password requests a reset link through the form in Figure IV.12,

![Forgot password](../pfe/memoire-assets/screenshots/memoire/11-auth-forgot-password.png){width=10cm}

**Figure IV.12 — Authentication: forgotten-password request.** *Source: prepared by the authors.*

and receives the neutral confirmation message of Figure IV.13, which does not reveal whether the address is registered.

![Success message](../pfe/memoire-assets/screenshots/memoire/27-auth-success-message.png){width=10cm}

**Figure IV.13 — Authentication: confirmation message.** *Source: prepared by the authors.*

After signing in, the subscriber reaches the dashboard; Figure IV.14 shows the active subscription and the VPN-access panel.

![Dashboard — subscription and VPN](../pfe/memoire-assets/screenshots/memoire/12-dashboard-subscription-vpn.png){width=14cm}

**Figure IV.14 — Client dashboard: subscription status and VPN access.** *Source: prepared by the authors.*

When no subscription is active, the dashboard shows the empty state of Figure IV.15,

![Dashboard — empty state](../pfe/memoire-assets/screenshots/memoire/25-dashboard-empty-state.png){width=14cm}

**Figure IV.15 — Client dashboard: empty state (no active subscription).** *Source: prepared by the authors.*

and after a failed payment it shows the recovery state of Figure IV.16, which invites the user to try again.

![Dashboard — failed payment](../pfe/memoire-assets/screenshots/memoire/26-dashboard-failed-payment.png){width=14cm}

**Figure IV.16 — Client dashboard: failed-payment state.** *Source: prepared by the authors.*

Checkout begins with the payment dialog of Figure IV.17, shown just before the redirection to Chargily's hosted page.

![Payment dialog](../pfe/memoire-assets/screenshots/memoire/16-payment-dialog.png){width=10cm}

**Figure IV.17 — Checkout: payment dialog before redirection to Chargily.** *Source: prepared by the authors.*

Once a payment succeeds, the subscriber can open the receipt dialog of Figure IV.18.

![Receipt dialog](../pfe/memoire-assets/screenshots/memoire/14-receipt-dialog.png){width=10cm}

**Figure IV.18 — Billing: payment receipt dialog.** *Source: prepared by the authors.*

Account settings (Figure IV.19) let the user change their e-mail or password and delete the account.

![Account settings](../pfe/memoire-assets/screenshots/memoire/15-account-settings.png){width=14cm}

**Figure IV.19 — Account settings: e-mail, password and account deletion.** *Source: prepared by the authors.*

Finally, the owner of a team plan manages its members from the view in Figure IV.20.

![Team management](../pfe/memoire-assets/screenshots/memoire/13-dashboard-team-management.png){width=14cm}

**Figure IV.20 — Client dashboard: team-member management (team owner).** *Source: prepared by the authors.*

### IV.4.2 Administration console

The administrator operates a back-office console with a section for each business area.

The console opens on the overview of Figure IV.21, which gathers the key figures computed from the billing data.

![Admin overview](../pfe/memoire-assets/screenshots/memoire/17-admin-overview.png){width=14cm}

**Figure IV.21 — Administration: overview.** *Source: prepared by the authors.*

The accounts section (Figure IV.22) lists the user accounts and lets an administrator manage them.

![Admin accounts](../pfe/memoire-assets/screenshots/memoire/18-admin-accounts.png){width=14cm}

**Figure IV.22 — Administration: user accounts.** *Source: prepared by the authors.*

Plans are created and edited in the offers section (Figure IV.23).

![Admin offers](../pfe/memoire-assets/screenshots/memoire/19-admin-offers.png){width=14cm}

**Figure IV.23 — Administration: offers (plans) management.** *Source: prepared by the authors.*

The subscriptions section (Figure IV.24) shows every subscription and its current state.

![Admin subscriptions](../pfe/memoire-assets/screenshots/memoire/20-admin-subscriptions.png){width=14cm}

**Figure IV.24 — Administration: subscriptions.** *Source: prepared by the authors.*

Payments, including the recording of refunds, are handled in the section of Figure IV.25.

![Admin payments](../pfe/memoire-assets/screenshots/memoire/21-admin-payments.png){width=14cm}

**Figure IV.25 — Administration: payments and refunds.** *Source: prepared by the authors.*

The analytics section (Figure IV.26) presents the charts, which are drawn by hand in the front end.

![Admin analytics](../pfe/memoire-assets/screenshots/memoire/22-admin-analytics.png){width=14cm}

**Figure IV.26 — Administration: analytics (custom-built charts).** *Source: prepared by the authors.*

Every security- and billing-relevant action is traceable in the audit log (Figure IV.27).

![Admin audit log](../pfe/memoire-assets/screenshots/memoire/24-admin-audit-log.png){width=14cm}

**Figure IV.27 — Administration: audit log.** *Source: prepared by the authors.*

### IV.4.3 Support views

Support is handled inside the administration console: testimonial moderation and the contact-request inbox.

Customer testimonials awaiting a decision appear in the moderation queue of Figure IV.28, where an administrator approves or rejects each one.

![Admin testimonial moderation](../pfe/memoire-assets/screenshots/memoire/23-admin-comments.png){width=14cm}

**Figure IV.28 — Support: testimonial moderation.** *Source: prepared by the authors.*

Sales-assisted enquiries submitted through the Team-plan form arrive in the contact-request inbox of Figure IV.29, where an administrator reads a request and marks it as handled.

![Admin contact-request inbox](../pfe/memoire-assets/screenshots/memoire/28-admin-contact-requests.png){width=14cm}

**Figure IV.29 — Support: contact-request inbox.** *Source: prepared by the authors.*

### IV.4.4 Responsive and mobile

The web application is responsive and usable at phone width, as the following captures show. These are the **web** application in a narrow viewport, not a native application.

Figure IV.30 shows the landing page at phone width, with the navigation collapsed into a menu.

![Responsive home](../pfe/memoire-assets/screenshots/memoire/90-mobile-home.png){width=6.5cm}

**Figure IV.30 — Responsive web: home page at phone width.** *Source: prepared by the authors.*

Figure IV.31 shows the dashboard in the same narrow viewport.

![Responsive dashboard](../pfe/memoire-assets/screenshots/memoire/91-mobile-dashboard.png){width=6.5cm}

**Figure IV.31 — Responsive web: dashboard at phone width.** *Source: prepared by the authors.*

> **Future work — native mobile client.** The native Flutter application is postponed. Its screens, together with the token-based flows it will use over `/api/mobile/*`, will be documented here when the application is resumed.

## IV.5 Critical Components

This section examines the components that most affect security and correctness, with short excerpts taken verbatim from the source code.

### IV.5.1 Security hardening

**Security headers.** A global middleware adds the standard protective headers to every response, a strict `Content-Security-Policy` to the API and health endpoints, and HSTS over HTTPS. The front end sets an equivalent policy on every page (`next.config.mjs`).

```php
// app/Http/Middleware/SecurityHeaders.php
$headers->set('X-Content-Type-Options', 'nosniff');
$headers->set('X-Frame-Options', 'DENY');
$headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
$headers->set('Permissions-Policy',
    'camera=(), microphone=(), geolocation=()');

if ($request->is('api/*') || $request->is('up')) {
    $headers->set('Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'");
}
if ($request->isSecure()) {
    $headers->set('Strict-Transport-Security',
        'max-age=31536000; includeSubDomains');
}
```

**Listing IV.1 — Response security headers.** *Source: prepared by the authors, from `app/Http/Middleware/SecurityHeaders.php`.*

**Injection (SQLi / XSS).** All database access goes through Eloquent's parameterised queries, and `LIKE` searches escape the `%` and `_` wildcards; amounts are never taken from the client. On the front end React escapes every rendered value and the application code uses no `dangerouslySetInnerHTML`, so there is no HTML-injection point.

**CSRF.** Session routes are in Laravel's `web` group with CSRF protection; the front end fetches the `XSRF-TOKEN` cookie and echoes it in the `X-XSRF-TOKEN` header, retrying once on a 419. The payment webhook is outside the session group and is authenticated by signature instead (IV.5.3).

**Rate limiting.** Named limiters protect the sensitive endpoints; the keys are the user id when authenticated, otherwise the client IP.

```php
// app/Providers/AppServiceProvider.php — configureRateLimiting()
RateLimiter::for('login',
    fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
RateLimiter::for('checkout', fn (Request $r) => [
    Limit::perMinute(5)->by($byUserOrIp($r)),
    Limit::perDay(30)->by($byUserOrIp($r)),
]);
RateLimiter::for('contact', fn (Request $r) => [
    Limit::perMinute(2)->by($r->ip()),
    Limit::perDay(10)->by($r->ip()),
]);
```

**Listing IV.2 — Named rate limiters (excerpt).** *Source: prepared by the authors, from `app/Providers/AppServiceProvider.php`.*

**Production guard.** In production the application refuses to boot with debug output enabled, and logs a warning for any development default that slips through:

```php
// app/Providers/AppServiceProvider.php - guardProductionConfiguration()
if (! $this->app->isProduction()) {
    return;
}

if (config('app.debug')) {
    throw new RuntimeException('APP_DEBUG must be false in production.');
}
```

**Listing IV.3 — Production configuration guard.** *Source: prepared by the authors, from `app/Providers/AppServiceProvider.php`.*

### IV.5.2 Authentication and token security

The web application authenticates with a server-side **session cookie** (`HttpOnly`, same-origin via the rewrite, encrypted and `SameSite=lax` in production); the session is regenerated on login and invalidated on logout. Passwords are hashed with **bcrypt**. E-mail verification uses a temporary **signed** link (valid 60 minutes), and payment and VPN download both require a verified e-mail. Brute force is slowed by two layers: the named `login` rate limiter (ten attempts per minute per IP) and an in-controller throttle that blocks further attempts after five failures within sixty seconds, keyed by e-mail and IP; the attempt counter is cleared on a successful login. This is a temporary throttle, not a persistent account lock.

The **mobile** client (postponed) authenticates with **Laravel Sanctum** personal access tokens on routes kept outside the `web` group — no session, no CSRF — so the website's cookie flow is untouched and the administration area is never exposed to tokens.

```php
// routes/api.php — token (Sanctum) routes for the mobile client
Route::prefix('mobile')->middleware('throttle:api')->group(function () {
    Route::post('auth/register', [MobileAuthController::class, 'register'])
        ->middleware('throttle:register');
    Route::post('auth/login', [MobileAuthController::class, 'login'])
        ->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [MobileAuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        // ... account, subscriptions, payments, vpn/config, checkout ...
    });
});
```

**Listing IV.4 — Sanctum token routes for the mobile client.** *Source: prepared by the authors, from `routes/api.php`.*

Tokens are issued with `createToken()` and returned only once as plain text; they are stored **hashed** in `personal_access_tokens` and expire after thirty days (`SANCTUM_TOKEN_EXPIRATION`). A token is revoked on logout (`currentAccessToken()->delete()`), on password change (other tokens) and on account deletion (all tokens). A dedicated test (`MobileAuthTest`) checks that a mobile token cannot open the session-only web routes and vice-versa.

### IV.5.3 Payment gateway integration

Two independent channels confirm a payment — the server-to-server **webhook** and an active **verification** fallback from the result page — and both converge on the same logic. Authenticity and exactly-once application are therefore essential.

The webhook body is authenticated with an **HMAC-SHA256** signature compared in constant time:

```php
// app/Services/ChargilyGateway.php
public function verifySignature(string $rawBody, string $signature): bool
{
    $secretKey = $this->secretKey();
    if ($secretKey === '') {
        Log::critical(
        'Chargily webhook received but CHARGILY_SECRET_KEY is not configured.'
        );
        return false;
    }
    return hash_equals(
        hash_hmac('sha256', $rawBody, $secretKey), $signature);
}
```

**Listing IV.5 — Webhook signature verification.** *Source: prepared by the authors, from `app/Services/ChargilyGateway.php`.*

Activation is **idempotent**: the `pending → succeeded` transition is a conditional update on a row locked inside a transaction, so a replayed webhook and a simultaneous verification can activate the subscription only once. Activation is also refused if the amount or currency returned by Chargily does not match the recorded payment.

```php
// app/Models/Payment.php — markSucceeded()
$payment = self::query()->whereKey($this->id)->lockForUpdate()->first();
if (! $payment || $payment->status !== 'pending') {
    return false; // already claimed by the other channel
}
$claimed = self::query()->whereKey($this->id)
    ->where('status', 'pending')->update([
    'status' => 'succeeded', 'paid_at' => now(),
]);
```

**Listing IV.6 — Exactly-once payment activation.** *Source: prepared by the authors, from `app/Models/Payment.php`.*

### IV.5.4 VPN provisioning, notifications and reporting

**WireGuard key pairs.** A peer's keys are Curve25519: a clamped 32-byte random scalar (the private key) and its base-point multiple (the public key), both Base64-encoded. The clamping bits are set exactly as WireGuard requires.

```php
// app/Models/VpnCredential.php — generateKeyPair()
$secret = random_bytes(32);
$secret[0]  = chr(ord($secret[0])  & 248);
$secret[31] = chr((ord($secret[31]) & 127) | 64);

return [
    base64_encode($secret),
    base64_encode(sodium_crypto_scalarmult_base($secret)),
];
```

**Listing IV.7 — WireGuard Curve25519 key generation.** *Source: prepared by the authors, from `app/Models/VpnCredential.php`.*

The private key is stored with Eloquent's `encrypted` cast and hidden from serialisation; it is decrypted only to build the `nexusvpn.conf` file, which is served with `Cache-Control: no-store`. Tunnel addresses are drawn in order from the `10.66.0.0/16` pool and **never reused**, so a revoked peer's address cannot collide with a new one.

**Server-side key generation — a design trade-off.** Generating the key pair on the server lets the portal deliver a ready-to-import `nexusvpn.conf` file without any client tooling, which keeps the product simple to adopt; the cost is that the private key exists on the server when it is created, even though it is stored encrypted and never returned again after the first download. A more private design, in which the client generates its own key pair and sends only its public key to the portal, is recorded as future work.[^wgquick]

**Reaching the gateway.** The portal does not itself push peers to a running gateway. An artisan command, `php artisan vpn:peers`, exports the active peers in WireGuard `[Peer]` format for an operator to apply to the gateway (`wg syncconf`); automatic, real-time synchronisation with a live gateway is future work and falls outside the scope of this repository.

**Notification system (transactional e-mails and scheduled tasks).** Account e-mails (verification, reset, welcome, receipt, reminders) are sent during the request; a queue is future work. Three scheduled commands run periodically — `subscriptions:expire` and `payments:reconcile` every fifteen minutes, and `subscriptions:remind` daily — driven by `schedule:work` inside the container.

**Reporting.** The administration overview computes its figures from the real billing data (revenue, active subscriptions, recent payments); the charts are drawn by hand in the front end rather than with a charting library.

## IV.6 Quality Assurance and Testing

### IV.6.1 Automated tests

The back end is covered by an automated test suite of **110 tests (460 assertions)** that runs in about thirty seconds on an in-memory SQLite database. The tests are feature tests: each one drives the real HTTP endpoints and asserts on the response and the database state. Table IV.3 groups them by area; the same breakdown is given in Appendix C.

| Area | Tests | What it verifies |
|---|---|---|
| Authentication, account and security | 28 | Registration, login, logout, e-mail verification, password reset, account lockout, security headers, account deletion and anonymisation, removed starter-kit routes answering 404 |
| Payments and webhooks | 41 | Checkout, webhook signature and idempotency, amount/currency checks, reconciliation of stale payments, receipts |
| Subscriptions and VPN provisioning | 11 | Trial, renewal, cancellation, scheduled expiry, WireGuard peer issue and distinct tunnel addresses |
| Mobile token API (Sanctum) | 9 | Token issue, protected routes, guard separation, token revocation |
| Administration and billing | 19 | Admin-only access, statistics, refunds, plan deactivation, moderation, team subscriptions, contact requests |
| Platform and data integrity | 2 | Demo-data seeder, scaffold test |
| **Total** | **110** | 460 assertions, ~30 s |

**Table IV.3 — Backend automated test suite.** *Source: prepared by the authors, from `php artisan test` (15/10/2026).*

Automated **frontend** testing is not yet in place and is listed as future work; Playwright is currently used to capture the interface screenshots rather than to assert on behaviour.

### IV.6.2 Security testing

The security measures of IV.5 are covered by the automated test suite and were also checked manually against the running application during development. Table IV.4 records the checks that can be made without the deployed site, each with the automated test that verifies it (or, for the CSRF retry, a reproducible manual run); a re-check against the public URL is kept as future work.

| Check | Expected result | Evidence (`tests/Feature/...`) |
|---|---|---|
| Modifying a request without a valid CSRF token | 419, one automatic retry, then success | Manual run (the API tests are stateless); the retry lives in the front end's `lib/api.ts` |
| Five failed logins then another, for one e-mail and IP | 429 Too Many Requests | `AccountSecurityTest::test_login_is_throttled_after_five_failed_attempts` |
| Non-admin calling an `/api/admin/*` route | 403 Forbidden | `AdminTest::test_regular_users_cannot_access_admin_api` |
| Webhook with an invalid signature | 403, IP logged | `ChargilyPaymentTest::test_webhook_rejects_invalid_signature` |
| Requesting another user's payment | 404 (existence not revealed) | `PaymentFlowTest::test_users_cannot_verify_someone_elses_payment` |

**Table IV.4 — Security checks and their evidence.** *Source: prepared by the authors.*

> **Future work — live security scan.** Online scans of the deployed site (security-header grade, TLS configuration, and a re-check of the 419/429/403 behaviours against the public URL) remain to be run and reported here.

### IV.6.3 Performance testing

On the list endpoints the back end eager-loads related models (for example the administration payment listing loads each payment's user and subscription in the same query) to avoid N+1 query patterns. A full performance assessment, however, requires the live site and is left as future work.

> **Future work — live performance test.** A Lighthouse report on the deployed front end and a small load test against a public endpoint will be run against the public URLs and reported here, together with the cold-start behaviour of the free hosting tier.

## IV.7 Deployment

This section describes how the portal is deployed and operated in production: the hosting services and why they were chosen (IV.7.1), the path a request follows from the browser to the database (IV.7.2), how a new version reaches production (IV.7.3), the continuous-integration pipeline (IV.7.4), the checks run against the live system (IV.7.5), the problems met while deploying and how they were solved (IV.7.6), and finally monitoring and the limits of the hosting plan (IV.7.7).

### IV.7.1 Production environment

The project is a monorepo that deploys as **two independent services and one database**. The Next.js front end runs on **Vercel**; the Laravel API is packaged as a **Docker** image and runs on **Render** as the web service `nexus-vpn-api`, next to a managed **PostgreSQL** database. Both Render resources are in the Frankfurt region, on the free tier. Table IV.5 lists the production components and Figure IV.32 shows how they fit together.

| Component | Host and plan | Address / identifier | Role |
|---|---|---|---|
| Front end | Vercel | `https://nexus-vpn-upgraded.vercel.app` | Serves the Next.js pages and forwards every `/backend-api/*` call to the API |
| API | Render web service (Docker), Frankfurt, free | `https://nexus-vpn-api.onrender.com` | Laravel 12 on Apache and PHP 8.3; JSON API under `/api/*` |
| Database | Render PostgreSQL, Frankfurt, free | database `nexus_vpn` | All application data (users, plans, subscriptions, payments, VPN credentials, audit log) |
| Payment | Chargily Pay v2, test mode | — | Hosted checkout page and signed webhook back to the API |
| Source and CI | GitHub + GitHub Actions | repository `nexus-vpn-upgraded`, branch `main` | Source of every deployment; runs the automated checks on each push |

**Table IV.5 — Production components.** *Source: prepared by the authors, from `render.yaml`, `next.config.mjs` and the hosting dashboards.*

![Deployment architecture](../figures/deployment-en.png){width=14cm}

**Figure IV.32 — Deployment architecture.** *Source: prepared by the authors.*

The split follows the architecture of IV.2: each side is hosted where it runs best. Vercel builds and serves Next.js without any server to manage. The Laravel API needs a long-running PHP process, a scheduler and a relational database, which Render provides from a single declarative file. Both hosts offer a free tier and redeploy automatically from GitHub, which suits a student project with no budget. The cost of this choice — sleeping services and an expiring database — is discussed in IV.7.7.

### IV.7.2 Request flow in production

**Same-origin API calls.** The browser only ever talks to the Vercel domain. The front end calls relative paths such as `/backend-api/auth/login`; a rewrite rule in `next.config.mjs` forwards them to the Render service's `/api/*` routes. Because the browser sees a single origin, the session and CSRF cookies issued by Laravel are ordinary first-party cookies (`Secure`, `SameSite=Lax`, the session cookie also `HttpOnly`), no cross-origin (CORS) request is needed, and the front end's Content Security Policy can restrict network calls to its own origin (`connect-src 'self'`).

**Authentication.** Before any state-changing request, the front end obtains a CSRF token from `GET /backend-api/csrf-cookie` and sends it back in the `X-XSRF-TOKEN` header; if the token is rejected as expired (HTTP 419), it fetches a new one and retries once (IV.5.2).

**Edge and TLS.** HTTPS is terminated by the hosts: by Vercel for the front end and, for the API, by the Cloudflare edge that Render places in front of its services (visible in the `Server: cloudflare` response header). Requests therefore reach Laravel through several proxies, which is why the application must be told which proxies to trust (`TRUSTED_PROXIES`, see IV.7.6).

**Payment.** For a payment, the browser is redirected to Chargily's hosted checkout. Chargily then calls the API's webhook directly (`POST /api/webhooks/chargily`, HMAC-signed and outside the session/CSRF group), and the user returns to the front end's `/payment/result` page, which asks the API for the payment's verified status.

### IV.7.3 Deployment process and configuration

**Render (API and database).** The API service and its database are declared in `render.yaml` (a Render *Blueprint*): Docker runtime, root directory `nexus-vpn/`, region, plan, the `/up` health check, and every environment variable. Non-secret values are written in the file; the application key is generated by Render (`generateValue`); the database URL is injected from the database resource; and the real secrets (Chargily secret key, mail credentials, WireGuard gateway key and endpoint) are marked `sync: false` and typed by hand in the Render dashboard, so they never appear in the repository. The names of all variables are listed in Appendix B.

The Docker image starts from `php:8.3-apache-bookworm`, installs the PHP extensions the application needs (`pdo_pgsql`, `bcmath`, `mbstring`, `zip`), runs `composer install --no-dev --optimize-autoloader`, and points Apache at Laravel's `public/` directory. Its entry point performs four steps each time the container starts:

1. rebuild `APP_KEY` from the secret generated by Render;
2. run `php artisan migrate --force --seed` (the migrations are additive and the seeders idempotent, so this is safe on every start);
3. start the Laravel scheduler (`schedule:work`) in the background — subscription expiry, VPN revocation, renewal reminders and payment reconciliation;
4. make Apache listen on the port given by Render, then serve requests.

**Vercel (front end).** Vercel builds the Next.js application with `pnpm build`. The only required setting is `NEXT_PUBLIC_API_URL`, the public address of the Render service; `next.config.mjs` deliberately stops the build when it is missing on Vercel, so a misconfigured deployment fails visibly instead of producing a site that cannot reach its API.

**Releasing a new version.** Both hosts are connected to the GitHub repository and rebuild their service automatically when commits are pushed to `main`: Vercel rebuilds the front end, and Render rebuilds the Docker image and restarts the container, which applies any new migrations on start-up. Each host keeps serving the previous version until the new build succeeds.

### IV.7.4 Continuous integration

Continuous integration is provided by **GitHub Actions**[^githubactions]. Two workflows, defined at the repository root, run on every push and pull request to `main`:

* **Backend tests** — installs the Composer dependencies and runs the complete PHPUnit suite on PHP 8.2 and on PHP 8.3, the version used in the production image;
* **Frontend checks** — installs the pnpm dependencies and runs the linter, the TypeScript type-check and the production build.

The first run of these workflows on GitHub (13/10/2026, commit `07a2307`) gave a useful result: the frontend checks passed, but the backend tests failed on both PHP versions. Reproducing the workflow's steps on a fresh clone showed the cause: tests inherited from the Laravel starter kit rendered Inertia pages, which require a compiled front-end asset manifest that is absent on a clean CI runner (`ViteManifestNotFoundException`). Those tests covered routes that the portal does not use; they were removed together with the routes themselves (IV.7.6), and the same clean-runner procedure then passed with **110 tests and 460 assertions** (15/10/2026). CI thus did its job: it exposed a problem that local runs had hidden.

### IV.7.5 Verification of the live system

Table IV.6 records the checks run against the public addresses, with the result actually observed. The login checks used invented e-mail addresses, so no real account was involved.

| Check (date) | Request | Observed result |
|---|---|---|
| API health (13/10/2026) | `GET https://nexus-vpn-api.onrender.com/up` | 200 OK; **14.5 s** for the first request after a period of inactivity (cold start), about **0.3 s** once awake |
| Database reachable (13/10/2026) | `GET /backend-api/pricing` and `/backend-api/testimonials` via Vercel | 200 OK with the plans and approved testimonials stored in PostgreSQL |
| Session and CSRF cookies (13/10/2026) | `GET /backend-api/csrf-cookie` via Vercel | 204; `XSRF-TOKEN` and `laravel_session` set with `Secure` and `SameSite=Lax` |
| Login rejected cleanly (13/10/2026) | `POST /backend-api/auth/login`, wrong credentials | 401 "Invalid email or password." |
| Expired CSRF token recovered (13/10/2026) | Same login with a stale `XSRF-TOKEN`, then the front end's retry | 419 on the first attempt, 401 (normal rejection) after the token refresh |
| Brute-force lockout (15/10/2026) | Eight failed logins for one e-mail | 401 five times, then **429 Too Many Requests** |
| Back-end root page (15/10/2026) | `GET https://nexus-vpn-api.onrender.com/` | 500 — corrected in the code (IV.7.6) |

**Table IV.6 — Checks run against the live system.** *Source: prepared by the authors, from `curl` runs against the public URLs.*

> **Future work — dashboard screenshots and end-to-end run.** Screenshots of the Render and Vercel dashboards, of the Chargily webhook setting, and an end-to-end run on the live site (test payment, verification e-mail, `.conf` import into the WireGuard application) remain to be captured by the authors. No live VPN tunnel is operated by the project itself: the gateway values are supplied so that a real, importable configuration file is produced.

### IV.7.6 Problems encountered during deployment

Deploying the portal surfaced problems that never appeared on a developer machine. Table IV.7 summarises them; each is documented in detail in the project's technical documentation (problem, investigation, cause, solution, verification).

| Problem | Cause | Solution | Result |
|---|---|---|---|
| Login on the live site failed with "CSRF token mismatch" | Vercel was still serving the front end of 04/10/2026: the project had lost its connection to the GitHub repository, so no later push had been deployed. That old version did not refresh an expired CSRF token, and browsers still held a token from before the back end was redeployed | Reconnected the repository to the Vercel project and redeployed `main`; no code change was needed, as the current code already refreshed the token | Live files checked: the 419 → refresh → retry logic is present and a stale token is recovered (Table IV.6) |
| Backend CI failed on its first run | Starter-kit tests needed a compiled asset manifest absent on a clean runner (IV.7.4) | Removed the unused starter-kit routes, controllers and tests | 110 tests pass on a clean runner |
| Unused starter-kit routes reachable on the API domain (a sign-up route without rate limit, an account deletion that did not cancel the subscription), and `/` returning 500 | The API was generated from a starter kit whose web pages had never been removed | Routes removed (they now answer 404); `/` redirects to the front end; regression tests added | 110/110 tests; to be confirmed on the live site after the next push |
| The API does not see the visitor's real IP address | Requests pass through several proxies (Vercel, Cloudflare); with `TRUSTED_PROXIES="*"` Laravel takes an address that changes between requests. Measured on 15/10/2026: one client's requests were counted in several different rate-limit buckets | Documented as a known limitation; the per-e-mail lockout still applies (Table IV.6). Planned fix: a client-IP header signed with a secret shared by the front end and the API | Open (future work) |

**Table IV.7 — Problems encountered during deployment.** *Source: prepared by the authors.*

The main lesson is methodological: when production behaves differently from the code, the first thing to check is **which version is actually deployed** — the files served by the host, its list of deployments and the status of the commit on GitHub — before debugging the code itself.

### IV.7.7 Monitoring, logging and hosting limits

In production the application writes its logs to standard error (`LOG_CHANNEL=stderr`), which Render and Vercel collect and display in their dashboards; the `/up` health endpoint lets Render detect and restart an unhealthy container; and the in-application **audit log** records every security- and billing-relevant event (IV.5). An optional free uptime monitor on `/up` could alert on outages and keep the service awake.

The free hosting tier has real limits worth stating plainly:

* **Sleep.** The API stops after fifteen minutes without traffic; the next request wakes it, which took 14.5 s in our measurement. Access control stays correct during sleep because it compares the stored period end with the current time on every request, but scheduled tasks (expiry e-mails, VPN revocation, payment reconciliation) only run while the service is awake.
* **Database lifetime.** A free Render PostgreSQL database expires thirty days after its creation and is deleted after a further fourteen-day grace period. Before real use, the database must be moved to a paid plan or backed up and recreated.
* **E-mail.** Render's free tier blocks outbound SMTP. Transactional e-mail in production is therefore planned through the **Brevo** HTTP API (dashed in Figure IV.32); this transport is not yet implemented, so e-mails sent by the live site are not claimed here.
* **Payments.** Chargily runs in **test mode**: the full payment flow works, but no real money is collected until the live keys are configured.

## Conclusion

This chapter presented the implementation and the deployment of the portal. It set out the technology stack and justified a decoupled Next.js / Laravel architecture built as a modular monolith; it described the nine functional modules and walked through the client, administration and support interfaces; and it examined the critical components — security headers and rate limiting, session and Sanctum authentication, the HMAC-signed and idempotent payment flow, and the WireGuard provisioning built on Curve25519 — with excerpts from the source code. Quality is backed by an automated suite of 110 backend tests run by continuous integration, complemented by documented manual security checks. Finally, it described the production deployment on Vercel and Render, the release process, the checks run against the live system and the problems met while deploying, with their solutions.

The chapter has also been explicit about the system's boundaries: live security scans, performance and load tests, dashboard screenshots and an end-to-end payment-and-tunnel demonstration are left as clearly marked items of future work, as are the forwarding of the visitor's real IP address to the API, transactional e-mail in production, the native mobile client and the live VPN gateway operated by the network team. The general conclusion that follows draws together the results of the whole project and its perspectives.

---

## Notes

[^php]: The PHP Group: *PHP Manual*. https://www.php.net/docs.php (consulted on 11/10/2026).
[^laravel]: Laravel: *Laravel 12.x Documentation*. https://laravel.com/docs/12.x (consulted on 11/10/2026).
[^nextjs]: Vercel: *Next.js Documentation*. https://nextjs.org/docs (consulted on 11/10/2026).
[^react]: Meta Open Source: *React Documentation*. https://react.dev/ (consulted on 11/10/2026).
[^typescript]: Microsoft: *TypeScript Documentation*. https://www.typescriptlang.org/docs/ (consulted on 11/10/2026).
[^tailwind]: Tailwind Labs: *Tailwind CSS Documentation*. https://tailwindcss.com/docs (consulted on 11/10/2026).
[^sqlite]: SQLite: *About SQLite*. https://www.sqlite.org/about.html (consulted on 11/10/2026).
[^postgresql]: The PostgreSQL Global Development Group: *PostgreSQL Documentation*. https://www.postgresql.org/docs/ (consulted on 11/10/2026).
[^sanctum]: Laravel: *Laravel Sanctum Documentation*. https://laravel.com/docs/12.x/sanctum (consulted on 11/10/2026).
[^chargily4]: Chargily: *Chargily Pay — Developer Documentation (v2)*. https://dev.chargily.com/ (consulted on 10/10/2026).
[^wgproto4]: WireGuard: *Protocol & Cryptography* (official protocol page). https://www.wireguard.com/protocol/ (consulted on 11/10/2026).
[^wgquick]: WireGuard: *Quick Start* (`wg genkey` / `wg pubkey`). https://www.wireguard.com/quickstart/ (consulted on 11/10/2026).
[^phpunit]: BERGMANN (Sebastian): *PHPUnit Documentation*. https://docs.phpunit.de/ (consulted on 11/10/2026).
[^playwright]: Microsoft: *Playwright Documentation*. https://playwright.dev/ (consulted on 11/10/2026).
[^plantuml]: PlantUML: *PlantUML Language Reference Guide*. https://plantuml.com/ (consulted on 11/10/2026).
[^mermaid]: Mermaid: *Mermaid Documentation*. https://mermaid.js.org/ (consulted on 11/10/2026).
[^githubactions]: GitHub: *GitHub Actions Documentation*. https://docs.github.com/actions (consulted on 11/10/2026).
