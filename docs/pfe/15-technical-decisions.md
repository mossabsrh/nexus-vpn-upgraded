# 15 — Décisions techniques

> Décisions **visibles dans le code** (audit du 2026-10-05). La comparaison technique est factuelle ; les **raisons personnelles du choix** ne sont pas déductibles du code et sont marquées ⚠️ À VÉRIFIER, sauf quand un commentaire du code ou `DEPLOYMENT.md` les explique. Aucune source externe n'a encore été consultée pour ces comparaisons (voir `16-sources.md`).

## TD-01 — Frontend Next.js séparé + API Laravel

* **Contexte** : le backend vient d'un starter kit Laravel + Inertia + React (`05-backend.md` §10), mais l'interface réelle est une application Next.js distincte.
* **Alternatives** : (a) monolithe Laravel + Inertia/React ; (b) monolithe Laravel + Blade ; (c) frontend Next.js + API Laravel (retenu).
* **Comparaison** : (a)/(b) : un seul déploiement, pas de contrat API à maintenir, sessions natives ; mais l'interface dépend du cycle de Laravel. (c) : déploiements et outils indépendants (Vercel, Turbopack), séparation nette des responsabilités ; en contrepartie, contrat API à maintenir (`07-api.md`), deux hébergements et une couche de proxy.
* **Choix** : (c). ⚠️ À VÉRIFIER : raison du passage d'Inertia à Next.js (génération de l'interface avec v0 ? hébergement Vercel ? compétences ?).
* **Conséquences** : code hérité Inertia à nettoyer (R-20) ; nécessité d'une réécriture `/backend-api` (TD-02).

## TD-02 — Même origine par réécriture + session cookie (sans jetons)

* **Contexte** : le frontend (Vercel) et l'API (Render) sont sur deux domaines.
* **Alternatives** : (a) jetons Bearer (Sanctum « API tokens » ou JWT) stockés côté client ; (b) Sanctum SPA avec cookies cross-domain (CORS + domaine partagé) ; (c) réécriture Next.js vers l'API + session cookie Laravel classique (retenu).
* **Comparaison** : (a) indépendant des cookies mais jeton accessible à JavaScript (exposé au XSS), révocation plus complexe. (b) nécessite des sous-domaines communs et une configuration CORS/cookies délicate. (c) cookies de première partie, `HttpOnly`, `SameSite=lax`, CSRF natif, CSP `connect-src 'self'` ; coût : un saut réseau supplémentaire via Vercel et dépendance à `NEXT_PUBLIC_API_URL`.
* **Choix** : (c), justifié dans le code (`next.config.mjs` : « all API calls go through the same-origin rewrite » ; `DEPLOYMENT.md` : « the browser stays on the Vercel origin »).
* **Conséquences** : gestion explicite du CSRF dans `lib/api.ts` ; `TRUSTED_PROXIES` nécessaire (P-08, R-05) ; `proxy.ts` doit appeler l'API directement côté serveur. Détails : `08-authentication-security.md` §1.

## TD-03 — Chargily Pay v2 via le client HTTP de Laravel

* **Contexte** : paiement en ligne en dinars algériens.
* **Alternatives** : Stripe/PayPal (non adaptés aux cartes locales EDAHABIA/CIB ⚠️ À VÉRIFIER), SDK PHP Chargily, appel direct de l'API REST Chargily (retenu).
* **Comparaison** : l'appel REST direct (`Http::withToken()`) évite une dépendance supplémentaire et donne un contrôle total (délais, journalisation, gestion d'erreurs) ; il faut en revanche implémenter soi-même la vérification HMAC du webhook. Chargily Pay v2 n'offre pas d'API de remboursement (commentaire dans `Payment::recordRefund`).
* **Choix** : API REST directe. ⚠️ À VÉRIFIER : raisons du choix de Chargily et de l'absence de SDK.
* **Conséquences** : paiements ponctuels (TD-09), remboursements enregistrés manuellement (R-25), mode test uniquement (TD-13).
* **Contradiction documentée (champ webhook)** : la documentation officielle Chargily diffère selon la page — le guide *Webhooks* nomme le paramètre `webhook_url`, tandis que la *API Reference* (page « Create a Checkout ») et l'objet *Checkout* nomment le champ `webhook_endpoint`. Décision : envoyer **`webhook_endpoint`** (conforme à la référence API et à l'objet renvoyé), tout en conservant le nom de variable d'environnement `CHARGILY_WEBHOOK_URL` côté projet. Sources dans `16-sources.md`.

## TD-13 — Chargily Pay en mode test uniquement (sandbox)

* **Contexte** : projet académique (PFE) ; aucune transaction réelle n'est souhaitée. Le mode live exige des documents légaux (registre de commerce ou carte d'auto-entrepreneur, NIF/NIS, compte bancaire ou CCP) que le projet n'a pas vocation à fournir.
* **Choix** : `CHARGILY_MODE=test` ; appels dirigés vers `https://pay.chargily.net/test/api/v2` ; clés `test_sk_` / `test_pk_` ; cartes de test de la documentation Chargily pour simuler les paiements. La clé secrète n'est **jamais** versionnée (hors de git, de `docs/pfe/` et de la mémoire ; `.env.example` ne contient que les noms de variables).
* **Conséquences** : aucun encaissement réel ; le garde-fou production (`AppServiceProvider::guardProductionConfiguration`) journalise volontairement « CHARGILY_MODE is not live » tant que le mode test est actif — avertissement attendu et correct dans ce contexte. Le passage en live nécessiterait l'activation légale du compte marchand.
* ⚠️ À VÉRIFIER : toute autre raison que le caractère académique du projet (par ex. échéancier, absence de compte marchand validé).

## TD-04 — WireGuard, clés générées côté serveur

* **Contexte** : fournir à chaque client une configuration VPN prête à importer.
* **Alternatives** : OpenVPN (certificats, configuration plus lourde) ; WireGuard avec clés générées par le client (seule la clé publique est envoyée) ; WireGuard avec clés générées par le serveur (retenu).
* **Comparaison** : générer côté serveur permet de livrer un fichier `.conf` complet en un clic, mais le serveur détient la clé privée (stockée chiffrée, `08` §8). La génération côté client éviterait ce stockage mais exige un outil chez l'utilisateur. WireGuard repose sur des clés Curve25519, générables en PHP avec `sodium` sans dépendance externe.
* **Choix** : WireGuard, clés serveur. ⚠️ À VÉRIFIER : raisons (simplicité pour l'utilisateur ? démonstration ?).
* **Conséquences** : dépendance à `APP_KEY` pour lire les clés ; synchronisation de la passerelle manuelle (R-01).

## TD-05 — SQLite en local et tests, PostgreSQL en production

* **Alternatives** : MySQL/MariaDB partout (script `db/schema.sql` historique en MySQL), PostgreSQL partout, SQLite + PostgreSQL (retenu).
* **Comparaison** : SQLite ne demande aucun serveur en développement et permet des tests rapides en mémoire ; PostgreSQL est proposé gratuitement par Render et supporte les index partiels utilisés par P-01 (comme SQLite, contrairement à MySQL). Risque : différences de comportement entre SGBD non testées (aucun test sur PostgreSQL, `12-testing.md`).
* **Choix** : SQLite + PostgreSQL. ⚠️ À VÉRIFIER : pourquoi l'abandon de MySQL (`db/schema.sql`).
* **Conséquences** : migrations écrites pour être portables (statuts en `varchar`, index partiel conditionné au pilote).

## TD-06 — Hébergement Vercel (frontend) + Render Docker (backend)

* **Alternatives** : un VPS unique ; Laravel Cloud / Forge ; Vercel + Render (retenu).
* **Comparaison** : Vercel est l'hébergeur natif de Next.js ; Render permet d'exécuter le conteneur PHP/Apache et fournit PostgreSQL, avec un Blueprint (`render.yaml`) versionné. Les offres gratuites imposent mise en veille et expiration de la base (R-02, R-04). Un VPS donnerait plus de contrôle (cron, passerelle WireGuard sur la même machine) au prix de l'administration système.
* **Choix** : Vercel + Render Free, explicitement présenté comme environnement de **test** (`DEPLOYMENT.md`). ⚠️ À VÉRIFIER : raisons (gratuité ? simplicité ?) et cible de production envisagée.
* **Conséquences** : planificateur dans le conteneur web, pas de worker séparé, base à renouveler.

## TD-07 — Logique métier dans les modèles, validation en ligne

* **Alternatives** : couche `Services/`, FormRequests et Policies, Eloquent API Resources ; ou logique dans les modèles + `$request->validate()` + `toApiArray()` (retenu).
* **Comparaison** : l'approche retenue garde le code compact et localisé (chaque modèle porte ses règles : `Payment::markSucceeded`, `Subscription::cancel`) ; elle rend les modèles volumineux et mélange formatage et domaine, et la casse des réponses n'est pas uniforme (`07-api.md` §13.2).
* **Choix** : retenu tel quel. ⚠️ À VÉRIFIER : choix délibéré ou évolution organique ?
* **Conséquences** : 130 tests de fonctionnalités couvrent ces méthodes via HTTP ; refactorisation possible (`19-limitations-and-future-work.md`).

## TD-08 — Pas de file d'attente : notifications synchrones

* **Alternatives** : notifications `ShouldQueue` avec un worker (`queue:work`) ; envoi synchrone (retenu).
* **Comparaison** : la file d'attente sort la latence SMTP des requêtes et permet les réessais, mais exige un processus worker (non disponible simplement sur l'offre gratuite). L'envoi synchrone est encapsulé dans des `try/catch` pour ne jamais bloquer le flux métier.
* **Choix** : synchrone. ⚠️ À VÉRIFIER : raison (contrainte d'hébergement ?).
* **Conséquences** : tables `jobs` inutilisées, R-19.

## TD-09 — Paiements ponctuels et double confirmation

* **Contexte** : Chargily Pay v2 traite des paiements uniques (commentaire de `Subscription::cancel` : « Chargily payments are one-off, nothing auto-renews »).
* **Alternatives** : abonnement récurrent chez un fournisseur qui le permet ; paiement ponctuel par période + rappels (retenu). Pour la confirmation : webhook seul, vérification active seule, ou les deux (retenu).
* **Comparaison** : la double confirmation couvre un webhook retardé ou perdu (la page de résultat interroge Chargily) ; elle impose l'idempotence (P-03).
* **Choix** : retenu. **Conséquences** : rappels par e-mail avant la fin de période ; annulation = fin de l'accès à l'échéance.

## TD-10 — Intégrité garantie par la base de données

* **Choix** : index unique partiel, contraintes `unique`, clés étrangères `RESTRICT`/`SET NULL`, soft deletes, montants entiers (`06-database.md` §5).
* **Alternative** : contrôles uniquement applicatifs, plus simples mais vulnérables aux accès concurrents.
* **Conséquences** : les contrôleurs traduisent les violations de contraintes en réponses 409 ; dépendance au support des index partiels (R-18).

## TD-11 — Interface : Tailwind CSS 4 + shadcn/ui

* **Alternatives** : bibliothèque de composants packagée (MUI, Chakra), CSS sur mesure, shadcn/ui (composants copiés dans le projet) + Tailwind (retenu).
* **Comparaison** : shadcn/ui fournit des primitives accessibles (Radix) modifiables localement ; inconvénient observé : de nombreux composants générés restent inutilisés (R-21).
* **Choix** : retenu, cohérent avec la génération initiale par v0. ⚠️ À VÉRIFIER : choix délibéré ou hérité de v0.

## TD-12 — Contrôle d'accès des pages côté serveur Next.js

* **Alternatives** : protection uniquement côté client ; contrôle serveur avec `proxy.ts` (retenu).
* **Comparaison** : le contrôle serveur évite de livrer l'interface d'administration aux non-administrateurs, au prix d'un appel `/api/me` par chargement de page protégée (délai 4 s).
* **Choix** : retenu, avec politique fail-closed pour `/admin` et fail-open pour `/dashboard` (commentaire dans `proxy.ts`). Voir P-07.

## TD-14 — Suppression de compte par anonymisation (plutôt que suppression physique)

* **Contexte** : fournir une suppression de compte en libre-service tout en conservant l'historique de facturation. Le schéma durci utilise `restrictOnDelete` sur `subscriptions.user_id`, `payments.user_id` et `vpn_credentials.user_id` (et `SoftDeletes` sur `User`, `Payment`, `Subscription`), précisément pour ne pas perdre cet historique.
* **Alternatives** : suppression physique (hard delete) de l'utilisateur et de toutes ses données ; anonymisation + *soft delete* en conservant les lignes de facturation (retenu).
* **Choix** : **anonymisation + soft delete**. Les données personnelles (nom, e-mail, mot de passe, jeton) sont effacées ; l'utilisateur est *soft-deleted* (ne peut plus s'authentifier) ; l'e-mail d'origine est libéré par un e-mail de remplacement unique ; les paiements et abonnements sont conservés. Évite aussi de se heurter aux contraintes `restrictOnDelete`.
* **Conséquences** : l'historique de facturation reste exploitable (statistiques admin) ; un tiers ne peut plus relier ces lignes à une personne ; les administrateurs et propriétaires d'équipe sont exclus de cette voie (support). La synchronisation WireGuard restant manuelle (R-01), les pairs révoqués ne disparaissent de la passerelle qu'au prochain export `vpn:peers`.

## TD-15 — API mobile : jetons Sanctum (sans toucher au login web ; app reportée)

* **Contexte** : prévoir une application mobile cliente consommant la même API. L'authentification web (session + CSRF) convient au navigateur mais pas à une application native.
* **Alternatives** : JWT (révocation plus complexe, jeton exposé au stockage client) ; Sanctum SPA par cookies (inadapté au natif) ; **Sanctum « API tokens » (Bearer)** (retenu).
* **Choix** : ajouter **Laravel Sanctum** sur un groupe de routes `/api/mobile/*` placé **hors du groupe `web`** (donc sans session ni CSRF), en **réutilisant les contrôleurs existants** et **sans modifier le login web**. Durée de vie du jeton 30 jours ; révocation à la déconnexion, au changement de mot de passe et à la suppression de compte.
* **Conséquences** : table `personal_access_tokens` ; 9 tests ajoutés (130 au total ; login web vérifié inchangé). **L'application mobile (Flutter) est reportée** (D-16 du mémoire) ; le back-end à jetons est conservé pour la reprise.

## TD-16 — E-mail en production via Brevo (API HTTP), car Render Free bloque le SMTP

* **Contexte** : depuis 2025-09, **Render Free bloque les ports SMTP sortants (25/465/587)** ; la configuration Gmail SMTP ne pourra donc pas livrer d'e-mails en production.
* **Alternatives** : instance Render payante (garde le SMTP) ; Resend/Mailgun/Postmark (API HTTP mais exigent souvent un domaine vérifié) ; **Brevo** via API HTTP (retenu).
* **Choix** : **Brevo**, qui fonctionne avec un **expéditeur unique vérifié, sans domaine**. En local, Gmail SMTP est conservé.
* **Conséquences** : deux paquets Symfony (`symfony/brevo-mailer`, `symfony/http-client`), un mailer `brevo` et une clé API créée par l'étudiant ; **câblé le 2026-10-18** (méthode officielle Laravel 12, `13-deployment.md`). Activation effective en production dès la saisie de `BREVO_API_KEY` dans Render.

**Total : 16 décisions documentées.**
