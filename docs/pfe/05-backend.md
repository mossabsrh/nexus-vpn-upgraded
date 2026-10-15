# 05 — Backend (API Laravel `nexus-vpn/`)

> Audit de référence réalisé le 2026-10-05 (étape 1/4 : backend uniquement).
> Sources : code de `nexus-vpn/`, `php artisan route:list --except-vendor`, `php artisan db:table` / `db:show`.
> Le contrat détaillé avec le frontend (quelle page appelle quel endpoint) sera documenté à l'étape 3 dans `07-api.md`.

## 1. Rôle et architecture générale

Le backend est une **API REST JSON** développée avec **Laravel 12** (PHP ^8.2). Il ne génère pas l'interface utilisateur réelle : celle-ci est fournie par l'application Next.js (racine du dépôt), qui appelle l'API via le préfixe `/backend-api` (réécriture Next.js décrite dans `04-frontend.md` §7 et `07-api.md` §1).

Responsabilités du backend :

* authentification par **session (cookie)** + protection CSRF ;
* gestion des **offres** (plans), **essais gratuits** de 7 jours et **abonnements** ;
* **paiement en ligne via Chargily Pay v2** (création de checkout, webhook signé HMAC, vérification) ;
* **provisionnement VPN WireGuard** (génération de paires de clés, attribution d'adresses tunnel, génération du fichier `.conf`) ;
* **équipes** (offre Team vendue par l'équipe commerciale, gestion des sièges) ;
* **témoignages** modérés, **demandes de contact** commerciales ;
* **administration** (utilisateurs, plans, facturation, statistiques, journal d'audit) ;
* tâches planifiées (expiration des abonnements, rappels par e-mail).

Organisation du code (structure standard Laravel 12 « streamlined ») :

| Élément | Emplacement |
|---|---|
| Configuration middleware / routage / exceptions | `bootstrap/app.php` |
| Fournisseur de services (rate limiting, liens e-mail, garde-fous production) | `app/Providers/AppServiceProvider.php` |
| Contrôleurs de l'API réelle | `app/Http/Controllers/Api/` |
| Modèles Eloquent (logique métier) | `app/Models/` |
| Service Chargily (appels API, signature, règles de statut) | `app/Services/ChargilyGateway.php` |
| Commandes Artisan | `app/Console/Commands/` |
| Notifications e-mail | `app/Notifications/` |
| Routes API | `routes/api.php` |
| Planification | `routes/console.php` |

**Choix de conception notable** : la logique métier est portée en majorité par les **modèles** (ex. `Payment::markSucceeded()`, `Subscription::cancel()`, `VpnCredential::issueFor()`). La seule couche `app/Services/` est `ChargilyGateway` (depuis le 2026-10-06), qui regroupe les appels à l'API Chargily, la vérification HMAC du webhook et les règles de statut, réutilisée par `PaymentController` et la commande `payments:reconcile`. Les contrôleurs valident les entrées, appellent ces méthodes et formatent les réponses. La sérialisation JSON est faite par des méthodes `toApiArray()` sur les modèles (pas d'Eloquent API Resources). Les clés JSON sont en **camelCase** (`planId`, `currentPeriodEnd`…).

## 2. Pipeline des requêtes (middleware)

Configuré dans `bootstrap/app.php` :

* `SecurityHeaders` (global) : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` ; sur `api/*` et `/up` : `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` ; `Strict-Transport-Security` si HTTPS.
* `trustProxies` : activé via la variable `TRUSTED_PROXIES` (les requêtes passent par le proxy Next.js / l'hébergeur ; sans cela, tous les visiteurs partageraient la même IP pour le rate limiting).
* Groupe `web` : session, cookies chiffrés, CSRF, + `HandleInertiaRequests` et `AddLinkHeadersForPreloadedAssets` (hérités du starter kit, voir §10).
* Alias `admin` → `EnsureUserIsAdmin` (renvoie 403 si `user->role !== 'admin'`).
* Exceptions : rendues en JSON pour `api/*` ou si le client attend du JSON.

Les routes API authentifiées sont placées dans le groupe `web` (session + CSRF). Le frontend obtient le cookie `XSRF-TOKEN` via `GET /api/csrf-cookie` et renvoie l'en-tête `X-XSRF-TOKEN`.

## 3. Authentification et autorisation (côté backend)

* **Mécanisme** : garde `web` de Laravel (session stockée en base, table `sessions`, `SESSION_DRIVER=database` par défaut). Pas de Sanctum ni de jetons API.
* **Inscription** (`POST /api/auth/register`) : e-mail normalisé (minuscules), mot de passe `Password::defaults()` + confirmation, `plan_slug` obligatoire (plan actif, non supprimé, *self-serve*). Création de l'utilisateur **et** d'un abonnement `trialing` de 7 jours dans une transaction, connexion, régénération de session, envoi de l'e-mail de vérification et de bienvenue.
* **Connexion** (`POST /api/auth/login`) : throttle par IP (`login`, 10/min) + verrouillage par couple e-mail|IP après 5 échecs (60 s). Les échecs sont journalisés (domaine de l'e-mail seulement).
* **Vérification d'e-mail** : `User implements MustVerifyEmail`. Le lien envoyé pointe vers le frontend (`FRONTEND_URL/verify-email?...`) et contient une signature temporaire (60 min) de la route `api.verification.verify` (middleware `signed:relative`). Fonctionne sans session.
* **Mot de passe oublié / réinitialisation** : réponse identique que le compte existe ou non (anti-énumération) ; le lien pointe vers `FRONTEND_URL/reset-password`. Après réinitialisation, toutes les sessions de l'utilisateur sont supprimées.
* **Changement de mot de passe** : exige `current_password`, supprime les autres sessions.
* **Changement d'e-mail** : exige `current_password`, remet `email_verified_at` à `null` et renvoie un e-mail de vérification.
* **Autorisation** :
  * rôle simple `users.role` ∈ {`user`, `admin`} ; middleware `admin` sur `/api/admin/*` ;
  * contrôles de propriété dans les contrôleurs (`abort_unless($payment->user_id === $user->id, 404)`), propriétaire d'équipe (`ownedTeam()` → 403) ;
  * **aucune Policy ni Gate** n'est définie ; **aucune FormRequest** n'est utilisée par l'API (validation inline `$request->validate()`). Les seules FormRequests (`LoginRequest`, `ProfileUpdateRequest`) appartiennent au code hérité.
  * Un admin ne peut pas retirer son propre rôle admin. Attribution du rôle admin en ligne de commande : `php artisan admin:grant {email}`.
* **Achat** : `POST /api/checkout` et le téléchargement de la configuration VPN exigent un e-mail vérifié.

## 4. Limitation de débit (rate limiting)

Définie dans `AppServiceProvider::configureRateLimiting()` (clé = id utilisateur sinon IP, sauf mention) :

| Limiteur | Limite | Utilisé par |
|---|---|---|
| `api` | 120/min | toutes les routes API |
| `login` | 10/min par IP | `auth/login` (+ verrou 5 échecs e-mail\|IP dans le contrôleur) |
| `register` | 3/min et 20/jour par IP | `auth/register` |
| `password-reset` | 3/min par IP, 10/h par e-mail\|IP | `auth/forgot-password`, `auth/reset-password` |
| `account` | 6/min | `account/email`, `account/password` |
| `verification` | 6/min | renvoi et vérification d'e-mail |
| `checkout` | 5/min et 30/jour | `checkout` |
| `trial` | 3/min | `subscriptions/trial` |
| `testimonials` | 3/h | `POST testimonials` (+ 1 témoignage en attente max par utilisateur) |
| `vpn` | 10/min | `vpn/config` |
| `contact` | 2/min et 10/jour par IP | `contact` |
| `webhooks` | 120/min par IP | `webhooks/chargily` |

## 5. Contrôleurs de l'API (`app/Http/Controllers/Api/`)

| Contrôleur | Responsabilité |
|---|---|
| `AuthController` | Inscription (+ essai), connexion, déconnexion, `me`, mot de passe oublié/réinitialisation, vérification d'e-mail, changement d'e-mail/mot de passe, suppression de compte. Expose `userPayload()` (profil + abonnement courant + accès VPN + équipe), réutilisé par d'autres contrôleurs. `updatePassword`/`deleteAccount` gèrent à la fois la session web et les jetons mobiles (gardes `hasSession()` + révocation de jetons). |
| `MobileAuthController` | Variante **mobile** de l'authentification : connexion, inscription (+ essai) et déconnexion émettant/révoquant un **jeton Sanctum** (sans session ni CSRF). Réutilise le verrou par compte et `AuthController::userPayload()`. Ajouté le 2026-10-07 (D-15). |
| `PaymentController` | Création du checkout Chargily, vérification post-paiement (par id de paiement ou id de checkout), webhook Chargily, démarrage d'essai, annulation par l'utilisateur. |
| `AccountController` | Historique paginé des abonnements et paiements, reçu d'un paiement, état VPN (`vpn/credentials`), téléchargement du fichier WireGuard (`vpn/config`). |
| `TeamController` | Consultation de l'équipe (la liste des membres n'est visible que par le propriétaire), renommage, ajout/retrait de membres dans la limite des sièges (verrou `lockForUpdate`). Le retrait révoque le VPN du membre s'il n'a plus d'accès. |
| `PricingController` | Liste publique des plans actifs, mise en cache 10 min (`pricing.plans`) et invalidée à chaque modification admin d'un plan. |
| `TestimonialController` | Liste publique des témoignages approuvés ; dépôt d'un témoignage (statut `pending`). |
| `ContactController` | Dépôt public d'une demande commerciale (offre Team) ; liste et traitement côté admin. |
| `AdminController` | Utilisateurs (recherche, filtres, modification nom/e-mail/rôle), CRUD des plans (suppression refusée si le plan a un historique → désactivation), modération des témoignages, journal d'audit. |
| `AdminBillingController` | Statistiques (utilisateurs, abonnements, conversion des essais, revenus par mois), liste des paiements et abonnements, enregistrement d'un remboursement, création d'un abonnement Team, annulation immédiate d'un abonnement. |

## 6. Routes

Liste obtenue par `php artisan route:list --except-vendor` (73 routes au total : 48 sous `/api` et 25 routes web ; la route de santé `/up` est enregistrée par le framework et n'apparaît pas avec `--except-vendor`).

### 6.1 Routes API réelles (`routes/api.php`)

Préfixe `/api`. « web » = session + CSRF. Toutes ont aussi `throttle:api`.

| Méthode | Chemin | Contrôleur@méthode | Middleware |
|---|---|---|---|
| GET | `pricing` | `PricingController@index` | public (sans session) |
| GET | `testimonials` | `TestimonialController@index` | public (sans session) |
| POST | `webhooks/chargily` | `PaymentController@webhook` | `throttle:webhooks`, sans session ni CSRF, HMAC |
| GET | `csrf-cookie` | Closure (204) | web |
| POST | `contact` | `ContactController@store` | web, `throttle:contact` |
| POST | `auth/register` | `AuthController@register` | web, `throttle:register` |
| POST | `auth/login` | `AuthController@login` | web, `throttle:login` |
| POST | `auth/logout` | `AuthController@logout` | web, auth |
| POST | `auth/forgot-password` | `AuthController@forgotPassword` | web, `throttle:password-reset` |
| POST | `auth/reset-password` | `AuthController@resetPassword` | web, `throttle:password-reset` |
| GET | `email/verify/{id}/{hash}` | `AuthController@verifyEmail` | web, `signed:relative`, `throttle:verification` |
| GET | `me` | `AuthController@me` | web, auth |
| POST | `email/verification-notification` | `AuthController@resendVerification` | web, auth, `throttle:verification` |
| PUT | `account/email` | `AuthController@updateEmail` | web, auth, `throttle:account` |
| PUT | `account/password` | `AuthController@updatePassword` | web, auth, `throttle:account` |
| DELETE | `account` | `AuthController@deleteAccount` | web, auth, `throttle:account` |
| GET | `account/subscriptions` | `AccountController@subscriptions` | web, auth |
| GET | `account/payments` | `AccountController@payments` | web, auth |
| GET | `account/payments/{payment}` | `AccountController@payment` | web, auth (propriétaire) |
| GET | `vpn/credentials` | `AccountController@vpnStatus` | web, auth |
| GET | `vpn/config` | `AccountController@vpnConfig` | web, auth, `throttle:vpn` |
| POST | `testimonials` | `TestimonialController@store` | web, auth, `throttle:testimonials` |
| POST | `checkout` | `PaymentController@createCheckout` | web, auth, `throttle:checkout` |
| GET | `payments/{payment}/verify` | `PaymentController@verifyPayment` | web, auth (propriétaire) |
| GET | `checkout/{checkoutId}/verify` | `PaymentController@verify` | web, auth (propriétaire) |
| POST | `subscriptions/trial` | `PaymentController@startTrial` | web, auth, `throttle:trial` |
| POST | `subscriptions/cancel` | `PaymentController@cancelSubscription` | web, auth |
| GET / PATCH | `team` | `TeamController@show` / `@update` | web, auth |
| POST | `team/members` | `TeamController@addMember` | web, auth (propriétaire) |
| DELETE | `team/members/{member}` | `TeamController@removeMember` | web, auth (propriétaire) |
| GET | `admin/users` | `AdminController@users` | web, auth, admin |
| PATCH | `admin/users/{user}` | `AdminController@updateUser` | web, auth, admin |
| DELETE | `admin/users/{user}` | `AdminController@destroyUser` | web, auth, admin |
| GET / POST | `admin/plans` | `AdminController@plans` / `@storePlan` | web, auth, admin |
| PATCH / DELETE | `admin/plans/{plan}` | `AdminController@updatePlan` / `@destroyPlan` | web, auth, admin |
| GET | `admin/testimonials` | `AdminController@testimonials` | web, auth, admin |
| PATCH / DELETE | `admin/testimonials/{testimonial}` | `AdminController@moderateTestimonial` / `@destroyTestimonial` | web, auth, admin |
| GET | `admin/audit-logs` | `AdminController@auditLogs` | web, auth, admin |
| GET | `admin/contact-requests` | `ContactController@index` | web, auth, admin |
| PATCH | `admin/contact-requests/{contactRequest}` | `ContactController@update` | web, auth, admin |
| GET | `admin/stats` | `AdminBillingController@stats` | web, auth, admin |
| GET | `admin/payments` | `AdminBillingController@payments` | web, auth, admin |
| POST | `admin/payments/{payment}/refund` | `AdminBillingController@refund` | web, auth, admin |
| GET | `admin/subscriptions` | `AdminBillingController@subscriptions` | web, auth, admin |
| POST | `admin/subscriptions/team` | `AdminBillingController@createTeamSubscription` | web, auth, admin |
| POST | `admin/subscriptions/{subscription}/cancel` | `AdminBillingController@cancelSubscription` | web, auth, admin |

### 6.1bis Routes mobiles — jetons Sanctum (`routes/api.php`, préfixe `/api/mobile`)

Routes **hors du groupe `web`** (jeton `Authorization: Bearer`, sans session ni CSRF), ajoutées le 2026-10-07 pour l'application Flutter (D-15). Détail complet dans `07-api.md` §4bis. En résumé : `auth/{login,register,logout,forgot-password,reset-password}`, `me`, `email/verification-notification`, `account/{email,password}`, `DELETE account`, `account/{subscriptions,payments,payments/{payment}}`, `vpn/{credentials,config}`, `checkout`, `payments/{payment}/verify`, `subscriptions/{trial,cancel}`. L'administration n'est pas exposée. Le login web reste inchangé.

### 6.2 Routes web (`routes/web.php`)

| Méthode | Chemin | Rôle | Statut |
|---|---|---|---|
| GET | `/payment/success`, `/payment/failed` | Anciennes URL de retour Chargily : redirigent vers `FRONTEND_URL/payment/result?payment={id}` | **utilisées** (compatibilité checkouts anciens) |
| GET | `/up` | Contrôle de santé Laravel | utilisée (hébergement) |
| GET | `/` | Redirige vers `FRONTEND_URL` (le domaine Laravel ne sert que l'API) | depuis 2026-10-15 (auparavant page Inertia en erreur `500` en production) |

Les routes web d'authentification et de profil du starter kit (`routes/auth.php`, `routes/settings.php`, page `dashboard`) ont été **supprimées le 2026-10-15** (R-03, §10). Les invités non authentifiés hors API sont redirigés vers `FRONTEND_URL` (`redirectGuestsTo` dans `bootstrap/app.php`) ; sous `api/*`, ils reçoivent un `401` JSON.

## 7. Workflows métier importants

### 7.1 Cycle de vie d'un abonnement

Statuts (`subscriptions.status`, chaîne libre) : `trialing`, `active`, `canceled`, `expired` (`past_due` est accepté comme filtre admin mais n'est jamais attribué par le code).

* **Courant** = `trialing` ou `active` ; **au plus un par utilisateur**, garanti par l'index unique partiel `subscriptions_one_current_per_user` (SQLite/PostgreSQL).
* **Accès** (`grantingAccess`) = statut courant **ou** `canceled`, avec `current_period_end` dans le futur (un abonnement payé annulé garde l'accès jusqu'à la fin de la période payée).
* **Essai** : 7 jours, un seul par compte à vie (refusé dès qu'un abonnement, même supprimé, existe), uniquement pour les plans *self-serve* (prix mensuel > 0).
* **Annulation utilisateur** : un essai se termine immédiatement ; un abonnement payé reste actif jusqu'à la fin de période (les paiements Chargily sont ponctuels, il n'y a pas de renouvellement automatique). Les abonnements Team ne sont pas annulables par l'utilisateur.
* **Expiration** : commande `subscriptions:expire` (toutes les 15 min) → passe en `expired`, envoie un e-mail, puis révoque tous les accès VPN qui ne sont plus couverts.
* **Rappels** : commande `subscriptions:remind` (tous les jours à 09:00) → e-mail 3 jours avant la fin de l'essai/de la période, une seule fois par période (colonnes `*_reminder_sent_at`, réservation atomique).

### 7.2 Paiement Chargily

> Depuis le 2026-10-06, les appels à Chargily, la vérification de signature et les règles de statut sont regroupés dans `app/Services/ChargilyGateway.php` ; `PaymentController` délègue à ce service.

1. `POST /api/checkout` : le montant est calculé **côté serveur** à partir du plan (`monthly_price` ou `yearly_total`), jamais depuis le client. Un enregistrement `payments` `pending` est créé **avant** l'appel à Chargily (pour qu'un webhook rapide le retrouve), avec une référence `pay_<uuid>` dans `metadata`.
2. Appel `POST {base}/checkouts` (Chargily Pay v2, mode `test` ou `live`) avec `success_url`/`failure_url` = page résultat du frontend. Si `CHARGILY_WEBHOOK_URL` est défini, il est transmis comme `webhook_endpoint` (utile pour un tunnel local). Erreurs fournisseur non renvoyées au client ; paiement marqué `failed`.
3. Confirmation par **deux voies** :
   * **webhook** `POST /api/webhooks/chargily` : vérification `hash_hmac('sha256', corps brut, clé secrète)` comparée en temps constant à l'en-tête `signature` ; événements traités `checkout.paid|failed|canceled|expired` ; checkout inconnu → 404 pour que Chargily réessaie ;
   * **vérification active** `GET /api/payments/{id}/verify` depuis la page résultat : interroge `GET {base}/checkouts/{id}`.
4. `Payment::markSucceeded()` est **idempotent** : transition `pending → succeeded` par mise à jour conditionnelle sur ligne verrouillée, dans une transaction ; un webhook rejoué ou une vérification concurrente ne peuvent l'appliquer qu'une fois. Un statut `paid` n'active le paiement que si le **montant** renvoyé est présent et égal au montant attendu **et** si la **devise** concorde ; sinon l'activation est refusée (`error_code = amount_mismatch` ou `currency_mismatch`, R-10).
5. Application à l'abonnement (`applyToSubscription`) : renouvellement (même plan actif → prolongation depuis la fin de période), conversion d'essai, changement de plan (l'ancien se termine), ou nouvel abonnement (en conservant les jours déjà payés d'un abonnement annulé au même plan).
6. Après activation : émission des identifiants VPN si l'e-mail est vérifié, e-mail de reçu.
7. **Réconciliation (R-06)** : la commande `payments:reconcile` (toutes les 15 min) relit chez Chargily les paiements `pending` depuis plus de 30 min, applique le statut réel, et expire (`POST {base}/checkouts/{id}/expire`) ceux encore impayés après 24 h. Si Chargily signale `paid` pour un paiement déjà en échec, l'incident est journalisé (`Log::critical`), marqué (`error_code = paid_after_failure`, visible côté admin) et audité (`payment.paid_after_failure`), une seule fois.
8. **Remboursement** : Chargily Pay v2 n'offrant pas d'API de remboursement, l'admin effectue le remboursement dans le tableau de bord Chargily puis l'**enregistre** via `POST /api/admin/payments/{id}/refund` (option de terminer l'abonnement et révoquer le VPN).

### 7.3 Provisionnement VPN WireGuard

* `VpnCredential::issueFor()` : réutilise l'identifiant actif de l'utilisateur ou en crée un : paire de clés Curve25519 générée en PHP (`random_bytes` + `sodium_crypto_scalarmult_base`), adresse tunnel suivante dans `VPN_ADDRESS_POOL` (défaut `10.66.0.0/16`, `.1` réservé au serveur, adresses jamais réutilisées). En cas de collision (contrainte unique), jusqu'à 5 tentatives.
* La **clé privée** est stockée chiffrée (`encrypted` cast, clé `APP_KEY`) et masquée de la sérialisation.
* `GET /api/vpn/config` renvoie un fichier `nexusvpn.conf` (`[Interface]` + `[Peer]`), `Cache-Control: no-store`. Exige un accès actif, un e-mail vérifié et un serveur configuré (`VPN_SERVER_PUBLIC_KEY`, `VPN_SERVER_ENDPOINT`).
* **Synchronisation avec la passerelle** : manuelle, via `php artisan vpn:peers` qui exporte les sections `[Peer]` actives (clés publiques et adresses uniquement) pour `wg syncconf`. ⚠️ À VÉRIFIER : aucun mécanisme automatique de synchronisation (cron/agent sur le serveur WireGuard) n'est présent dans le dépôt ; la révocation en base n'est effective sur la passerelle qu'après une nouvelle exportation.
* Révocation : annulation d'essai, remboursement, annulation admin, retrait d'équipe, expiration.

### 7.4 Offre Team (vente assistée)

Les plans sans prix mensuel (ex. `team`) ne sont ni achetables en ligne ni éligibles à l'essai. Le visiteur envoie une demande (`POST /api/contact`) ; un admin crée ensuite l'abonnement (`POST /api/admin/subscriptions/team` : propriétaire, plan, nom d'équipe, 2–500 sièges, 1–36 mois). Le propriétaire ajoute des membres (comptes existants) dans la limite des sièges ; les membres obtiennent l'accès VPN via l'abonnement de l'équipe (`User::accessSubscription()`).

### 7.5 Journal d'audit

`AuditLog::record()` trace les événements de sécurité et de facturation (inscription, connexion admin, échec de connexion, changement d'e-mail/mot de passe, suppression de compte, paiements, remboursements, abonnements, VPN, actions admin), avec acteur, sujet, métadonnées non sensibles et IP.

### 7.6 Suppression de compte (anonymisation)

La logique de fermeture est portée par le modèle (`User::closeAccount(?User $actor)`) et réutilisée par deux points d'entrée : la suppression en **libre-service** (`DELETE /api/account`, `AuthController@deleteAccount`) et la suppression par un **administrateur** (`DELETE /api/admin/users/{user}`, `AdminController@destroyUser`). Le choix retenu est l'**anonymisation + soft delete** (et non la suppression physique), pour préserver l'historique de facturation (voir TD-14).

`User::closeAccount()`, dans une transaction : annulation de l'abonnement courant (`cancel('account_deleted')`, qui révoque le VPN s'il ne reste aucun accès), révocation des identifiants VPN actifs, détachement des équipes (sièges libérés), puis **anonymisation** (`name` → « Deleted account », `email` → `deleted+{id}@deleted.invalid` — unique par id, ce qui **libère l'e-mail d'origine** ; `password` réinitialisé aléatoirement ; `email_verified_at` et `remember_token` effacés ; lignes `payments`/`subscriptions` **conservées**), audit `account.deleted` (métadonnées : `user_id`, domaine de l'e-mail précédent — jamais l'e-mail complet, et `by` = `self`|`admin` avec l'acteur), **soft delete** de l'utilisateur. Hors transaction : suppression des jetons de réinitialisation (`password_resets`) et de **toutes les sessions** de l'utilisateur.

Garde-fous propres à chaque point d'entrée :

* **Libre-service** : exige le **mot de passe actuel** ; refuse un **administrateur** (409 `admin_account`) ou un **propriétaire d'équipe** (409 `team_owner`) ; après fermeture, déconnexion et régénération de la session courante.
* **Admin** : refuse (422) de supprimer le **dernier administrateur**, **soi-même**, ou un **propriétaire d'équipe** (sa suppression annulerait l'abonnement d'équipe et couperait tous les membres). L'audit enregistre l'administrateur comme acteur.

> L'ancienne route web héritée `DELETE /settings/profile`, qui faisait seulement un *soft delete* sans annuler l'abonnement ni révoquer le VPN, a été supprimée le 2026-10-15 (R-03) : `DELETE /api/account` est désormais la seule voie de suppression.

## 8. Commandes Artisan et planification

| Commande | Rôle | Planification |
|---|---|---|
| `subscriptions:expire` | Expire les périodes terminées, révoque le VPN | toutes les 15 min, `withoutOverlapping` |
| `payments:reconcile {--older-than=30} {--expire-after=24}` | Synchronise les paiements Chargily `pending` périmés et expire les checkouts abandonnés | toutes les 15 min, `withoutOverlapping` |
| `subscriptions:remind {--days=3}` | E-mails de rappel de fin d'essai/période | quotidienne 09:00 |
| `vpn:peers` | Export des pairs WireGuard actifs | manuelle |
| `admin:grant {email}` | Donne le rôle admin | manuelle |

En production (Docker), le planificateur est lancé par `php artisan schedule:work` en arrière-plan dans `docker/entrypoint.sh`.

## 9. Notifications e-mail

`WelcomeNotification`, `PaymentReceiptNotification`, `SubscriptionReminderNotification` (types : fin d'essai, fin de période, accès terminé), plus les notifications natives `VerifyEmail` et `ResetPassword` dont les URL sont redirigées vers le frontend (`AppServiceProvider::configureEmailLinks()`). Les notifications sont envoyées **de façon synchrone** (pas d'implémentation `ShouldQueue`) ; chaque envoi est encapsulé dans un `try/catch` journalisé pour ne pas bloquer le flux métier.

## 10. Code hérité du starter kit (non utilisé par l'application réelle)

Le projet backend a été initialisé à partir du **Laravel React Starter Kit** (`composer.json` : `"name": "laravel/react-starter-kit"`). L'interface réelle étant désormais l'application Next.js, les éléments suivants sont des **restes non utilisés** par le frontend :

* paquets `inertiajs/inertia-laravel` et `tightenco/ziggy` ; middleware `HandleInertiaRequests` (toujours ajouté au groupe `web`, donc exécuté aussi sur les routes API de session) ;
* vue racine `resources/views/app.blade.php` (`@routes`, `@vite`, `@inertia`) et tout `resources/js/` (pages React/Inertia `welcome`, `dashboard`, `auth/*`, `settings/*`), `vite.config.js`, `package.json` du dossier `nexus-vpn/`, `components.json`, `eslint.config.js`, `tsconfig.json` ;
* fichier `tests/Pest.php` (Pest n'est pas installé) ;
* workflows `nexus-vpn/.github/workflows/lint.yml` et `tests.yml` (PHP 8.4, build Vite), inactifs car hors de la racine du dépôt (voir `19-limitations-and-future-work.md` L-16).

**Supprimé le 2026-10-15 (R-03)** : routes `routes/auth.php` et `routes/settings.php`, page `dashboard`, contrôleurs `app/Http/Controllers/Auth/*` et `Settings/*`, FormRequests `LoginRequest` et `ProfileUpdateRequest`, et leurs tests (`tests/Feature/Auth/*`, `tests/Feature/Settings/*`, `DashboardTest.php`). Ces routes contournaient l'API : `POST /register` créait un compte sans limiteur ni essai, `DELETE /settings/profile` supprimait le compte sans annuler l'abonnement ni révoquer le VPN. La page Inertia `/` répondait `500` en production (constaté le 2026-10-15, pas de build Vite dans le Dockerfile) ; elle redirige désormais vers le frontend. Régression couverte par `tests/Feature/Api/LegacyRoutesTest.php`. Les restes Inertia listés ci-dessus (paquets, middleware, `resources/js/`) demeurent (R-20).

## 11. Configuration (sans valeurs secrètes)

| Clé de config | Variable d'environnement | Rôle |
|---|---|---|
| `app.frontend_url` | `FRONTEND_URL` | URL du frontend Next.js (liens e-mail, redirections Chargily) |
| `services.chargily.mode` / `secret_key` / `webhook_url` | `CHARGILY_MODE`, `CHARGILY_SECRET_KEY`, `CHARGILY_WEBHOOK_URL` | Mode test/live, clé API + clé HMAC du webhook, et endpoint webhook optionnel par checkout |
| `services.vpn.*` | `VPN_SERVER_PUBLIC_KEY`, `VPN_SERVER_ENDPOINT`, `VPN_DNS`, `VPN_ALLOWED_IPS`, `VPN_ADDRESS_POOL`, `VPN_CLIENT_PREFIX` | Paramètres WireGuard |
| `cors.*` | `FRONTEND_URL` | CORS avec `supports_credentials=true` sur `api/*` |
| — | `TRUSTED_PROXIES` | Proxys de confiance |
| — | `APP_KEY` / `APP_KEY_SECRET` | Clé de chiffrement (Docker reconstruit `APP_KEY` depuis `APP_KEY_SECRET`) |

Garde-fou production (`guardProductionConfiguration`) : refuse de démarrer si `APP_DEBUG=true` en production, et journalise un avertissement si SQLite, Chargily non `live`, adresse d'expéditeur factice, mailer non distribuant, session non chiffrée ou niveau de log `debug`.

⚠️ À VÉRIFIER : `config/services.php` définit aussi `services.frontend_url` (avec une URL Vercel par défaut) qui n'est référencée nulle part dans `app/`, `config/` ou `routes/` (configuration morte).
