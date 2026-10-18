# 12 — Tests

## 1. Stratégie de test du backend

* Framework : **PHPUnit 11** (classes PHPUnit ; le fichier `tests/Pest.php` est un reste du starter kit, Pest n'est pas installé).
* Type : principalement des **tests de fonctionnalités** (`tests/Feature`) qui appellent les routes HTTP réelles et vérifient la réponse JSON, l'état de la base et les effets de bord.
* Base de données de test : SQLite en mémoire (`phpunit.xml` : `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `APP_ENV=testing`).
* Appels externes (Chargily) simulés avec `Http::fake()` (`PaymentFlowTest`, `ChargilyPaymentTest`) ; e-mails interceptés avec `Notification::fake()`.
* Commande : `php artisan test --compact` (depuis `nexus-vpn/`).

## 2. Fichiers de test existants (backend)

### Tests de l'API réelle

| Fichier | Nb | Ce qui est couvert |
|---|---|---|
| `tests/Feature/Api/AuthenticationTest.php` | 4 | Inscription + authentification, mise à jour e-mail/mot de passe, connexion et lecture de `me`, déconnexion avec invalidation de session |
| `tests/Feature/Api/MobileAuthTest.php` | 9 | **API mobile (jetons Sanctum)** : inscription renvoyant un jeton + essai de 7 jours, connexion renvoyant un jeton, refus du mauvais mot de passe (401), verrouillage après 5 échecs (429), jeton requis sur les routes protégées (401), accès autorisé avec jeton (`me`, abonnements), déconnexion révoquant le jeton, **un jeton mobile n'authentifie pas les routes web à session**, changement de mot de passe révoquant les autres jetons |
| `tests/Feature/Api/AccountSecurityTest.php` | 12 | Verrouillage après 5 échecs de connexion, réinitialisation du compteur, absence de fuite d'erreurs internes à l'inscription, refus des plans vente assistée, e-mails de vérification et bienvenue, changement d'e-mail avec revérification, lien de vérification signé, **renvoi du lien de vérification (et aucun envoi si déjà vérifié)**, anti-énumération du mot de passe oublié, réinitialisation par jeton valide uniquement, en-têtes de sécurité et CORS sans joker sur `pricing` |
| `tests/Feature/Api/PaymentFlowTest.php` | 23 | Checkout (paiement enregistré avant l'appel, retour vers la page résultat), e-mail vérifié requis, plans non achetables, erreurs fournisseur masquées, idempotence webhook + vérification, conversion d'essai, renouvellement, réabonnement après annulation (jours conservés / départ immédiat), changement de plan, refus d'un second abonnement courant par la base, webhook pour checkout inconnu (404), échec enregistré, montant différent refusé, **montant absent refusé et devise non concordante refusée (R-10)**, **paiement signalé lorsque Chargily paie un paiement déjà en échec (R-06)**, **envoi conditionnel du `webhook_endpoint`**, isolation entre utilisateurs, historique et reçus |
| `tests/Feature/Api/SubscriptionLifecycleTest.php` | 11 | Annulation d'essai (fin immédiate + révocation VPN), annulation payée (accès jusqu'à fin de période), annulation sans abonnement, ancienne route d'annulation supprimée, essai unique et interdit aux plans vente assistée, commande d'expiration, fin d'accès sans attendre le planificateur, rappels envoyés une fois, configuration WireGuard valide, prérequis (e-mail vérifié, serveur configuré), adresses tunnel distinctes |
| `tests/Feature/Api/AdminTest.php` | 2 | Refus de l'API admin aux utilisateurs normaux ; gestion des utilisateurs et des plans par un admin |
| `tests/Feature/Api/AdminBillingTest.php` | 9 | Accès admin uniquement, statistiques calculées sur des données réelles, liste utilisateurs paginée/filtrée, remboursement (fin d'abonnement + révocation VPN), filtres paiements/abonnements, désactivation des plans ayant un historique et mise à jour immédiate des prix, modération des témoignages, journal d'audit, abonnement Team avec limite de sièges |
| `tests/Feature/Api/ContactRequestTest.php` | 2 | Demande commerciale traitée par un admin ; validation et limitation de débit |
| `tests/Feature/ChargilyPaymentTest.php` | 13 | Création de checkout Chargily, seeders idempotents (ne réécrivent ni ne restaurent les plans modifiés/supprimés par un admin), essai à l'inscription, redirection des anciennes URL de retour, annulation, nouvel abonnement au lieu de réactiver un ancien, essai de 7 jours unique, contenu de `userPayload`, rejet d'une signature de webhook invalide, montant client ignoré, isolation des checkouts |
| `tests/Feature/ReconcilePaymentsTest.php` | 5 | Commande `payments:reconcile` : activation d'un paiement en attente payé chez Chargily, maintien en attente d'un checkout récent toujours ouvert, expiration d'un checkout abandonné au-delà du délai (`POST /checkouts/{id}/expire`), respect de la période de grâce, aucune action sans clé secrète |
| `tests/Feature/Api/AccountDeletionTest.php` | 5 | `DELETE /api/account` : anonymisation + soft delete en conservant l'historique de facturation, impossibilité de se réauthentifier ensuite, exigence du mot de passe actuel (422), blocage des administrateurs (409 `admin_account`) et des propriétaires d'équipe (409 `team_owner`) |
| `tests/Feature/Api/AdminUserDeletionTest.php` | 6 | `DELETE /api/admin/users/{user}` : anonymisation + conservation de l'historique, suppression d'un autre administrateur (s'il en reste un), refus de se supprimer soi-même et du dernier administrateur et d'un propriétaire d'équipe (422), refus pour un non-administrateur (403) |
| `tests/Feature/Api/LoginAfterDeletionTest.php` | 3 | Régression connexion/suppression : un compte actif se connecte avec le bon mot de passe (e-mail insensible à la casse), un compte fermé (anonymisé) ne peut plus se connecter (401), et l'e-mail libéré peut être réutilisé à l'inscription (le nouveau mot de passe fonctionne, l'ancien non) |
| `tests/Feature/BrevoMailerTest.php` | 1 | **Mailer de production `brevo`** : le transport résolu est l'API HTTP Brevo (`brevo+api://api.brevo.com`, pas SMTP) et utilise la clé `services.brevo.key` |
| `tests/Feature/Api/LegacyRoutesTest.php` | 4 | **Routes web héritées supprimées (R-03)** : `POST /register`, `/login`, `/forgot-password`, `/reset-password` → `404` sans création de compte ; `dashboard` et `settings/profile|password` → `404` sans modification ni suppression du compte ; `/` redirige vers `FRONTEND_URL` ; invité sur `GET /api/me` sans en-tête JSON → `401` (pas de redirection vers une route `login` inexistante) |

### Autres

| Fichier | Nb | Ce qui est couvert |
|---|---|---|
| `tests/Unit/ExampleTest.php` | 1 | Test d'exemple (`true is true`) |

Les 25 tests hérités du starter kit (`tests/Feature/Auth/*`, `tests/Feature/Settings/*`, `tests/Feature/DashboardTest.php`) ont été supprimés le 2026-10-15 avec les routes qu'ils testaient (R-03).

Total : 111 tests (exécution du 2026-10-18).

### Zones non couvertes identifiées

* Équipe (`/api/team*`) : couverte uniquement par `AdminBillingTest::test_team_subscription_flow_with_seat_limits` (ajout/retrait de membres, limite de sièges, visibilité de la liste) ; `PATCH /api/team` (renommage) n'a pas de test identifié.
* Tests contre PostgreSQL (base de production) : aucun ; la suite tourne uniquement sur SQLite.
* Commande `vpn:peers` : vérifiée seulement dans `SubscriptionLifecycleTest` (présence de la clé publique dans la sortie), pas de test dédié.

## 3. Exécutions enregistrées (backend)

### Avant le versionnement (2026-10-04 → 2026-10-05)

> Exécutions réelles relevées dans les journaux des sessions de développement (pas de commit associé, code inclus ensuite dans `067e68d`).

| Date | Contexte | Commande | Résultat |
|---|---|---|---|
| 2026-10-04 | Avant la passe de débogage | `php artisan test` | 36 réussis, 4 échecs |
| 2026-10-04 | Après la passe de débogage | `php artisan test` | 43 réussis, 0 échec |
| 2026-10-05 | Après le durcissement (nouveaux fichiers `PaymentFlowTest`, `AccountSecurityTest`, `SubscriptionLifecycleTest`, `AdminBillingTest`, `ContactRequestTest`) | `php artisan test --compact` | 90 réussis, 0 échec (360 assertions) |

### 2026-10-05 — Référence backend (audit de base)

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (dans `nexus-vpn/`) |
| Environnement | Windows 10, PHP 8.2.12, Laravel 12.60.2, PHPUnit 11.5.55, SQLite en mémoire |
| Commit testé | `e246b4d` (aucune modification du code applicatif) |
| Résultat | **94 réussis, 0 échec** (370 assertions) |
| Durée | 12.98 s (rapportée par PHPUnit) |
| Code de sortie | 0 |

Sortie (résumé) :

```
Tests:    94 passed (370 assertions)
Duration: 12.98s
```

### 2026-10-06 — Intégration Chargily (mode test)

Après les cinq commits de l'intégration Chargily (extraction de `ChargilyGateway`, R-10, alerte « payé après échec », commande `payments:reconcile`, `CHARGILY_WEBHOOK_URL`). Onze tests ajoutés (94 → 105). Les réglages Chargily sont forcés dans `phpunit.xml` (`CHARGILY_SECRET_KEY` vide) pour qu'aucun test ne puisse appeler l'API avec la vraie clé du `.env`.

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (dans `nexus-vpn/`) |
| Environnement | Windows 10, PHP 8.2.12, Laravel 12, PHPUnit 11, SQLite en mémoire |
| Résultat | **105 réussis, 0 échec** (409 assertions) |

### 2026-10-06 — Suppression de compte

Après l'ajout de `DELETE /api/account` (anonymisation + soft delete). Cinq tests ajoutés (105 → 110).

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (dans `nexus-vpn/`) |
| Résultat | **110 réussis, 0 échec** (432 assertions) |

### 2026-10-06 — SMTP (Gmail) et vérification d'e-mail

Passage à **Gmail SMTP** (`smtp.gmail.com:587`, TLS) pour une livraison réelle (le bac à sable de test initial ne livrait pas aux vraies adresses). Deux tests ajoutés pour le renvoi du lien de vérification (110 → 112). Envoi réel vérifié via `php artisan tinker` : e-mail de vérification livré à une adresse `+alias` du compte projet (~3,9 s), utilisateur de test supprimé ensuite. Les erreurs d'envoi sont interceptées par `sendSafely()` (l'inscription n'échoue jamais à cause d'un e-mail).

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (dans `nexus-vpn/`) ; envoi réel via `php artisan tinker` |
| Résultat | **112 réussis, 0 échec** (438 assertions) ; e-mail livré via Gmail |

### 2026-10-06 — Suppression d'utilisateur par l'administrateur

Ajout de `DELETE /api/admin/users/{user}` qui réutilise `User::closeAccount()` (logique partagée avec `DELETE /api/account`). Six tests ajoutés (112 → 118). Frontend : `pnpm lint`, `tsc --noEmit`, `pnpm build` réussis.

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (dans `nexus-vpn/`) |
| Résultat | **118 réussis, 0 échec** (460 assertions) |

### 2026-10-06 — Enquête connexion (« mot de passe invalide »)

Signalement de connexions en échec. Vérification (lecture seule) de la base de dev : aucun utilisateur en *soft delete* (`onlyTrashed` vide), aucune entrée d'audit `account.deleted` (la fonctionnalité de suppression n'a jamais touché ces comptes), et les 6 comptes actifs ont des empreintes bcrypt valides (`$2y$12$…`, 60 caractères). Les ids manquants (3, 4, 8, 9, 10) sont des `forceDelete` (utilisateurs jetables des tests e-mail), pas des comptes anonymisés. La logique `login`/`register` n'a pas changé lors de l'extraction de `User::closeAccount()`. Conclusion : pas de régression ; un échec « Invalid email or password » (401) correspond à un mot de passe ne correspondant pas à l'empreinte stockée pour cet e-mail (ou >5 essais ⇒ 429). Trois tests de régression ajoutés (118 → 121).

| Élément | Valeur |
|---|---|
| Commande | `php artisan test --compact` (base de test `:memory:` uniquement) |
| Résultat | **130 réussis, 0 échec** (502 assertions) |

## 4. Frontend (application Next.js)

### 4.1 Tests existants

Aucun test automatisé du frontend : pas de fichier `*.test.*` / `*.spec.*`, pas d'outil de test (Jest, Vitest, Playwright, Cypress) dans `package.json`, pas de script `test`. La qualité du frontend est vérifiée uniquement par l'analyse statique (ESLint), le contrôle de types (TypeScript) et le build de production.

### 4.2 Vérifications du 2026-10-05 — référence frontend (audit de base)

Environnement : Windows 10, Node.js v22.15.0, pnpm 10.34.6 (`npx pnpm@10`), dépendances déjà installées (`node_modules/` présent, aucune installation effectuée). Commit vérifié : `05f64b7` (aucune modification du code). Commandes exécutées depuis la racine du dépôt, l'une après l'autre.

| Vérification | Commande | Résultat | Durée (horloge) |
|---|---|---|---|
| Analyse statique | `pnpm lint` (`eslint .`) | **Réussi** : code de sortie 0, aucune erreur ni aucun avertissement affiché | ~48 s |
| Contrôle de types | `pnpm exec tsc --noEmit` | **Réussi** : code de sortie 0, aucune erreur | ~21 s |
| Build de production | `pnpm build` (`next build`, Next.js 16.2.6, Turbopack) | **Réussi** : code de sortie 0 ; « Compiled successfully in 20.8s », TypeScript terminé en 26.3s, 8/8 pages statiques générées | ~64 s |

Routes produites par le build (toutes pré-rendues en statique « ○ »), plus le Proxy :

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /dashboard
├ ○ /payment/result
├ ○ /reset-password
└ ○ /verify-email

ƒ Proxy (Middleware)
```

## 5. Audit final de bout en bout (2026-10-07)

Audit complet avant soutenance (rapport : `18-audit-final.md`). Base de développement sauvegardée au préalable ; aucune modification du code (l'état audité est l'état final). Tests exécutés sur la base `:memory:` ; parcours E2E sur le **build de production** (`php artisan serve` + `pnpm start`), pilotés par Playwright (Chromium headless), un contexte à la fois (RAM limitée).

**Base de référence re-vérifiée :** `php artisan test` → 130 réussis (502 assertions) ; `pnpm lint`, `tsc --noEmit`, `next build` → réussis.

**Parcours E2E vérifiés en direct (21/22) :**

| Parcours | Résultat |
|---|---|
| Accueil : rendu, offres (après défilement), bascule de thème, formulaire contact | ✅ |
| Mauvais mot de passe → `401` | ✅ |
| Verrouillage après 5 échecs → `429` | ✅ (`401×5` puis `429`) |
| Connexion utilisateur de démo + tableau de bord | ✅ |
| Utilisateur normal bloqué sur `/admin` (page) et API admin (`403`) | ✅ |
| Checkout Chargily (mode test) → URL `pay.chargily.dz` | ✅ |
| Admin : connexion + 8 onglets sans erreur de console | ✅ |
| Admin ne peut pas se supprimer lui-même → `422` | ✅ |
| Visiteur non connecté → `/admin` et `/dashboard` redirigés (`307`) | ✅ |
| Envoi e-mail de vérification via **Gmail SMTP** (en direct) | ✅ (≈ 6 s, synchrone — R-19) |

Le seul contrôle non concluant (« offres présentes immédiatement ») est une **limite du scénario de test** (offres chargées paresseusement + animées à l'apparition), pas un bug : les offres s'affichent bien après défilement.

**Bugs trouvés : 0.** Deux observations mineures ajoutées au registre des risques : **R-26** (`401` attendu sur `/me` journalisé dans la console pour les visiteurs), **R-27** (N+1 borné et négligeable à la sérialisation des paiements). Aucune ne requiert de correction.

## 6. Vérification du correctif P-24 (2026-10-12)

| Contrôle | Commande / outil | Résultat |
|---|---|---|
| `/dashboard` (utilisateur de démo) et `/admin` (administrateur) se chargent sans boucle | Script Playwright ad hoc (journal réseau + navigations), serveur `pnpm dev`, avant puis après redémarrage | ✅ une seule navigation par page ; 0 panic Turbopack |
| Lint / types / build | `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` | ✅ |
| Backend | `php artisan test --compact` | ✅ 131 réussis (508 assertions) |

## 7. Correctifs R-03 et environnement local (2026-10-15)

| Contrôle | Commande / outil | Résultat |
|---|---|---|
| Suite backend **avant** correctif, PHP local sans `sodium` | `php artisan test --compact` | ❌ 9 échecs (`Call to undefined function sodium_crypto_scalarmult_base()` : extension désactivée dans le `php.ini` WAMP local), 122 réussis — problème d'environnement, pas de code |
| Suite backend après activation de `extension=sodium` (WAMP) | `php artisan test --compact` | ✅ 131 réussis (508 assertions) |
| Suite backend après suppression des routes héritées (R-03) | `php artisan test --compact` | ✅ 110 réussis (460 assertions) |
| Style PHP | `vendor/bin/pint --dirty` | ✅ |
| Frontend | `pnpm lint`, `pnpm exec tsc --noEmit` | ✅ |
| Page `/` du domaine Render avant correctif | `curl https://nexus-vpn-api.onrender.com/` | `500 Server Error` (page Inertia sans build Vite) |
| IP vue par Laravel en production (R-05) | Tentatives de connexion (identifiants fictifs) sur `POST /api/auth/login` direct et via Vercel, lecture de `X-RateLimit-Remaining` | Compteurs multiples pour un même client (`0`, `2`, `1` restants) ; 12–13 tentatives sans `429` pour une limite de 10/min → IP de proxys changeantes (voir `08` R-05) |
