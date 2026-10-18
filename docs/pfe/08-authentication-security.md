# 08 — Authentification et sécurité

> Audit de référence du 2026-10-05 (étape 3/4). Ce fichier décrit les mécanismes **réellement implémentés** des deux côtés. Détails d'implémentation : `05-backend.md` (§2–4, §7), `04-frontend.md` (§6–9), contrat : `07-api.md`.

## 1. Authentification par session (cookie)

* **Mécanisme** : garde `web` de Laravel. Après connexion, Laravel stocke la session en base (`SESSION_DRIVER=database`, table `sessions`) et renvoie un cookie de session `HttpOnly`. En production (`render.yaml`) : `SESSION_SECURE_COOKIE=true` (HTTPS seulement), `SESSION_SAME_SITE=lax`, `SESSION_ENCRYPT=true` (contenu de session chiffré). Durée de vie : `SESSION_LIFETIME` (120 min par défaut dans `config/session.php`).
* **Même origine grâce à la réécriture** : le navigateur appelle `/backend-api/*` sur le domaine du frontend, Next.js relaie vers Laravel. Le cookie est donc émis pour le domaine du frontend : pas de cookie tiers, pas de requête cross-origin depuis le navigateur, et `SameSite=lax` suffit.
* **Pourquoi pas de jetons (Sanctum / JWT)** : le seul client est l'application web servie depuis la même origine. Une session cookie `HttpOnly` n'est pas lisible par JavaScript (contrairement à un jeton stocké dans `localStorage`), elle peut être révoquée côté serveur (suppression des lignes `sessions`) et réutilise le CSRF natif de Laravel. Sanctum n'est d'ailleurs pas installé (`composer.json`). Le frontend ne stocke aucune donnée d'authentification (`localStorage`/`sessionStorage` inutilisés).
* **Fixation de session** : `session()->regenerate()` après connexion et inscription ; `invalidate()` + `regenerateToken()` à la déconnexion.

## 1bis. Authentification par jeton (application mobile)

Depuis le 2026-10-07 (D-15), l'application mobile Flutter s'authentifie par **jeton personnel Laravel Sanctum** (en-tête `Authorization: Bearer`), sur des routes préfixées `/api/mobile/` **hors du groupe `web`** : ni cookie de session ni CSRF. Le flux web par cookie (§1) est **inchangé** et l'administration n'est **pas** exposée au mobile.

- **Émission** : `login` et `register` renvoient le jeton (champ `token`). Durée de vie : 30 jours par défaut (`SANCTUM_TOKEN_EXPIRATION`, `config/sanctum.php`), appliquée par Sanctum.
- **Révocation** : déconnexion (jeton courant), changement de mot de passe (autres jetons du compte), suppression de compte (tous les jetons). Un jeton révoqué ou expiré ⇒ 401.
- Le jeton n'est stocké que **haché** en base (`personal_access_tokens`) ; l'application le conserve dans le stockage sécurisé de l'appareil (Keystore Android).
- **Cloisonnement des guards** : un jeton mobile n'ouvre pas les routes web à session, et une session web n'est pas acceptée sur `/api/mobile/*` — couvert par un test (`MobileAuthTest`).
- Le verrou par compte (5 échecs → 429) et les limiteurs nommés (`login`, `register`, `account`, `checkout`, `vpn`…) s'appliquent comme au web.

## 2. Cycle de vie du compte

| Mécanisme | Implémentation |
|---|---|
| Inscription | `POST /api/auth/register` : e-mail normalisé (minuscules, `trim`), unique ; mot de passe `Password::defaults()` (règle par défaut de Laravel : 8 caractères minimum, aucune règle personnalisée définie) + confirmation ; création de l'utilisateur et de l'essai dans une **transaction** ; erreurs internes non divulguées (500 générique, seul le domaine de l'e-mail est journalisé). |
| Hachage des mots de passe | Cast `password => 'hashed'` sur `User` + `Hash::make()` : **bcrypt** (pilote par défaut du framework, aucun `config/hashing.php` personnalisé ; coût réglable par `BCRYPT_ROUNDS`). |
| Vérification d'e-mail | `User implements MustVerifyEmail`. Lien vers le frontend contenant une **signature temporaire** (60 min) de la route `api.verification.verify` ; vérifiée par le middleware `signed:relative` + comparaison `hash_equals` du hash de l'e-mail. Fonctionne sans session. Le paiement et le téléchargement de la configuration VPN exigent un e-mail vérifié. |
| Mot de passe oublié | Réponse identique que le compte existe ou non (**anti-énumération**) ; jeton Laravel (table `password_resets`) ; lien vers `FRONTEND_URL/reset-password`. |
| Réinitialisation | Nouveau `remember_token`, **suppression de toutes les sessions** de l'utilisateur, événement `PasswordReset`, entrée d'audit. |
| Changement de mot de passe / e-mail | Exige `current_password`. Mot de passe : suppression des **autres** sessions. E-mail : `email_verified_at` remis à `null` et nouveau lien envoyé. |
| Protection anti-force brute | Limiteur `login` (10/min par IP) + verrou applicatif de 60 s après 5 échecs pour le couple e-mail\|IP ; échecs journalisés (`auth.login_failed`, domaine de l'e-mail seulement). |
| Comptes de démonstration | `DatabaseSeeder` ne crée le compte de test qu'en environnement `local`/`testing`. |

## 3. Autorisation

* **Rôles** : colonne `users.role` (`user` | `admin`). Attribution d'un admin par commande serveur `php artisan admin:grant {email}` ou par un admin existant (`PATCH /api/admin/users/{user}`) ; un admin ne peut pas retirer son propre rôle.
* **Backend (référence de sécurité)** :
  * middleware `auth` sur toutes les routes privées ;
  * middleware `admin` (`EnsureUserIsAdmin`, 403) sur `/api/admin/*` ;
  * contrôles de propriété dans les contrôleurs (paiements, checkouts : **404** si la ressource appartient à un autre utilisateur, pour ne pas révéler son existence ; équipe : 403 si l'utilisateur n'est pas propriétaire) ;
  * aucune Policy/Gate Laravel (choix de simplicité : un seul rôle privilégié et des règles de propriété simples).
* **Frontend (`proxy.ts`)** : contrôle **avant l'envoi de la page** pour `/dashboard` et `/admin` en appelant `GET /api/me` avec le cookie de l'utilisateur (délai 4 s) :
  * pas de cookie, 401 ou 419 → redirection vers `/` ;
  * `/admin` : rôle différent de `admin` → redirection ; erreur backend ou délai dépassé → redirection (**fail-closed**) ;
  * `/dashboard` : erreur backend → la page est servie et affiche son propre message (**fail-open**), sans risque pour les données puisque chaque appel API reste authentifié par Laravel.
  * En complément, `/admin` revérifie le rôle côté client si la session change.

Le contrôle côté frontend est une **défense en profondeur** (ne pas livrer l'interface admin aux non-admins) ; l'autorisation effective est toujours celle de Laravel.

## 4. Protection CSRF

* Toutes les routes API à session sont dans le groupe `web` : middleware CSRF de Laravel actif.
* Le frontend obtient `XSRF-TOKEN` via `GET /api/csrf-cookie`, renvoie sa valeur dans `X-XSRF-TOKEN` pour chaque requête modifiante, et rejoue une fois en cas de 419 (`lib/api.ts`, voir `07-api.md` §2).
* `SameSite=lax` sur le cookie de session ajoute une seconde barrière contre les requêtes cross-site.
* Le webhook Chargily est hors du groupe `web` (pas de session, pas de CSRF) : il est authentifié par signature HMAC (§7).

## 5. Limitation de débit

Limiteurs nommés définis dans `AppServiceProvider::configureRateLimiting()` (clé = id utilisateur, sinon IP, sauf mention) :

| Limiteur | Limite | Routes |
|---|---|---|
| `api` | 120/min | toutes les routes `/api` (y compris `pricing`, `testimonials`) sauf le webhook |
| `login` | 10/min par IP | `POST auth/login` (+ verrou 5 échecs e-mail\|IP) |
| `register` | 3/min et 20/jour par IP | `POST auth/register` |
| `password-reset` | 3/min par IP ; 10/h par e-mail\|IP | `POST auth/forgot-password`, `POST auth/reset-password` |
| `account` | 6/min | `PUT account/email`, `PUT account/password` |
| `verification` | 6/min | `GET email/verify/...`, `POST email/verification-notification` |
| `checkout` | 5/min et 30/jour | `POST checkout` |
| `trial` | 3/min | `POST subscriptions/trial` |
| `testimonials` | 3/h | `POST testimonials` (+ 1 témoignage en attente maximum) |
| `vpn` | 10/min | `GET vpn/config` |
| `contact` | 2/min et 10/jour par IP | `POST contact` |
| `webhooks` | 120/min par IP | `POST webhooks/chargily` |

Les limites par IP supposent que Laravel connaisse l'IP réelle du client : `TRUSTED_PROXIES` (valeur `*` dans `render.yaml`) fait confiance aux en-têtes `X-Forwarded-For` (voir risque R-05). **Mesure en production (2026-10-15)** : ce n'est pas le cas, l'IP vue par Laravel est celle de proxys changeants ; les limites par IP sont donc partiellement inefficaces (détails dans R-05).

## 6. Validation des entrées

* **Backend** : validation systématique avec `$request->validate([...])` dans les contrôleurs (pas de FormRequest pour l'API) : types, longueurs maximales, `email`, `exists`/`unique` (avec filtres `is_active` et `deleted_at`), `in:` pour les énumérations, bornes numériques. Normalisation des e-mails (minuscules, `trim`). Les **montants ne sont jamais acceptés du client** (calculés à partir du plan). Les recherches `LIKE` échappent `%` et `_` et utilisent des requêtes paramétrées (Eloquent / `whereRaw` avec liaisons).
* **Frontend** : validation HTML (`required`, `type="email"`) et contrôles simples en JavaScript (champs vides, confirmation du mot de passe) ; pas de schéma (`zod` installé mais inutilisé). La validation côté client n'est qu'un confort : la validation de référence est celle de Laravel, dont les erreurs 422 sont affichées via `apiErrorMessage`.
* **Rendu** : React échappe les contenus affichés (témoignages, noms) ; aucun `dangerouslySetInnerHTML` dans le code applicatif (seulement dans la primitive inutilisée `components/ui/chart.tsx`, avec du CSS statique).

## 7. Webhook Chargily : authenticité et idempotence

* **Signature** : `hash_hmac('sha256', corps_brut, CHARGILY_SECRET_KEY)` comparé en **temps constant** (`hash_equals`) à l'en-tête `signature`. Absente → 400 ; invalide → 403 et journalisation de l'IP ; clé non configurée → rejet (et log critique).
* **Événements** : seuls `checkout.paid|failed|canceled|expired` sont traités, les autres sont ignorés (200).
* **Retrouver le paiement** : par `provider_reference` (id du checkout, **unique** en base). Checkout inconnu → 404 pour que Chargily réessaie (le paiement est enregistré avant l'appel à Chargily, cette fenêtre est donc très courte).
* **Idempotence** : `Payment::markSucceeded()` effectue la transition `pending → succeeded` par une mise à jour **conditionnelle** sur une ligne **verrouillée** (`lockForUpdate`) dans une transaction ; un webhook rejoué et la vérification active simultanée ne peuvent activer l'abonnement qu'une fois. `markFailed()` est aussi conditionnel (`status = pending`).
* **Contrôle du montant** : si le montant renvoyé par Chargily diffère du montant enregistré, l'activation est refusée (`error_code = amount_mismatch`, log critique).
* **Double canal** : le webhook et la vérification active (`GET /api/payments/{id}/verify`, qui interroge l'API Chargily avec la clé secrète) convergent vers la même logique `applyCheckoutStatus()`.

## 8. Chiffrement des clés privées WireGuard

* La clé privée du client est générée côté serveur (`random_bytes` + `sodium_crypto_scalarmult_base`) et stockée dans `vpn_credentials.private_key` avec le cast Eloquent **`encrypted`** (chiffrement AES-256-CBC + MAC par le chiffreur de Laravel, avec `APP_KEY`). Elle est exclue de la sérialisation (`$hidden`).
* Elle n'est déchiffrée que pour produire le fichier `nexusvpn.conf` (`Cache-Control: no-store`) ; l'export vers la passerelle (`vpn:peers`) ne contient que les clés **publiques** et adresses.
* Conséquence : la perte ou la rotation de `APP_KEY` rend les clés privées existantes illisibles.

## 9. En-têtes de sécurité et CORS

| Côté | Mécanisme |
|---|---|
| Frontend (`next.config.mjs`, toutes les routes) | `Content-Security-Policy` (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`…), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra, micro, géolocalisation désactivés). Détail : `04-frontend.md` §9. |
| Backend (`SecurityHeaders`, global) | Mêmes en-têtes `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy` ; sur `api/*` et `/up` : `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` ; `Strict-Transport-Security` (1 an, sous-domaines) sur HTTPS. |
| Backend CORS (`config/cors.php`) | Chemins `api/*` et `csrf-cookie` ; origines autorisées : `FRONTEND_URL`, `http://localhost:3000`, `http://127.0.0.1:3000` ; `supports_credentials: true`. En fonctionnement normal, CORS n'intervient pas (même origine via la réécriture). |
| Garde-fou production | `AppServiceProvider::guardProductionConfiguration()` : refus de démarrer avec `APP_DEBUG=true` en production ; avertissements journalisés pour les réglages de développement (SQLite, Chargily non `live`, mailer non distribuant, session non chiffrée, log `debug`…). |

## 10. Gestion des secrets

Aucune valeur secrète n'est versionnée (`.gitignore` exclut `.env*` sauf `.env.example`). Seuls les **noms** sont listés ici.

| Variable | Côté | Rôle | Où elle est définie |
|---|---|---|---|
| `APP_KEY` / `APP_KEY_SECRET` | Backend | Clé de chiffrement (cookies, sessions, clés WireGuard) | Local : `nexus-vpn/.env` (`php artisan key:generate`) ; Render : `APP_KEY_SECRET` généré par Render (`generateValue: true`), converti en `APP_KEY` par `docker/entrypoint.sh` |
| `CHARGILY_SECRET_KEY` | Backend | Clé API Chargily **et** clé HMAC du webhook | Local : `.env` ; Render : saisie manuelle dans le tableau de bord (`sync: false`) |
| `BREVO_API_KEY`, `MAIL_FROM_ADDRESS` | Backend | Envoi d'e-mails en production (API HTTP Brevo) | Render : saisie manuelle (`sync: false`) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | Backend | Envoi SMTP en local (Gmail) | `.env` local uniquement |
| `DB_URL` | Backend | Connexion PostgreSQL | Render : injectée depuis la base `nexus-vpn-db` (`fromDatabase`) |
| `VPN_SERVER_PUBLIC_KEY`, `VPN_SERVER_ENDPOINT` | Backend | Passerelle WireGuard (non secrets mais propres au déploiement) | Render : saisie manuelle (`sync: false`) |
| `NEXT_PUBLIC_API_URL` | Frontend | URL du service Laravel (publique, non secrète) | Vercel : variables du projet (Production / Preview) ; local : facultative (repli sur le serveur Laravel local) |

Le frontend ne manipule **aucun secret** : `NEXT_PUBLIC_API_URL` est une URL publique, et toutes les clés (Chargily, SMTP) restent côté Laravel.

## 11. Risques identifiés (audit du 2026-10-05)

Consolidation des constats des étapes 1 (backend), 2 (frontend) et 3 (contrat, déploiement). Sévérité : impact × probabilité dans le contexte actuel (projet de démonstration déployé sur offres gratuites).

> **Mise à jour 2026-10-06** : R-06 et R-10 ont été corrigés lors de l'intégration Chargily (voir P-21 et P-22 dans `14-problems-and-solutions.md`). Les autres risques restent ouverts.

| ID | Description | Côté | Sévérité | Justification | Fichiers concernés |
|---|---|---|---|---|---|
| R-01 | La révocation d'accès VPN n'est appliquée qu'en base : la passerelle WireGuard n'est mise à jour que par un export manuel (`vpn:peers`). Un utilisateur annulé, remboursé ou expiré garde un tunnel fonctionnel. | Backend | Élevée | Contourne directement le modèle payant (accès au service sans abonnement). | `app/Models/VpnCredential.php`, `app/Console/Commands/ExportVpnPeers.php` |
| R-02 | Base PostgreSQL Render Free : expiration 30 jours après création, suppression après 14 jours de grâce. | Déploiement | Élevée | Perte totale des comptes, paiements et identifiants VPN si elle n'est pas migrée à temps (documenté dans `DEPLOYMENT.md`). | `render.yaml`, `DEPLOYMENT.md` |
| R-03 | ✅ **Corrigé (2026-10-15)** — Routes web héritées du starter kit (`POST /register` sans limiteur ni essai, `PATCH/DELETE /settings/profile` supprimant le compte sans annuler l'abonnement ni révoquer le VPN, `POST /forgot-password` sans limiteur nommé, etc.) **supprimées** avec leurs contrôleurs et tests ; elles répondent `404`. `/` (page Inertia en erreur `500`) redirige vers le frontend. Régression : `tests/Feature/Api/LegacyRoutesTest.php`. | Backend | Moyenne | — (corrigé) | `routes/web.php`, `bootstrap/app.php` |
| R-04 | Planificateur lancé par `schedule:work` dans le conteneur web Render Free, qui s'endort après 15 min sans trafic : expirations, révocations et rappels e-mail ne s'exécutent pas pendant la veille. | Déploiement | Moyenne | L'accès API est vérifié en temps réel (`current_period_end`), mais les e-mails et révocations sont retardés. | `docker/entrypoint.sh`, `routes/console.php`, `render.yaml` |
| R-05 | `TRUSTED_PROXIES="*"` : Laravel ne voit **pas l'IP réelle du visiteur** en production. **Mesuré le 2026-10-15** (tentatives de connexion avec identifiants fictifs, lecture des en-têtes `X-RateLimit-Remaining`) : les requêtes d'un même client tombent dans **plusieurs compteurs différents** (ex. `0`, puis `2`, puis `1` restants), donc `$request->ip()` renvoie des IP de proxy changeantes (vraisemblablement Cloudflare, placé devant Render). Conséquences : les limites par IP ne bornent pas réellement un client (12–13 tentatives sans `429` observées pour une limite de 10/min) et des visiteurs différents partagent les mêmes compteurs. Le verrou par e-mail (5 échecs, clé `e-mail|IP`) a, lui, déclenché lors d'un essai. Correctif possible (non retenu à ce stade) : en-tête d'IP client signé par un secret partagé entre `proxy.ts` (Vercel) et Laravel, et `CF-Connecting-IP` pour les appels directs. | Backend / Déploiement | Moyenne | Affaiblit la protection anti-force brute (login, inscription, contact, réinitialisation). | `bootstrap/app.php`, `render.yaml`, `app/Providers/AppServiceProvider.php` |
| R-06 | ✅ **Corrigé (2026-10-06)** — Paiements restés `pending` jamais réconciliés automatiquement (si le webhook échoue définitivement et que l'utilisateur ne revient pas sur la page de résultat). Commande `payments:reconcile` planifiée toutes les 15 min (voir P-22). | Backend | Moyenne | Un client peut payer sans être activé jusqu'à une intervention manuelle. | `app/Console/Commands/ReconcilePayments.php`, `app/Services/ChargilyGateway.php`, `routes/console.php` |
| R-07 | Aucune authentification à deux facteurs pour les comptes admin. | Backend | Moyenne | Un mot de passe admin compromis donne accès aux remboursements, rôles et données de tous les utilisateurs. | `app/Http/Controllers/Api/AuthController.php`, `app/Http/Middleware/EnsureUserIsAdmin.php` |
| R-08 | Aucun test automatisé du frontend (authentification, paiement, `proxy.ts`). | Frontend | Moyenne | Les régressions des parcours critiques ne sont détectées que manuellement. | (absence) `package.json` |
| R-09 | ✅ **Corrigé (2026-10-11)** — Les chiffres et fonctionnalités marketing non implémentés (87 pays, 99,98 %, OpenVPN, kill switch, split tunneling, DNS dédié, audit indépendant, garantie 30 j, SSO/SAML, IP dédiée, SLA) ont été **retirés du site et des offres** ; le contenu décrit désormais uniquement le réel (WireGuard® seul, ChaCha20-Poly1305/Curve25519, aucun log, paiement DZD EDAHABIA/CIB, essai 7 jours). | Frontend | Moyenne | — (corrigé) | `components/{hero,stats,features,map,pricing,footer}*.tsx`, `app/layout.tsx`, `database/seeders/PlansTableSeeder.php` |
| R-10 | ✅ **Corrigé (2026-10-06)** — Vérification du montant du webhook ignorée si `amount` est absent ; la devise n'est jamais comparée. Activation désormais conditionnée à un montant présent et égal **et** une devise concordante (voir P-21). | Backend | Faible | Le corps est signé par Chargily : seul le fournisseur pourrait envoyer une donnée incohérente. | `app/Services/ChargilyGateway.php` |
| R-11 | CORS autorise `localhost:3000` et `127.0.0.1:3000` avec identifiants en production. | Backend | Faible | Exige une page malveillante servie sur le port 3000 de la machine de la victime ; CSRF et `SameSite=lax` restent actifs. | `config/cors.php` |
| R-12 | CSP frontend avec `script-src 'unsafe-inline'` (pas de nonces). | Frontend | Faible | Réduit la défense contre le XSS, mais aucun point d'injection HTML n'a été trouvé dans le code applicatif. | `next.config.mjs` |
| R-13 | Un admin peut modifier l'e-mail d'un utilisateur sans réinitialiser `email_verified_at`. | Backend | Faible | Action réservée à un admin, tracée dans le journal d'audit. | `app/Http/Controllers/Api/AdminController.php` |
| R-14 | `PUT /api/account/password` n'exige pas de confirmation côté serveur (seulement côté client). | Contrat | Faible | `current_password` est exigé ; risque limité à une faute de frappe. | `app/Http/Controllers/Api/AuthController.php`, `components/account-menu.tsx` |
| R-15 | `/dashboard` est servi si le backend est en erreur (`proxy.ts` fail-open). | Frontend | Faible | Choix assumé : aucune donnée n'est exposée sans réponse authentifiée de l'API. | `proxy.ts` |
| R-16 | Pas de gestion globale de l'expiration de session côté client ; `downloadConfig` et `teamRequest` n'interceptent pas les erreurs réseau (promesse rejetée non gérée). | Frontend | Faible | Expérience dégradée (messages génériques), pas de fuite de données. | `components/auth-provider.tsx`, `app/dashboard/page.tsx` |
| R-17 | Adresses VPN jamais réutilisées : épuisement du bloc `/16` (~65 000 identifiants). | Backend | Faible | Volume très supérieur à l'usage prévu. | `app/Models/VpnCredential.php` |
| R-18 | Index unique « un abonnement courant par utilisateur » créé seulement sous SQLite/PostgreSQL. | Base de données | Faible | La production utilise PostgreSQL ; ne concernerait qu'une migration vers MySQL. | `database/migrations/2026_10_05_000012_harden_billing_schema.php` |
| R-19 | Notifications e-mail synchrones (pas de file d'attente ; tables `jobs` inutilisées). | Backend | Faible | Latence SMTP dans la requête ; les échecs sont interceptés et journalisés. | `app/Notifications/*`, `config/queue.php` |
| R-20 | Code hérité du starter kit exécuté ou présent : `HandleInertiaRequests` sur toutes les routes API à session, pages Inertia probablement en erreur en production (pas de build Vite dans le Dockerfile), `tests/Pest.php`. | Backend | Faible | Surcoût et confusion, pas de faille directe identifiée. ⚠️ À VÉRIFIER : comportement de `/` en production. | `bootstrap/app.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `resources/`, `Dockerfile` |
| R-21 | Code mort et dépendances inutilisées côté frontend : `styles/globals.css`, `db/schema.sql` (schéma MySQL obsolète pouvant induire en erreur), fichiers de `public/`, plus de 40 primitives `components/ui/` inutilisées, `@vercel/analytics`, `zod`, `date-fns`, etc. | Frontend | Faible | Maintenance et taille des dépendances ; pas d'impact fonctionnel. | `styles/`, `db/`, `public/`, `components/ui/`, `package.json` |
| R-22 | Incohérences de contrat : `past_due` dans les types sans être produit, casse mixte camelCase/snake_case, clés d'erreur `error`/`message`, endpoints inutilisés (`checkout/{id}/verify`, `account/payments/{id}`, `PATCH team`). | Contrat | Faible | Maintenabilité ; le frontend gère déjà ces variantes. | `components/auth-provider.tsx`, contrôleurs `Api/*` |
| R-23 | `migrate --force --seed` à chaque démarrage du conteneur. | Déploiement | Faible | Les seeders sont idempotents et testés ; risque en cas de futur seeder non idempotent. | `docker/entrypoint.sh` |
| R-24 | Configuration incohérente : `services.frontend_url` morte (URL Vercel en dur) ; URL du backend lue séparément par `next.config.mjs` et `proxy.ts` ; PHP 8.2 en local et 8.3 dans l'image Docker. | Backend / Frontend | Faible | Source de divergences futures, sans effet actuel. | `config/services.php`, `next.config.mjs`, `proxy.ts`, `Dockerfile` |
| R-25 | Remboursements seulement enregistrés (Chargily Pay v2 n'a pas d'API de remboursement). | Backend | Faible | Cohérence manuelle entre le tableau de bord Chargily et l'application ; limite du fournisseur. | `app/Models/Payment.php` |
| R-26 | Au chargement, le client appelle `GET /api/me` pour détecter une session ; pour un visiteur non connecté, l'API répond `401` (sémantique REST correcte) et le navigateur journalise « Failed to load resource: 401 » dans la console. | Frontend | Faible | Purement cosmétique : l'application gère le cas en statut « invité », aucune donnée exposée. Corriger exigerait de renvoyer `200 {user:null}` (changement de contrat), non souhaitable. Relevé à l'audit final (2026-10-07). | `components/auth-provider.tsx`, `app/Http/Controllers/Api/AuthController.php` |
| R-27 | La sérialisation d'une liste de paiements appelle `Payment::plan()` (`Plan::withTrashed()->find()`) une fois par paiement possédant un `plan_id` (N+1 borné). | Backend | Faible | Impact négligeable (table `plans` de quelques lignes, pages de 10–20 ; mesuré 4 requêtes pour 9 paiements). Optimisable par mémoïsation si le volume croît. Relevé à l'audit final (2026-10-07). | `app/Models/Payment.php`, `app/Http/Controllers/Api/AccountController.php`, `AdminBillingController.php` |
