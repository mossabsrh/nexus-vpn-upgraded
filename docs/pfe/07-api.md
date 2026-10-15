# 07 — API et contrat frontend ↔ backend

> Audit de référence du 2026-10-05 (étape 3/4). Sources : `nexus-vpn/routes/api.php`, `php artisan route:list --except-vendor --path=api` (48 routes), contrôleurs `app/Http/Controllers/Api/*`, et appels `apiFetch` du frontend.
> Architecture de chaque côté : voir `04-frontend.md` (client `lib/api.ts`, `proxy.ts`) et `05-backend.md` (contrôleurs, workflows). Schéma : `06-database.md`.

## 1. Flux général d'une requête

```
Navigateur ──fetch("/backend-api/xxx", credentials: include)──▶ Next.js (Vercel)
   Next.js : rewrite /backend-api/:path* ──▶ {NEXT_PUBLIC_API_URL}/api/:path*
   Laravel (Render) : middleware (SecurityHeaders, web/session/CSRF, throttle, auth, admin)
                      ──▶ contrôleur ──▶ modèles / base PostgreSQL / Chargily
   ◀── réponse JSON (ou fichier texte pour /vpn/config) relayée telle quelle au navigateur
```

* Le navigateur ne voit qu'**une seule origine** (celle du frontend) : les cookies de session (nom `<APP_NAME en slug>_session`, donc `laravel_session` en production puisque `render.yaml` ne définit pas `APP_NAME` ; configurable par `SESSION_COOKIE`) et `XSRF-TOKEN` sont des cookies de première partie.
* Exceptions : `proxy.ts` (côté serveur Next.js) appelle directement `{NEXT_PUBLIC_API_URL}/api/me` en transmettant le cookie ; Chargily appelle directement le webhook Laravel.
* Conventions : corps et réponses en JSON (`Accept: application/json`) ; champs de **requête en snake_case** (`plan_slug`, `current_password`), champs de **réponse majoritairement en camelCase** (`planId`, `currentPeriodEnd`), sauf exceptions signalées au §13.
* Pagination (listes) : `{ <liste>: [...], meta: { currentPage, lastPage, perPage, total } }` (10 éléments pour le compte, 20 ou 30 pour l'admin).

## 2. Flux CSRF

1. Avant toute requête modifiante (POST/PUT/PATCH/DELETE), `apiFetch` vérifie la présence du cookie `XSRF-TOKEN` ; s'il manque, il appelle `GET /backend-api/csrf-cookie` (route Laravel du groupe `web`, réponse 204) qui pose le cookie. Les appels simultanés partagent une seule requête.
2. La valeur décodée du cookie est envoyée dans l'en-tête `X-XSRF-TOKEN` ; le middleware CSRF de Laravel la compare au jeton de session.
3. En cas de **419** (jeton expiré, ex. session renouvelée), `apiFetch` force un nouveau `csrf-cookie` et **rejoue la requête une seule fois**.
4. Après connexion, inscription et déconnexion, Laravel régénère la session et le jeton ; le cookie `XSRF-TOKEN` est mis à jour par la réponse.
5. Les routes publiques `GET pricing`, `GET testimonials` et le webhook sont hors du groupe `web` (pas de session ni de CSRF).

## 3. Conventions d'erreur

| Code | Origine côté Laravel | Corps | Traitement côté frontend |
|---|---|---|---|
| 401 | Middleware `auth` (session absente/expirée) ; mauvais identifiants au login | `{ message: "Unauthenticated." }` ; login : `{ success: false, error }` | `AuthProvider` : `/me` → statut `guest` ; `proxy.ts` → redirection `/` ; `payment-dialog` : message « Sign in before subscribing » ; ailleurs, message générique via `apiErrorMessage`. Pas d'intercepteur global qui déconnecte l'utilisateur. |
| 403 | Middleware `admin`, `ownedTeam()`, signature invalide, e-mail non vérifié | `{ message }` ; e-mail non vérifié : `{ message, code: "email_unverified" }` | `payment-dialog` affiche un bouton « Resend verification email » sur `code === "email_unverified"` ; sinon message de `apiErrorMessage`. |
| 404 | Ressource inexistante **ou appartenant à un autre utilisateur** (`abort_unless(..., 404)`, pour ne pas révéler son existence) ; checkout inconnu | `{ message }` | Page résultat de paiement : message dédié (« sign in with the account that paid »). |
| 409 | Conflit métier (essai déjà utilisé, rien à annuler, sièges pleins, remboursement impossible…) | `{ message }` ou `{ success: false, message, user? }` | Message affiché ; `startTrial` met à jour l'utilisateur si `user` est renvoyé. |
| 419 | Jeton CSRF absent/expiré | `{ message: "CSRF token mismatch." }` | `apiFetch` : nouveau jeton + 1 rejeu ; `/me` → `guest` ; `proxy.ts` → redirection. |
| 422 | Validation (`$request->validate()`) ; règles métier simples | `{ message, errors: { champ: [messages] } }` ; métier : `{ message }` ou `{ success: false, message }` | `apiErrorMessage` retourne la **première** erreur de validation, sinon `message`, sinon `error`. |
| 429 | Limiteurs nommés (voir `08-authentication-security.md`) ; verrou de login ; 1 témoignage en attente | `{ message: "Too Many Attempts." }` (+ en-tête `Retry-After`) ; login : `{ success: false, error }` | Messages dédiés dans `payment-dialog`, `contact-section`, `reset-password` ; ailleurs `apiErrorMessage`. |
| 500 | Exception non gérée (rendue en JSON pour `api/*`, sans détails en production) ; échec d'inscription | `{ message: "Server Error" }` ; inscription : `{ success: false, error }` | Message générique ; `/me` en erreur → statut `error` avec bouton « Try again ». |
| 502 / 503 | Chargily injoignable/refus (502) ; clé Chargily ou serveur VPN non configurés (503) | `{ success: false, message }` / `{ message }` | Message affiché. |

Erreurs réseau et délais dépassés (`AbortError`) : convertis en messages lisibles dans `auth-provider.tsx` ; en revanche `downloadConfig` et `teamRequest` de `app/dashboard/page.tsx` n'ont pas de `catch` (une erreur réseau y produit une promesse rejetée non gérée).

## 4. Authentification

| Endpoint (frontend → Laravel) | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `GET /backend-api/csrf-cookie` → `GET /api/csrf-cookie` | Closure | public, `api` | — | 204 + cookie `XSRF-TOKEN` | `lib/api.ts` (`ensureCsrfCookie`) |
| `POST …/auth/register` → `/api/auth/register` | `AuthController@register` | invité, `register` | `name` (requis, ≤255), `email` (e-mail unique, normalisé en minuscules), `password` + `password_confirmation` (`Password::defaults()`), `plan_slug` (plan actif existant, self-serve) | 201 `{ success, user, message }` ; 422 ; 500 `{ success:false, error }` | `components/auth-provider.tsx` (`signup`, via `auth-dialog.tsx`) |
| `POST …/auth/login` | `AuthController@login` | invité, `login` + verrou 5 échecs | `email`, `password` | 200 `{ success, user, message }` ; 401/429 `{ success:false, error }` | `auth-provider.tsx` (`login`) |
| `POST …/auth/logout` | `AuthController@logout` | `auth` | — | 200 `{ message }` | `auth-provider.tsx` (`logout`) |
| `GET …/me` | `AuthController@me` | `auth` | — | 200 `{ user }` (voir objet `user` ci-dessous) ; 401 | `auth-provider.tsx` (`fetchSession`) ; `proxy.ts` (direct, côté serveur) |
| `POST …/auth/forgot-password` | `AuthController@forgotPassword` | public, `password-reset` | `email` | 200 `{ message }` identique que le compte existe ou non ; 429 | `components/auth-dialog.tsx` (mode « forgot ») |
| `POST …/auth/reset-password` | `AuthController@resetPassword` | public, `password-reset` | `token`, `email`, `password` + `password_confirmation` | 200 `{ message }` ; 422 `{ message }` (lien invalide/expiré) | `app/reset-password/page.tsx` |
| `GET …/email/verify/{id}/{hash}?expires&signature` | `AuthController@verifyEmail` | public, `signed:relative`, `verification` | paramètres d'URL signés | 200 `{ message, verified: true }` ; 403 (signature ou hash invalide) | `app/verify-email/page.tsx` |
| `POST …/email/verification-notification` | `AuthController@resendVerification` | `auth`, `verification` | — | 200 `{ message }` | `auth-provider.tsx` (`resendVerification`, utilisé par dashboard, payment-dialog, verify-email) |

**Objet `user`** (`AuthController::userPayload`), renvoyé par `register`, `login`, `me` et plusieurs endpoints d'abonnement/paiement : `id`, `name`, `email`, `role` (`user`|`admin`), `emailVerified`, `planId` (slug du plan courant), `subscriptionStatus`, `lastPlanId`, `subscription` (objet abonnement, voir §6), `hasVpnAccess`, `team` (`{ id, name, isOwner }` ou `null`). Typé côté frontend par `AuthUser` (`auth-provider.tsx`).

## 4bis. API mobile (application Flutter — jetons Sanctum)

> Ajoutée le 2026-10-07 pour l'application mobile (décision D-15 du mémoire). **Le flux web décrit ci-dessus est inchangé.**

L'application mobile n'utilise ni cookie de session ni CSRF. Elle s'authentifie avec un **jeton personnel Laravel Sanctum** envoyé dans l'en-tête `Authorization: Bearer <token>`. Les routes sont préfixées `/api/mobile/` et vivent **hors du groupe `web`** (donc sans session ni CSRF). L'administration n'est **pas** exposée ici : elle reste sur le site web.

- **Jeton** : émis par `login` et `register`, renvoyé dans le champ `token`. Durée de vie : `SANCTUM_TOKEN_EXPIRATION` minutes (défaut 30 jours, `config/sanctum.php`). L'application le conserve dans le stockage sécurisé de l'appareil et l'attache à chaque requête.
- **Révocation** : la déconnexion révoque le jeton courant ; le changement de mot de passe révoque les autres jetons du compte ; la suppression de compte révoque tous les jetons.
- Le verrou par compte (5 échecs → 429) et les limiteurs nommés (`login`, `register`, `account`, `checkout`, `vpn`, `trial`, `verification`, `password-reset`) sont **partagés avec le web**.
- Les offres publiques `GET /api/pricing` et `GET /api/testimonials` (déjà hors groupe `web`) sont réutilisées telles quelles par l'application.

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse |
|---|---|---|---|---|
| `POST /api/mobile/auth/register` | `MobileAuthController@register` | public, `register` | `name`, `email`, `password`+`password_confirmation`, `plan_slug` (self-serve), `device_name?` | 201 `{ success, token, user, message }` ; 422 ; 500 |
| `POST /api/mobile/auth/login` | `MobileAuthController@login` | public, `login` + verrou 5 échecs | `email`, `password`, `device_name?` | 200 `{ success, token, user }` ; 401/429 `{ success:false, error }` |
| `POST /api/mobile/auth/logout` | `MobileAuthController@logout` | `auth:sanctum` | — | 200 `{ message }` (jeton courant révoqué) |
| `POST /api/mobile/auth/forgot-password` | `AuthController@forgotPassword` | public, `password-reset` | `email` | 200 `{ message }` (identique que le compte existe ou non) |
| `POST /api/mobile/auth/reset-password` | `AuthController@resetPassword` | public, `password-reset` | `token`, `email`, `password`+`password_confirmation` | 200 ; 422 |
| `GET /api/mobile/me` | `AuthController@me` | `auth:sanctum` | — | 200 `{ user }` (même objet qu'au §4) |
| `POST /api/mobile/email/verification-notification` | `AuthController@resendVerification` | `auth:sanctum`, `verification` | — | 200 `{ message }` |
| `PUT /api/mobile/account/email` | `AuthController@updateEmail` | `auth:sanctum`, `account` | `current_password`, `email` | 200 `{ user }` ; 422 |
| `PUT /api/mobile/account/password` | `AuthController@updatePassword` | `auth:sanctum`, `account` | `current_password`, `password` | 200 `{ message }` (autres jetons révoqués) ; 422 |
| `DELETE /api/mobile/account` | `AuthController@deleteAccount` | `auth:sanctum`, `account` | `current_password` | 200 (tous jetons révoqués) ; 409 ; 422 |
| `GET /api/mobile/account/subscriptions` | `AccountController@subscriptions` | `auth:sanctum` | — | `{ subscriptions, meta }` |
| `GET /api/mobile/account/payments` | `AccountController@payments` | `auth:sanctum` | — | `{ payments, meta }` |
| `GET /api/mobile/account/payments/{payment}` | `AccountController@payment` | `auth:sanctum`, propriétaire (sinon 404) | — | `{ payment, customer }` |
| `GET /api/mobile/vpn/credentials` | `AccountController@vpnStatus` | `auth:sanctum` | — | `{ hasAccess, emailVerified, serverConfigured, credential }` |
| `GET /api/mobile/vpn/config` | `AccountController@vpnConfig` | `auth:sanctum`, `vpn` | — | fichier `.conf` (texte) ; 403 (accès/e-mail) ; 503 (serveur non configuré) |
| `POST /api/mobile/checkout` | `PaymentController@createCheckout` | `auth:sanctum`, `checkout` | `plan_id`\|`plan_slug`, `billing_period?` | 200 `{ checkout_url, payment_id, … }` (**Chargily réel**) ; 403 e-mail non vérifié ; 502/503 |
| `GET /api/mobile/payments/{payment}/verify` | `PaymentController@verifyPayment` | `auth:sanctum`, propriétaire | — | `{ status, payment, user }` |
| `POST /api/mobile/subscriptions/trial` | `PaymentController@startTrial` | `auth:sanctum`, `trial` | `plan_slug` | 200 ; 409 |
| `POST /api/mobile/subscriptions/cancel` | `PaymentController@cancelSubscription` | `auth:sanctum` | — | 200 ; 409 |

## 5. Compte

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `PUT …/account/email` | `AuthController@updateEmail` | `auth`, `account` | `current_password`, `email` (unique) | 200 `{ user }` (e-mail à revérifier) ; 422 | `auth-provider.tsx` (`updateEmail`, via `account-menu.tsx`) |
| `PUT …/account/password` | `AuthController@updatePassword` | `auth`, `account` | `current_password`, `password` (`Password::defaults()`, **sans confirmation côté serveur**) | 200 `{ message }` ; 422 | `auth-provider.tsx` (`updatePassword`, via `account-menu.tsx`, qui vérifie la confirmation côté client) |
| `DELETE …/account` | `AuthController@deleteAccount` | `auth`, `account` | `current_password` | 200 `{ success, message }` (données personnelles anonymisées, utilisateur en *soft delete*, session détruite) ; 422 (mot de passe) ; 409 `admin_account` / `team_owner` | `auth-provider.tsx` (`deleteAccount`, via `account-menu.tsx` — zone de danger, confirmation par mot de passe + saisie de l'e-mail) |
| `GET …/account/subscriptions?page` | `AccountController@subscriptions` | `auth` | — | `{ subscriptions: [abonnement], meta }` | `app/dashboard/page.tsx` (`loadAll`) |
| `GET …/account/payments?page` | `AccountController@payments` | `auth` | — | `{ payments: [paiement], meta }` | `app/dashboard/page.tsx` (`loadPayments`) |
| `GET …/account/payments/{payment}` | `AccountController@payment` | `auth`, propriétaire (sinon 404) | — | `{ payment, customer: { name, email } }` | **Non appelé par le frontend** |

## 6. Plans, essai et abonnement

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `GET …/pricing` | `PricingController@index` | public (hors session), `api` ; cache serveur 10 min + `Cache-Control: public, max-age=60` | — | `{ plans: [{ slug, name, description, monthlyPrice, yearlyPrice, yearlyTotal, currency, features[], popular, cta, selfServe }] }` | `hooks/use-pricing.ts` (utilisé par `pricing-section.tsx` et `auth-dialog.tsx`) |
| `POST …/subscriptions/trial` | `PaymentController@startTrial` | `auth`, `trial` | `plan_slug` (plan actif) | 200 `{ success, user, subscription }` ; 409 (déjà eu un abonnement) `{ success:false, message, user }` ; 422 (plan non self-serve) | `auth-provider.tsx` (`startTrial`, via `pricing-section.tsx`) |
| `POST …/subscriptions/cancel` | `PaymentController@cancelSubscription` | `auth` | — | 200 `{ success, subscription, user, message }` ; 409 (rien à annuler / abonnement Team) | `auth-provider.tsx` (`cancelSubscription`, via `account-menu.tsx`) |

**Objet abonnement** (`Subscription::toApiArray`) : `id`, `planId`, `planName`, `status`, `billingPeriod`, `seats`, `startedAt`, `trialEndsAt`, `currentPeriodEnd`, `canceledAt`, `grantsAccess`, `createdAt` (dates ISO 8601).

## 7. Paiement (Chargily)

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `POST …/checkout` | `PaymentController@createCheckout` | `auth`, `checkout`, e-mail vérifié | `plan_slug` **ou** `plan_id` (plan actif), `billing_period` (`monthly`\|`yearly`, défaut `monthly`). Le montant n'est **jamais** lu depuis le client. | 200 `{ success, status, checkout_id, checkout_url, payment_id, message }` (**snake_case**) ; 403 `email_unverified` ; 422 (plan non achetable) ; 502 ; 503 | `components/payment-dialog.tsx` (redirection `window.location.assign(checkout_url)`) |
| `GET …/payments/{payment}/verify` | `PaymentController@verifyPayment` | `auth`, propriétaire (sinon 404) | — | 200 `{ success, status, payment, user }` ; 502/503 | `app/payment/result/page.tsx` (jusqu'à 6 essais, 3 s d'intervalle) |
| `GET …/checkout/{checkoutId}/verify` | `PaymentController@verify` | `auth`, propriétaire | — | idem, 404 `{ success:false, message }` | **Non appelé par le frontend** (le frontend vérifie par id interne ; les URL de retour Chargily portent `?payment={id}`) |

**Objet paiement** (`Payment::toApiArray`) : `id`, `reference` (`pay_<uuid>`), `amount`, `currency`, `status` (`pending`|`succeeded`|`failed`|`refunded`), `planId`, `planName`, `billingPeriod`, `provider`, `checkoutId`, `subscriptionId`, `failureReason`, `paidAt`, `refundedAt`, `refundReason`, `createdAt`.

## 8. VPN

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `GET …/vpn/credentials` | `AccountController@vpnStatus` | `auth` | — | `{ hasAccess, emailVerified, serverConfigured, credential: { publicKey, address, issuedAt } \| null }` | `app/dashboard/page.tsx` (`loadAll`, après téléchargement) |
| `GET …/vpn/config` | `AccountController@vpnConfig` | `auth`, `vpn` ; accès actif + e-mail vérifié + serveur configuré | — | 200 **`text/plain`** (fichier `nexusvpn.conf`, `Content-Disposition: attachment`, `Cache-Control: no-store`) ; 403 `{ message[, code] }` ; 503 | `app/dashboard/page.tsx` (`downloadConfig`, téléchargement via `Blob`) |

## 9. Équipe

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `GET …/team` | `TeamController@show` | `auth` | — | `{ team: null \| { id, name, ownerId, seats, seatsUsed, subscription, members? } }` (`members` réservé au propriétaire) | `app/dashboard/page.tsx` (`loadAll`) |
| `PATCH …/team` | `TeamController@update` | `auth`, propriétaire (403) | `name` (≤150) | `{ team }` | **Non appelé par le frontend** |
| `POST …/team/members` | `TeamController@addMember` | `auth`, propriétaire | `email` (compte existant) | 201 `{ team }` ; 404 (aucun compte) ; 409 (déjà membre, sièges pleins, abonnement inactif) | `app/dashboard/page.tsx` (`teamRequest`) |
| `DELETE …/team/members/{member}` | `TeamController@removeMember` | `auth`, propriétaire | — | 200 `{ team }` ; 404 ; 422 (propriétaire) | `app/dashboard/page.tsx` (`teamRequest`) |

## 10. Contenu public : témoignages et contact

| Endpoint | Contrôleur | Accès / limiteur | Requête | Réponse | Appelant frontend |
|---|---|---|---|---|---|
| `GET …/testimonials?per_page` | `TestimonialController@index` | public (hors session), `api` | `per_page` (1–50, défaut 12) | `{ testimonials: [{ id, content, name, status, createdAt }], meta: { currentPage, lastPage, total } }` (approuvés seulement) | `components/testimonials-section.tsx` |
| `POST …/testimonials` | `TestimonialController@store` | `auth`, `testimonials` (3/h) | `content` (10–1000) | 201 `{ testimonial, message }` ; 429 si un témoignage est déjà en attente | `components/testimonials-section.tsx` |
| `POST …/contact` | `ContactController@store` | public (session facultative), `contact` | `name` (≤150), `email`, `company?`, `seats?` (1–10000), `message` (10–2000) | 201 `{ message }` | `components/contact-section.tsx` |

## 11. Administration (`/api/admin/*`, middleware `auth` + `admin`)

| Endpoint | Contrôleur | Requête (principaux champs) | Réponse | Appelant frontend |
|---|---|---|---|---|
| `GET …/admin/stats` | `AdminBillingController@stats` | — | `{ users: {...signupsByDay}, subscriptions: {...byPlan, trialConversionRate}, revenue: {...byMonth}, payments: {status: count} }` | `components/admin/stats.tsx` (`useAdminStats` : `OverviewSection`, `AnalyticsSection`, `SubscriptionMetrics`) |
| `GET …/admin/users` | `AdminController@users` | `q`, `role`, `subscription` (`active`\|`trialing`\|`none`), `per_page` (5–100) | `{ users: [{ id, name, email, role, emailVerified, created_at, subscription }], meta }` | `components/admin/accounts.tsx` (`AccountsSection`) |
| `PATCH …/admin/users/{user}` | `AdminController@updateUser` | `name?`, `email?`, `role?` ; refuse de retirer son propre rôle admin (422) | `{ user }` (modèle brut, snake_case) | `accounts.tsx` (la réponse est ignorée ; la liste est mise à jour localement) |
| `DELETE …/admin/users/{user}` | `AdminController@destroyUser` | — (admin only) ; réutilise la logique de `DELETE /api/account` (anonymisation + soft delete, abonnement annulé, VPN révoqué, historique conservé) ; refus (422) de supprimer le dernier administrateur, soi-même, ou un propriétaire d'équipe ; action tracée (`account.deleted`, acteur = admin) | `{ message }` | `accounts.tsx` (bouton Supprimer + confirmation, puis rechargement de la liste) |
| `GET …/admin/plans` | `AdminController@plans` | `per_page` | `{ plans: [modèle Plan brut + active_subscriptions_count], meta }` (snake_case) | `components/admin/offers.tsx` (`OffersSection`) |
| `POST …/admin/plans` / `PATCH …/admin/plans/{plan}` | `AdminController@storePlan` / `@updatePlan` | `slug` (unique, `[a-z0-9-]`), `name`, `description?`, `monthly_price?`, `yearly_price?`, `yearly_total?` (entiers ≥0), `currency` (`DZD`), `features[]`, `popular`, `cta?`, `is_active?` | 201 / 200 `{ plan }` ; invalide le cache `/pricing` | `offers.tsx` (création, modification, activation/désactivation) |
| `DELETE …/admin/plans/{plan}` | `AdminController@destroyPlan` | — | 200 `{ message }` ; 409 si le plan a des abonnements | `offers.tsx` |
| `GET …/admin/testimonials` | `AdminController@testimonials` | `status` | `{ testimonials: [...], meta, pendingCount }` | `components/admin/moderation.tsx` (`TestimonialsModeration`) |
| `PATCH …/admin/testimonials/{t}` / `DELETE` | `AdminController@moderateTestimonial` / `@destroyTestimonial` | `status` (`approved`\|`rejected`) | `{ testimonial: { id, status } }` / `{ message }` | `moderation.tsx` |
| `GET …/admin/audit-logs` | `AdminController@auditLogs` | `action` (préfixe) | `{ logs: [{ id, action, subjectType, subjectId, metadata, actor, ipAddress, createdAt }], meta }` | `moderation.tsx` (`AuditLogSection`) |
| `GET …/admin/contact-requests` | `ContactController@index` | `status` (`new`\|`handled`) | `{ requests: [...], meta, newCount }` | `components/admin/billing.tsx` (`ContactRequests`, dans `SubscriptionsSection`) |
| `PATCH …/admin/contact-requests/{r}` | `ContactController@update` | `status` | `{ request }` | `billing.tsx` (`ContactRequests`) |
| `GET …/admin/payments` | `AdminBillingController@payments` | `status`, `q` (e-mail) | `{ payments: [paiement + errorCode + user], meta }` | `billing.tsx` (`PaymentsSection`) |
| `POST …/admin/payments/{p}/refund` | `AdminBillingController@refund` | `reason` (≤255), `end_subscription?` (défaut `true`) | `{ payment }` ; 409 si le paiement n'est pas `succeeded` | `billing.tsx` (`PaymentsSection`) |
| `GET …/admin/subscriptions` | `AdminBillingController@subscriptions` | `status`, `plan` | `{ subscriptions: [abonnement + user, teamName, paidPayments], meta }` | `billing.tsx` (`SubscriptionsSection`) |
| `POST …/admin/subscriptions/team` | `AdminBillingController@createTeamSubscription` | `email` (compte existant), `plan_slug`, `team_name`, `seats` (2–500), `months` (1–36) | 201 `{ team }` ; 409 si abonnement courant | `billing.tsx` (`TeamProvisioning`) |
| `POST …/admin/subscriptions/{s}/cancel` | `AdminBillingController@cancelSubscription` | — | `{ subscription }` ; 409 si inactif | `billing.tsx` (`SubscriptionsSection`) |

Toute requête d'un non-admin reçoit 403 ; sans session, 401.

## 12. Webhook

| Endpoint | Contrôleur | Accès | Requête | Réponse | Appelant |
|---|---|---|---|---|---|
| `POST /api/webhooks/chargily` (appel direct sur le domaine Laravel, pas via `/backend-api`) | `PaymentController@webhook` | public, hors session/CSRF, `webhooks` (120/min), **signature HMAC-SHA256** dans l'en-tête `signature` | corps JSON Chargily `{ type, data: { id, status, amount, ... } }` ; événements traités : `checkout.paid`, `checkout.failed`, `checkout.canceled`, `checkout.expired` | 200 `{ status: "success" \| "ignored" }` ; 400 (signature absente, corps invalide) ; 403 (signature invalide) ; 404 (checkout inconnu → Chargily réessaie) | **Chargily** (service externe), pas le frontend |

Détails de vérification et d'idempotence : `08-authentication-security.md` §7.

## 13. Endpoints non appelés et incohérences de contrat

### 13.1 Endpoints non appelés par le frontend (confirmé par recherche dans `app/`, `components/`, `hooks/`, `lib/`)

| Endpoint | Remarque |
|---|---|
| `GET /api/account/payments/{payment}` | Reçu d'un paiement : prévu côté API, aucune page de reçu dans le frontend |
| `GET /api/checkout/{checkoutId}/verify` | Doublon de `payments/{id}/verify` (vérification par id Chargily) ; couvert par un test backend |
| `PATCH /api/team` | Renommage d'équipe : aucune interface ; aucun test backend identifié |
| `POST /api/webhooks/chargily` | Normal : appelé par Chargily |

Total : 50 endpoints sous `/api`, dont **3 non utilisés** par le frontend et 1 réservé à Chargily.

### 13.2 Incohérences entre types frontend et réponses backend

* `SubscriptionStatus` (`auth-provider.tsx`) inclut `past_due`, que le backend n'attribue jamais (seulement accepté comme filtre dans `GET /admin/subscriptions`).
* **Casse mixte** : la plupart des réponses sont en camelCase, mais `POST /checkout` (`checkout_url`, `payment_id`…), `GET /admin/users` (`created_at`), `GET/POST/PATCH /admin/plans` et `PATCH /admin/users/{user}` (modèles Eloquent bruts) sont en snake_case. Le frontend s'y est adapté (types `AdminPlan`, `AdminUser`), mais ce n'est pas uniforme.
* Clé d'erreur variable : `error` (login, inscription) ou `message` (reste). `apiErrorMessage` gère les deux.
* `PUT /account/password` n'exige pas `password_confirmation` côté serveur (contrairement à l'inscription et à la réinitialisation) : la confirmation n'est vérifiée que dans le frontend.
* Le frontend envoie toujours `plan_slug` au checkout ; `plan_id` (accepté par le backend) n'est pas utilisé.

## 14. Routes web (hors API)

Seules 3 routes web restent enregistrées dans `routes/web.php` ; **aucune n'est appelée par le frontend Next.js** (qui n'utilise que `/backend-api/*`). Voir `05-backend.md` §6.2 et §10.

| Routes | Contrôleur | Remarque |
|---|---|---|
| `GET /` | Closure | Redirige vers `FRONTEND_URL` |
| `GET /payment/success`, `GET /payment/failed` | Closure | **Utilisées** pour la compatibilité : redirigent les anciens retours Chargily vers `FRONTEND_URL/payment/result?payment={id}` |

Les 22 routes web d'authentification et de profil du starter kit (`register`, `login`, `logout`, `forgot-password`, `reset-password`, `verify-email`, `confirm-password`, `settings/*`, `dashboard`) ont été **supprimées le 2026-10-15** (R-03) : elles répondent désormais `404` (`tests/Feature/Api/LegacyRoutesTest.php`).
