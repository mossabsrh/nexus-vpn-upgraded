# 14 — Problèmes rencontrés et solutions

> Travaux significatifs **visibles dans le code** à la date de l'audit (2026-10-05). Le problème et la solution sont déduits du code, des commentaires et des tests ; le **symptôme d'origine, l'enquête et la date** ne sont pas traçables (historique antérieur non versionné, voir `11-development-history.md`) et sont marqués ⚠️ À VÉRIFIER. Les risques encore ouverts sont dans `08-authentication-security.md` §11.

## P-01 — Abonnements « courants » en double et perte d'historique de facturation

* **Problème** : un utilisateur pouvait avoir plusieurs abonnements actifs/en essai en même temps, et la suppression d'un utilisateur ou d'une offre pouvait faire disparaître l'historique de facturation.
* **Solution** : migration `2026_10_05_000012_harden_billing_schema` : dédoublonnage des abonnements courants existants (seul le plus récent est conservé), **index unique partiel** `subscriptions_one_current_per_user`, clés étrangères `RESTRICT` sur `subscriptions.user_id` et `payments.user_id`, soft deletes sur `users`, `plans`, `subscriptions`, `payments`, statut `varchar(20)` au lieu d'un enum, `plans.is_active`. Les contrôleurs interceptent `UniqueConstraintViolationException` (essai concurrent, abonnement Team).
* **Fichiers** : migration ci-dessus, `app/Models/Subscription.php`, `app/Http/Controllers/Api/PaymentController.php`, `AdminBillingController.php`.
* **Vérification** : `PaymentFlowTest::test_the_database_refuses_a_second_current_subscription`.
* ⚠️ À VÉRIFIER : symptôme observé (doublons constatés en base ? bug d'essai ?), date.

## P-02 — Webhook de paiement falsifiable

* **Problème** : un appel non authentifié au webhook aurait pu marquer un paiement comme réussi.
* **Solution** : vérification HMAC-SHA256 du corps brut avec la clé secrète Chargily, comparaison en temps constant, rejet si la signature manque (400) ou est invalide (403) ; route hors session/CSRF avec limiteur `webhooks`.
* **Fichiers** : `PaymentController::webhook()`, `verifySignature()`, `routes/api.php`.
* **Vérification** : `ChargilyPaymentTest::test_webhook_rejects_invalid_signature`.
* ⚠️ À VÉRIFIER : la vérification a-t-elle existé dès l'intégration Chargily ou a-t-elle été ajoutée après coup ?

## P-03 — Double activation d'un paiement (webhook et vérification concurrents)

* **Problème** : le webhook Chargily, ses rejeux et la vérification active depuis la page de résultat peuvent arriver en même temps et prolonger l'abonnement plusieurs fois.
* **Solution** : transition `pending → succeeded` par mise à jour conditionnelle (`where status = pending`) sur une ligne verrouillée (`lockForUpdate`) dans une transaction ; seul l'appelant qui « réclame » la transition applique le paiement ; `provider_reference` unique.
* **Fichiers** : `app/Models/Payment.php` (`markSucceeded`, `markFailed`), migration `000012`.
* **Vérification** : `test_replayed_webhook_and_later_verify_apply_the_payment_only_once`, `test_a_payment_that_is_no_longer_pending_cannot_be_claimed_again`.
* ⚠️ À VÉRIFIER : incident d'origine.

## P-04 — Webhook reçu avant l'enregistrement du checkout

* **Problème** : Chargily peut notifier très vite ; si le paiement local était créé après l'appel à Chargily, le webhook ne le retrouverait pas.
* **Solution** : le paiement `pending` est enregistré **avant** l'appel à Chargily (commentaire « Recorded before calling Chargily so a fast webhook always finds it ») ; un checkout inconnu renvoie 404 pour que Chargily réessaie.
* **Fichiers** : `PaymentController::createCheckout()`, `webhook()`.
* **Vérification** : `test_checkout_records_the_payment_first_and_returns_to_the_frontend_result_page`, `test_webhook_for_unknown_checkout_returns_404_so_chargily_retries`.

## P-05 — Montant de paiement contrôlé par le client

* **Problème** : un client ne doit pas pouvoir choisir le montant payé, et un montant confirmé incohérent ne doit pas activer l'abonnement.
* **Solution** : montant calculé côté serveur à partir de l'offre ; activation refusée si le montant confirmé par Chargily diffère (`error_code = amount_mismatch`).
* **Fichiers** : `PaymentController::createCheckout()`, `applyCheckoutStatus()`.
* **Vérification** : `test_checkout_ignores_client_supplied_amount`, `test_webhook_with_a_different_amount_does_not_activate`.

## P-06 — Jeton CSRF expiré (erreur 419) côté frontend

* **Problème** : après régénération de session (connexion, inscription) ou expiration, une requête modifiante échoue avec 419.
* **Solution** : `apiFetch` obtient le cookie CSRF à la demande, partage la requête entre appels simultanés, et en cas de 419 force un nouveau jeton puis **rejoue une fois**.
* **Fichiers** : `lib/api.ts`.
* **Vérification** : ⚠️ À VÉRIFIER — aucun test automatisé frontend ; vérification manuelle à documenter.

## P-07 — Interface d'administration livrée aux non-administrateurs

* **Problème** : une protection uniquement côté client enverrait le code de la console à n'importe quel visiteur.
* **Solution** : `proxy.ts` vérifie la session et le rôle auprès de `GET /api/me` avant de servir `/admin` ; en cas d'erreur ou de délai dépassé, **refus par défaut** (fail-closed). `/dashboard` reste servi en cas de panne backend (fail-open assumé).
* **Fichiers** : `proxy.ts`, `app/admin/page.tsx`.
* **Vérification** : ⚠️ À VÉRIFIER — pas de test automatisé ; vérification manuelle à documenter.

## P-08 — Limites de débit partagées par tous les visiteurs derrière le proxy

* **Problème** : toutes les requêtes passant par Vercel puis le proxy de Render, Laravel voyait la même IP pour tous les visiteurs ; les limites par IP auraient bloqué tout le monde ensemble (commentaire dans `bootstrap/app.php`).
* **Solution** : configuration des proxys de confiance via `TRUSTED_PROXIES`.
* **Fichiers** : `bootstrap/app.php`, `render.yaml`.
* **Effet secondaire** : la valeur `*` ouvre la possibilité de forger `X-Forwarded-For` (risque R-05).

## P-09 — Le démarrage du conteneur écrasait les offres modifiées par l'admin

* **Problème** : `migrate --seed` s'exécute à chaque démarrage ; un seeder non idempotent réécrivait ou recréait les offres modifiées ou supprimées par l'administrateur.
* **Solution** : `PlansTableSeeder` idempotent qui ne touche pas aux offres existantes ni aux offres supprimées.
* **Fichiers** : `database/seeders/PlansTableSeeder.php`, `docker/entrypoint.sh`.
* **Vérification** : `test_database_seeders_are_idempotent_when_run_twice`, `test_reseeding_does_not_overwrite_plans_edited_by_admins`, `test_reseeding_does_not_restore_plans_deleted_by_admins`.
* ⚠️ À VÉRIFIER : date de découverte du problème.

## P-10 — Jours payés perdus lors d'un réabonnement après annulation

* **Problème** : un utilisateur qui annule puis se réabonne à la même offre perdait les jours déjà payés.
* **Solution** : le nouvel abonnement démarre à la fin de la période payée restante d'un abonnement annulé à la même offre ; les abonnements annulés/expirés ne sont jamais « ressuscités ».
* **Fichiers** : `Payment::applyToSubscription()`.
* **Vérification** : `test_resubscribing_after_a_cancellation_keeps_the_days_already_paid_for`, `test_resubscribing_after_a_cancelled_period_ended_starts_from_now`, `test_paid_checkout_creates_a_new_subscription_instead_of_reviving_a_canceled_one`.

## P-11 — Prix affichés différents des prix facturés

* **Problème** : un prix codé en dur ou mis en cache trop longtemps dans le frontend pourrait différer du montant réellement facturé.
* **Solution** : aucun prix de repli dans le frontend (`hooks/use-pricing.ts`, message d'erreur avec bouton de réessai) ; cache serveur des offres invalidé à chaque modification par l'administrateur (`PricingController::flushCache()`).
* **Vérification** : `test_plans_with_history_are_deactivated_not_deleted_and_pricing_updates_immediately`.

## P-12 — Liens des e-mails pointant vers le backend au lieu du frontend

* **Problème** : les notifications natives de Laravel (vérification, réinitialisation) génèrent des liens vers l'application Laravel, alors que l'interface est le frontend Next.js ; de même pour les anciennes URL de retour Chargily.
* **Solution** : `AppServiceProvider::configureEmailLinks()` construit des liens `FRONTEND_URL/verify-email?...` (avec la signature de la route API) et `FRONTEND_URL/reset-password?...` ; les routes `/payment/success|failed` redirigent vers `FRONTEND_URL/payment/result`.
* **Vérification** : `test_signed_verification_link_verifies_the_email`, `test_legacy_payment_return_pages_redirect_to_the_frontend_result_page`.

## P-13 — Collision d'adresses tunnel VPN en cas d'émissions simultanées

* **Problème** : deux émissions concurrentes pouvaient calculer la même adresse IP de tunnel.
* **Solution** : contrainte `unique` sur `vpn_credentials.address` et `public_key`, jusqu'à 5 tentatives en cas de violation ; adresses jamais réutilisées.
* **Fichiers** : `app/Models/VpnCredential.php`.
* **Vérification** : `test_peers_get_distinct_tunnel_addresses`.

## P-14 — « Mot de passe oublié » n'envoyait jamais d'e-mail

* **Problème** : la demande de réinitialisation échouait silencieusement.
* **Cause** : `config/auth.php` visait la table `password_reset_tokens` alors que la migration crée `password_resets`.
* **Solution** : valeur par défaut `password_resets` ; puis flux complet en API (`auth/forgot-password`, `auth/reset-password`) avec réponse identique que le compte existe ou non.
* **Fichiers** : `nexus-vpn/config/auth.php`, `AuthController.php`, `app/reset-password/page.tsx`.
* **Vérification** : `test_forgot_password_does_not_reveal_whether_an_account_exists`, `test_password_can_be_reset_with_a_valid_token_only`.

## P-15 — Paramètres du compte : formulaires e-mail / mot de passe en échec

* **Problème** : l'enregistrement plantait et le bouton restait bloqué.
* **Cause** : `account-menu.tsx` appelait `auth.updateEmail` et `auth.updatePassword`, absents du contexte d'authentification, et l'API n'avait pas d'endpoint correspondant (erreur révélée par `tsc`, masquée au build par `ignoreBuildErrors`).
* **Solution** : fonctions ajoutées dans `auth-provider.tsx`, endpoints `PUT /api/account/email` et `PUT /api/account/password` exigeant le mot de passe actuel ; `ignoreBuildErrors` supprimé ensuite.
* **Vérification** : `test_user_can_update_email_and_password`, `test_email_change_returns_fresh_data_and_requires_reverification`.

## P-16 — Rôle `null` dans la réponse d'inscription

* **Cause** : la colonne `role` a une valeur par défaut en base, mais le modèle nouvellement créé ne la contient pas.
* **Solution** : repli sur `"user"` dans la charge utile utilisateur.

## P-17 — 2 431 faux problèmes de lint / types

* **Cause** : `eslint .` et `tsconfig.json` à la racine analysaient l'application Laravel imbriquée, y compris `vendor/` et son `node_modules`.
* **Solution** : exclusion de `nexus-vpn/` dans `eslint.config.mjs` et `tsconfig.json`. Résultat : quelques erreurs réelles restantes, ensuite corrigées (0 problème).

## P-18 — Fuite d'informations internes à l'inscription

* **Cause** : `register()` renvoyait `$e->getMessage()` (messages SQL/PHP) au client.
* **Solution** : exception journalisée côté serveur, message générique renvoyé (500).
* **Vérification** : `test_registration_failure_does_not_leak_internal_errors`.

## P-19 — Chiffres fictifs dans la console d'administration

* **Problème** : renouvellements, revenus, analytique et journaux étaient codés en dur ; le nombre d'« abonnements actifs » comptait en réalité tous les utilisateurs non-admin.
* **Solution** : endpoint `GET /api/admin/stats` calculé depuis les tables `payments`, `subscriptions`, `users`, journal `audit_logs` réel ; section « Settings » sans backend retirée plutôt que laissée factice.
* **Fichiers** : `AdminBillingController.php`, `components/admin/*`.
* **Vérification** : `test_stats_are_computed_from_real_billing_data`.

## P-20 — Bouton « Save name » perçu comme toujours désactivé

* **Symptôme** : dans la liste des comptes, l'administrateur pensait ne pas pouvoir renommer un utilisateur.
* **Investigation** : chaque ligne avait déjà son propre état local et le bouton s'activait bien après modification ; mais ses styles actif et désactivé étaient presque identiques.
* **Solution** : style principal quand le nom est modifié, curseur « interdit » quand désactivé, état « Saving... », resynchronisation du nom enregistré (rogné) et conservation de la saisie en cas d'échec.
* **Fichiers** : `components/admin/accounts.tsx`.
* **Vérification** : `tsc` et ESLint réussis. ⚠️ À VÉRIFIER : test manuel dans le navigateur (aucun outil de test d'interface dans le projet).

## P-21 — Vérification incomplète du montant et de la devise (R-10)

* **Problème** : à la réception d'un checkout `paid`, le contrôle du montant était ignoré lorsque le champ `amount` était absent, et la devise n'était jamais comparée. Un paiement aurait pu être activé sur des données non vérifiables.
* **Solution** : l'activation exige désormais un `amount` présent et égal au montant enregistré **et** une devise concordante (comparaison insensible à la casse). Sinon le paiement reste `pending` avec `error_code = amount_mismatch` ou `currency_mismatch`, et un `Log::critical` est écrit. Le corps du webhook étant signé par Chargily, le risque réel est faible, mais la cohérence est désormais garantie.
* **Fichiers** : `app/Services/ChargilyGateway.php` (`applyCheckoutStatus()`).
* **Vérification** : `test_webhook_without_an_amount_does_not_activate`, `test_paid_checkout_in_another_currency_does_not_activate` (+ `test_webhook_with_a_different_amount_does_not_activate` existant).
* **Risque associé** : R-10 (`08-authentication-security.md`), marqué corrigé.

## P-22 — Paiements restés `pending` jamais réconciliés automatiquement (R-06)

* **Problème** : si le webhook échouait définitivement et que l'utilisateur ne revenait pas sur la page de résultat, un paiement pouvait rester `pending` indéfiniment — un client payé mais jamais activé, jusqu'à une intervention manuelle.
* **Solution** : commande `payments:reconcile` planifiée toutes les 15 minutes. Elle relit le statut réel des checkouts en attente depuis plus de 30 minutes (`GET /checkouts/{id}`) et applique le résultat ; les checkouts toujours impayés après 24 h sont expirés (`POST /checkouts/{id}/expire`) puis marqués en échec. Elle ne fait rien si la clé secrète n'est pas configurée.
* **Effet de bord traité** : si Chargily signale `paid` pour un paiement déjà marqué en échec (argent encaissé mais rien d'activé), un `Log::critical`, l'`error_code = paid_after_failure` (visible dans la facturation admin) et une entrée d'audit `payment.paid_after_failure` sont produits une seule fois.
* **Fichiers** : `app/Console/Commands/ReconcilePayments.php`, `routes/console.php`, `app/Services/ChargilyGateway.php` (`expireCheckout()`, `applyCheckoutStatus()`).
* **Vérification** : `ReconcilePaymentsTest` (5 cas), `test_paid_webhook_for_a_failed_payment_is_flagged_for_the_admin`, `test_duplicate_paid_webhook_for_a_succeeded_payment_is_not_flagged`.
* **Risque associé** : R-06 (`08-authentication-security.md`), marqué corrigé.

## P-23 — Pas de suppression de compte en libre-service

* **Problème** : l'utilisateur ne pouvait pas supprimer son compte depuis l'application (seule subsistait une route web héritée faisant un simple *soft delete* sans annuler l'abonnement ni révoquer le VPN, R-03).
* **Solution** : endpoint `DELETE /api/account` (confirmation par mot de passe) qui **anonymise** les données personnelles et place l'utilisateur en *soft delete* tout en **conservant** les lignes `payments`/`subscriptions` pour l'historique (choix : anonymisation plutôt que suppression physique, TD-14). Annulation de l'abonnement, révocation VPN, détachement des équipes, purge des sessions et jetons de réinitialisation, audit `account.deleted`. Administrateurs et propriétaires d'équipe bloqués (409). Côté frontend : « zone de danger » dans la boîte de dialogue du compte, avec confirmation par mot de passe **et** saisie de l'e-mail.
* **Fichiers** : `app/Http/Controllers/Api/AuthController.php` (`deleteAccount`), `routes/api.php`, `components/account-menu.tsx`, `components/auth-provider.tsx`.
* **Vérification** : `tests/Feature/Api/AccountDeletionTest.php` (5 cas) ; `pnpm lint`, `tsc --noEmit`, `pnpm build` réussis.
* **Hors périmètre** : la route web héritée `DELETE /settings/profile` (R-03) n'a pas été modifiée.

## P-24 — Rechargement en boucle de `/dashboard` et `/admin` en développement

* **Symptôme** (2026-10-12) : en local (`pnpm dev`), `/dashboard` et `/admin` se rechargeaient sans fin et ne s'affichaient jamais ; l'accueil fonctionnait.
* **Investigation** : sauvegarde de la base SQLite, puis reproduction Playwright (utilisateur de démo + administrateur) avec journalisation réseau. **Aucune redirection** : `proxy.ts` laissait passer la requête (`GET /dashboard` → `200`, `/api/me` → `200`) et la page recommençait une navigation complète vers elle-même. Le compte administrateur existait, était vérifié et avait le rôle `admin` ; aucun commit récent ne touchait `proxy.ts`, l'authentification, les sessions, les cookies, CORS ou `.env`. Le journal du serveur de développement montrait à chaque chargement un **panic Turbopack** : `Failed to write app endpoint /dashboard/page — Next.js package not found` (dans `hmr_version_state`).
* **Cause** : le cache persistant de Turbopack (`.next/dev/cache`, ≈ 558 Mo, créé le 2026-10-04) était périmé/corrompu. La compilation HMR de ces routes échouait, et le client Next.js réagit à l'échec HMR par un rechargement complet — d'où la boucle. Aucun défaut dans le code applicatif.
* **Solution** : arrêt du serveur, mise à l'écart de `.next/dev/cache` (cache régénérable), redémarrage de `pnpm dev`. **Aucun fichier source modifié.**
* **Vérification** : Playwright — `/dashboard` (démo) et `/admin` (admin) chargés en une seule navigation, y compris après un second redémarrage ; 0 panic dans le journal ; `pnpm lint`, `tsc --noEmit`, `pnpm build` réussis ; `php artisan test --compact` : 131 réussis.
* **Leçon** : un rechargement en boucle sans redirection HTTP oriente vers l'outillage de développement (HMR) plutôt que vers l'authentification ; lire d'abord le journal du serveur `next dev`. Remède : supprimer `.next/dev/cache` (ou `.next`) puis relancer.

## P-25 — « CSRF token mismatch » à la connexion en production (frontend Vercel non redéployé)

* **Symptôme** (2026-10-13) : sur `https://nexus-vpn-upgraded.vercel.app`, la connexion échouait avec « CSRF token mismatch » après un redéploiement du backend.
* **Investigation** : le backend Render répondait normalement (`/up` → `200`, `/api/pricing` → `200` avec données PostgreSQL) ; via la réécriture Vercel, `csrf-cookie` → `204` avec cookies `XSRF-TOKEN` / `laravel_session` corrects (`path=/; secure; samesite=lax`) et une connexion (identifiants fictifs) avec session neuve → `401` attendu. En revanche, le JavaScript servi par Vercel ne correspondait pas au dépôt : `apiFetch` envoyait `/auth/login` avec `skipCsrf: true` et sans nouvel essai sur `419` (ancien code de `D:\nexus-vpn-upgraded.v2`). La liste des déploiements Vercel s'arrêtait au commit `6d6da5b` (2026-10-04) ; le commit `07a2307` présent sur GitHub `main` (auteur bien lié au compte `mossabsrh`) n'avait **aucun statut Vercel**.
* **Cause** : le projet Vercel n'était plus relié au dépôt GitHub ; aucun push postérieur au 2026-10-04 n'avait déclenché de déploiement. L'ancien frontend, sans rafraîchissement du jeton, renvoyait un cookie `XSRF-TOKEN` périmé conservé par le navigateur → `419`.
* **Solution** : reconnexion du dépôt `mossabsrh/nexus-vpn-upgraded` au projet Vercel puis déploiement de `main`. **Aucun fichier source modifié** : le code actuel de `lib/api.ts` (`ensureCsrfCookie`, nouvel essai unique sur `419`) corrigeait déjà le problème. Contournement immédiat : supprimer les cookies du site.
* **Vérification** : `pnpm build` réussi sur un clone propre de `07a2307` ; après déploiement, le bundle en ligne contient la logique `419 → nouvel essai` (plus de `skipCsrf`) ; simulation avec un cookie `XSRF-TOKEN` périmé : premier essai `419`, nouvel essai après `csrf-cookie` → `401` (identifiants fictifs), soit le comportement attendu.
* **Leçon** : en cas d'écart entre le code et le comportement en production, vérifier d'abord **quelle version est déployée** (bundle servi, liste des déploiements, statuts de commit GitHub) avant de déboguer le code.

**Total : 25 problèmes documentés.**
