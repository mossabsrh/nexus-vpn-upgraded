# 13 — Déploiement et environnement de développement

> Audit de référence du 2026-10-05 (étape 3/4). Sources : `DEPLOYMENT.md`, `render.yaml`, `nexus-vpn/Dockerfile`, `nexus-vpn/.dockerignore`, `nexus-vpn/docker/*`, `next.config.mjs`, `package.json`, `nexus-vpn/composer.json`, `nexus-vpn/.env.example` (noms de variables uniquement). Le déploiement réel (tableaux de bord Vercel/Render) n'a pas été consulté : ce qui n'est pas prouvé par ces fichiers est marqué ⚠️ À VÉRIFIER.

## 1. Vue d'ensemble

| Composant | Hébergeur | Type | Région / offre |
|---|---|---|---|
| Frontend Next.js (racine du dépôt) | **Vercel** | Application Next.js | ⚠️ À VÉRIFIER : offre et région (aucun `vercel.json` ni dossier `.vercel` dans le dépôt ; configuration par défaut de Vercel) |
| API Laravel (`nexus-vpn/`) | **Render** | Service web `nexus-vpn-api`, runtime **Docker** | Francfort, offre **Free** (`render.yaml`) |
| Base de données | **Render PostgreSQL** | `nexus-vpn-db` (base `nexus_vpn`, utilisateur `nexus_vpn`) | Francfort, offre **Free** |
| Paiement | Chargily Pay v2 | Service externe | Mode `test` dans `render.yaml` |
| Passerelle VPN WireGuard | — | Serveur externe | ⚠️ À VÉRIFIER : aucun serveur WireGuard n'est décrit dans le dépôt (seules `VPN_SERVER_PUBLIC_KEY`/`VPN_SERVER_ENDPOINT` sont attendues) |
| Envoi d'e-mails | **Dev : Gmail SMTP** ; **Production : Brevo (API HTTP)** | Service externe | ⚠️ **Render Free bloque le SMTP sortant (25/465/587)** → la production utilise l'API HTTP **Brevo** (expéditeur unique vérifié, sans domaine ; D-17 du mémoire, `15` TD-16). Câblé le 2026-10-18 ; `BREVO_API_KEY` et `MAIL_FROM_ADDRESS` à saisir dans Render |

Flux en production : navigateur → Vercel (`/backend-api/*` réécrit) → Render (`/api/*`) → PostgreSQL. Chargily appelle directement le webhook sur le domaine Render. Détails du flux : `07-api.md` §1.

## 2. Frontend sur Vercel

* **Build** : `next build` (script `build` de `package.json`) ; **démarrage** : géré par Vercel (équivalent `next start`). Gestionnaire de paquets : pnpm (lockfile `pnpm-lock.yaml` v9 ; `pnpm-workspace.yaml` autorise les scripts de build de `sharp` et `unrs-resolver`).
* **Variable requise** : `NEXT_PUBLIC_API_URL` = origine publique du service Render (sans `/api` ni barre finale), à définir pour l'environnement Production (et Preview si utilisé). Le build **échoue volontairement** sur Vercel si elle manque (`next.config.mjs`).
* `DEPLOYMENT.md` précise de ne pas utiliser `127.0.0.1` sur Vercel (cette adresse désignerait la fonction Vercel elle-même) et de **redéployer** après avoir défini la variable (elle est lue au build pour la réécriture).
* ⚠️ À VÉRIFIER : version de Node.js utilisée par Vercel (non fixée : pas de champ `engines` dans `package.json`).

## 3. Backend sur Render (Docker)

### 3.1 Définition (`render.yaml`, Blueprint)

* `rootDir: nexus-vpn`, `dockerfilePath: ./Dockerfile`, `dockerContext: .` ; contrôle de santé `healthCheckPath: /up`.
* Variables : valeurs fixes non secrètes (ex. `APP_ENV=production`, `APP_DEBUG=false`, `DB_CONNECTION=pgsql`, `SESSION_*`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`, `LOG_CHANNEL=stderr`, `CHARGILY_MODE=test`, `FRONTEND_URL`), valeurs injectées (`APP_URL` depuis l'URL externe du service, `DB_URL` depuis la base), valeur générée (`APP_KEY_SECRET`) et secrets saisis à la main (`sync: false`). Liste complète des noms : §5.

### 3.2 Image Docker (`nexus-vpn/Dockerfile`)

1. Base `php:8.3-apache-bookworm` ; installation de `libonig-dev`, `libpq-dev`, `libzip-dev`, `unzip` ; extensions `bcmath`, `mbstring`, `pdo_pgsql`, `zip` ; modules Apache `rewrite` et `headers`.
2. Copie de Composer 2 depuis l'image officielle, copie du code (`.dockerignore` exclut `.env*` sauf `.env.example`, `.git`, `node_modules`, `vendor`, `public/build`, caches et logs).
3. `composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader`, création des dossiers `storage/` et droits pour `www-data`.
4. Hôte virtuel Apache `docker/laravel-vhost.conf` (`DocumentRoot /var/www/html/public`, logs vers stdout/stderr).
5. Port exposé `10000` ; point d'entrée `docker/entrypoint.sh`.

Aucune étape `npm` : les ressources Vite du starter kit hérité ne sont pas construites (voir risque R-20 dans `08-authentication-security.md`).

### 3.3 Démarrage du conteneur (`docker/entrypoint.sh`)

1. Si `APP_KEY` est absent, il est reconstruit à partir de `APP_KEY_SECRET` (`base64:` + secret) ; échec si aucun des deux n'est défini.
2. Création des dossiers `storage/framework/*` et `bootstrap/cache`, droits `www-data`.
3. `php artisan migrate --force --seed` (en tant que `www-data`) **à chaque démarrage** : migrations + seeders (plans ; aucun compte de démonstration en production, voir `06-database.md` §7).
4. `php artisan schedule:work` lancé **en arrière-plan** dans le même conteneur.
5. Adaptation du port d'écoute Apache à `$PORT` (défaut 10000), puis `apache2-foreground`.

`docker/predeploy.sh` (reconstruction de `APP_KEY` + `migrate --force`) n'est référencé ni par `render.yaml` ni par le `Dockerfile` : fichier non utilisé.

### 3.4 Tâches planifiées en production

| Tâche | Fréquence (`routes/console.php`) |
|---|---|
| `subscriptions:expire` | toutes les 15 minutes, `withoutOverlapping` |
| `payments:reconcile` | toutes les 15 minutes, `withoutOverlapping` (synchronise les paiements `pending` périmés, expire les checkouts abandonnés) |
| `subscriptions:remind` | tous les jours à 09:00 (fuseau `APP_TIMEZONE`, défaut UTC) |

Elles sont exécutées par `schedule:work` dans le conteneur web (pas de cron Render ni de service « worker » séparé). ⚠️ À VÉRIFIER : sur l'offre Free, Render met le service en veille après 15 minutes sans trafic (`DEPLOYMENT.md`) ; le planificateur ne tourne donc pas pendant la veille (risque R-04). Le contrôle d'accès de l'API reste correct (fondé sur `current_period_end`), mais e-mails et révocations sont retardés.

Aucun worker de file d'attente n'est lancé (`queue:work` absent) ; ce n'est pas nécessaire aujourd'hui car aucune tâche n'est mise en file (`QUEUE_CONNECTION=database` sans job).

Synchronisation des pairs VPN : manuelle (`php artisan vpn:peers` puis `wg syncconf` sur la passerelle), non automatisée (risque R-01).

### 3.5 Limites de l'offre gratuite (d'après `DEPLOYMENT.md`)

* Le service web s'endort après 15 min d'inactivité ; le réveil peut prendre environ une minute (la première requête de `proxy.ts` peut dépasser son délai de 4 s : `/admin` redirige alors vers l'accueil, `/dashboard` s'affiche avec un message d'erreur).
* PostgreSQL Free : 1 Go, expiration 30 jours après création, suppression après 14 jours de grâce (risque R-02). `DEPLOYMENT.md` présente cette configuration comme un environnement de **test**, pas de production.

## 4. Procédure de déploiement (résumé de `DEPLOYMENT.md`)

1. Render : créer un Blueprint à partir du dépôt GitHub et sélectionner `render.yaml`.
2. Attendre que `nexus-vpn-api` soit sain (`/up`) ; les migrations s'exécutent au démarrage.
3. Saisir les secrets `sync: false` dans Render (Chargily, `BREVO_API_KEY` + `MAIL_FROM_ADDRESS`, VPN). ⚠️ À VÉRIFIER : cette étape n'est pas détaillée dans `DEPLOYMENT.md`.
4. Copier l'URL publique du service Render.
5. Vercel : définir `NEXT_PUBLIC_API_URL` avec cette URL, puis redéployer.
6. Chargily : configurer l'URL du webhook `https://<service-render>/api/webhooks/chargily`. ⚠️ À VÉRIFIER : non mentionné dans `DEPLOYMENT.md`.
7. Premier administrateur : `php artisan admin:grant {email}` dans le conteneur. ⚠️ À VÉRIFIER : procédure non documentée pour Render (shell du service).

## 5. Variables d'environnement requises (noms et rôles uniquement)

### 5.1 Backend (`nexus-vpn/`)

| Variable | Rôle | Défini dans |
|---|---|---|
| `APP_ENV`, `APP_DEBUG`, `APP_URL`, `APP_TIMEZONE` | Environnement, mode debug (interdit en production), URL publique de l'API, fuseau | `render.yaml` / `.env` local |
| `APP_KEY` ou `APP_KEY_SECRET` | Clé de chiffrement | `.env` local / Render (`generateValue`) |
| `FRONTEND_URL` | URL du frontend : liens e-mail, retours Chargily, origine CORS | `render.yaml` / `.env` |
| `TRUSTED_PROXIES` | Proxys de confiance (IP réelle du client) | `render.yaml` |
| `DB_CONNECTION`, `DB_URL` (ou `DB_HOST`/`DB_DATABASE`/… en local) | Connexion à la base | `render.yaml` (`fromDatabase`) / `.env` (SQLite en local) |
| `SESSION_DRIVER`, `SESSION_LIFETIME`, `SESSION_ENCRYPT`, `SESSION_SECURE_COOKIE`, `SESSION_SAME_SITE`, `SESSION_DOMAIN` | Sessions | `render.yaml` / `.env` |
| `CACHE_STORE`, `QUEUE_CONNECTION` | Cache et files | `render.yaml` / `.env` |
| `LOG_CHANNEL`, `LOG_LEVEL` | Journalisation | `render.yaml` / `.env` |
| `CHARGILY_MODE`, `CHARGILY_SECRET_KEY` | Paiement (test/live), clé API + HMAC | `render.yaml` + secret Render / `.env` |
| `MAIL_MAILER`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` ; production : `BREVO_API_KEY` ; local : `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION` | E-mails | `render.yaml` + secrets Render / `.env` |
| `VPN_SERVER_PUBLIC_KEY`, `VPN_SERVER_ENDPOINT` | Passerelle WireGuard (obligatoires pour délivrer une configuration) | secrets Render / `.env` |
| `VPN_DNS`, `VPN_ALLOWED_IPS`, `VPN_ADDRESS_POOL`, `VPN_CLIENT_PREFIX` | Paramètres WireGuard optionnels (valeurs par défaut dans `config/services.php`) | `.env` (absentes de `render.yaml` : valeurs par défaut en production) |
| `BCRYPT_ROUNDS` | Coût du hachage des mots de passe | `.env` |

### 5.2 Frontend (racine)

| Variable | Rôle | Défini dans |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Origine du service Laravel, utilisée par la réécriture `/backend-api` et par `proxy.ts` | Vercel (obligatoire) ; facultative en local |
| `VERCEL`, `NODE_ENV` | Positionnées automatiquement par la plateforme/Next.js ; activent la vérification de `NEXT_PUBLIC_API_URL` et la CSP de production | automatique |

## 6. Développement local

Prérequis constatés : PHP 8.2 avec l'extension `sodium` (Laravel 12 exige PHP ≥ 8.2), Composer, Node.js (v22 utilisé pour l'audit), pnpm 10. Base locale : SQLite (`nexus-vpn/database/database.sqlite`).

**Backend** (depuis `nexus-vpn/`) :

```bash
composer install
cp .env.example .env          # puis renseigner les variables nécessaires (jamais versionné)
php artisan key:generate
php artisan migrate --seed    # plans + compte de démonstration (environnement local)
php artisan serve             # http://127.0.0.1:8000
php artisan schedule:work     # facultatif : expirations et rappels
php artisan test --compact    # tests (SQLite en mémoire)
```

Le script `composer run dev` lance `php artisan serve`, `queue:listen` et `npm run dev` (Vite du starter kit hérité, inutile pour l'application réelle).

**Frontend** (racine du dépôt) :

```bash
pnpm install --frozen-lockfile
pnpm dev                      # http://localhost:3000
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```

Sans `NEXT_PUBLIC_API_URL`, la réécriture et `proxy.ts` visent le serveur Laravel local (`127.0.0.1:8000`). `FRONTEND_URL` vaut `http://localhost:3000` par défaut côté Laravel (`config/app.php`), ce qui permet aux liens e-mail et aux retours de paiement de revenir vers le frontend local. Scripts alternatifs : `pnpm dev:webpack`, `pnpm dev:fast` (Webpack, sans cartes de source).

### Envoi d'e-mails — Gmail SMTP

Depuis le 2026-10-06, l'envoi d'e-mails passe par **Gmail SMTP** : `MAIL_MAILER=smtp`, `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_ENCRYPTION=tls`.

**Pourquoi ce changement.** Le projet utilisait d'abord Mailtrap comme bac à sable de test ; Mailtrap *capture* les e-mails dans une boîte de test sans jamais les livrer à de vraies adresses. Pour que les e-mails de vérification arrivent réellement dans la boîte des utilisateurs, on passe à Gmail SMTP (livraison réelle).

**Mise en place (côté compte Google).** Un **compte Gmail dédié** au projet a été créé ; la **validation en deux étapes (2FA)** y a été activée ; un **mot de passe d'application** (App Password, 16 caractères) a été généré et sert de `MAIL_PASSWORD` — le mot de passe habituel du compte ne fonctionne pas en SMTP lorsque la 2FA est active.

**Secrets.** L'adresse du compte, le mot de passe d'application et l'adresse d'expéditeur vivent **uniquement dans `.env`** (non versionné) ; `.env.example` ne contient que des gabarits (clés présentes, valeurs non secrètes seulement). Dans `render.yaml`, `MAIL_HOST`/`MAIL_PORT`/`MAIL_ENCRYPTION`/`MAIL_FROM_NAME` ont des valeurs ; `MAIL_USERNAME`/`MAIL_PASSWORD`/`MAIL_FROM_ADDRESS` restent `sync: false` (à saisir dans le tableau de bord Render).

**Limite.** Un compte Gmail gratuit plafonne à **~500 e-mails/jour** — suffisant pour une démonstration, à surveiller si le volume augmente.

Envoi réel vérifié le 2026-10-06 (e-mail de vérification livré via Gmail). Le paiement Chargily exige une clé de test et une URL publique pour recevoir le webhook (la vérification active via la page de résultat fonctionne sans webhook).

**Production — Render bloque le SMTP.** Depuis 2025-09, **Render Free bloque les ports SMTP sortants (25/465/587)** ; l'envoi en production ne passera donc **pas** par Gmail SMTP mais par l'**API HTTP de Brevo** (compte gratuit, expéditeur unique vérifié, sans domaine requis), **câblée le 2026-10-18** selon la méthode officielle de Laravel 12 (« Additional Symfony Transports ») : paquets `symfony/brevo-mailer` et `symfony/http-client`, transport enregistré par `Mail::extend('brevo', …)` dans `AppServiceProvider`, mailer `brevo` dans `config/mail.php`, clé `services.brevo.key` lue depuis `BREVO_API_KEY`. `render.yaml` fixe `MAIL_MAILER=brevo` ; il reste à saisir dans Render `BREVO_API_KEY` (Brevo > SMTP & API > API Keys) et `MAIL_FROM_ADDRESS` (expéditeur vérifié dans Brevo). Au démarrage en production, un avertissement est journalisé si `MAIL_MAILER=brevo` sans clé. Test : `tests/Feature/BrevoMailerTest.php`. En **local**, Gmail SMTP reste utilisé. ⚠️ À VÉRIFIER : livraison réelle depuis le site en ligne non encore testée.
