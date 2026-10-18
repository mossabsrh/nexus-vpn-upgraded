# 09 — Technologies et paquets

> Versions installées relevées dans `nexus-vpn/composer.lock` le 2026-10-05 ; contraintes déclarées dans `nexus-vpn/composer.json`.

## Backend (`nexus-vpn/`)

### Environnement d'exécution

| Technologie | Version | Rôle |
|---|---|---|
| PHP | contrainte `^8.2` ; 8.2.12 en local (`php -v`) ; image Docker `php:8.3-apache-bookworm` en production | Langage du backend |
| Laravel Framework | v12.60.2 | Framework de l'API REST |
| Apache | (image Docker officielle PHP) | Serveur HTTP en production, `mod_rewrite` et `mod_headers` activés |
| SQLite / PostgreSQL | — | SGBD local et tests / production (voir `06-database.md`) |
| Extensions PHP | `bcmath`, `mbstring`, `pdo_pgsql`, `zip` (installées dans le `Dockerfile`) ; `sodium` (utilisée pour les clés WireGuard) | ⚠️ À VÉRIFIER : `sodium` n'est pas installée explicitement dans le `Dockerfile` ; elle est normalement incluse dans l'image PHP officielle |

### Dépendances de production (`require`)

| Paquet | Version | Où / pourquoi | Statut |
|---|---|---|---|
| `laravel/framework` | v12.60.2 | Routage, Eloquent ORM, validation, sessions, CSRF, rate limiting, notifications e-mail, planificateur, client HTTP (appels Chargily), chiffrement (`encrypted` cast de la clé privée VPN) | utilisé |
| `laravel/tinker` | v2.11.1 | Console REPL pour le débogage | outil |
| `laravel/sanctum` | v4.3.3 | Authentification par **jeton** (Bearer) pour l'API mobile `/api/mobile/*`, ajoutée le 2026-10-07 sans toucher au login web par session. **App mobile reportée** (le back-end est conservé) | utilisé (mobile) |
| `inertiajs/inertia-laravel` | v2.0.24 | Adaptateur Inertia du starter kit (`HandleInertiaRequests`, pages `/`, `dashboard`, `settings/*`) | **hérité, non utilisé par le frontend réel** |
| `tightenco/ziggy` | v2.6.2 | Exposition des routes nommées au JavaScript (`@routes` dans `app.blade.php`) | **hérité, non utilisé par le frontend réel** |

Aucun SDK Chargily n'est utilisé : l'intégration passe par le client HTTP de Laravel (`Http::withToken()`) vers l'API REST Chargily Pay v2. Aucune bibliothèque WireGuard externe : les clés sont générées avec l'extension PHP `sodium`.

### Dépendances de développement (`require-dev`)

| Paquet | Version | Rôle |
|---|---|---|
| `phpunit/phpunit` | 11.5.55 | Framework de tests (tests de fonctionnalités dans `tests/Feature`) |
| `fakerphp/faker` | v1.24.1 | Données factices pour les factories |
| `mockery/mockery` | 1.6.12 | Doubles de test |
| `nunomaduro/collision` | v8.9.4 | Affichage des erreurs en console / lanceur `php artisan test` |
| `laravel/pint` | v1.29.1 | Formatage du code PHP (style Laravel) |
| `laravel/boost` | v2.4.8 | Serveur MCP et règles pour les agents IA de développement (`boost.json`, `CLAUDE.md`) |
| `laravel/mcp` | v0.7.0 | Dépendance de Laravel Boost (protocole MCP) |
| `laravel/roster` | v0.5.1 | Dépendance de Laravel Boost (détection des paquets installés) |
| `laravel/pail` | v1.2.6 | Suivi des logs en temps réel |
| `laravel/sail` | v1.60.0 | Environnement Docker de développement Laravel. ⚠️ À VÉRIFIER : semble inutilisé (`boost.json` : `"sail": false`) |

### Services externes

| Service | Usage | Configuration |
|---|---|---|
| Chargily Pay v2 | Paiement en ligne (DZD) : checkouts, webhooks signés HMAC-SHA256 | `CHARGILY_MODE`, `CHARGILY_SECRET_KEY` |
| WireGuard | Protocole VPN ; configuration client générée par l'API, pairs exportés via `vpn:peers` | `VPN_*` |
| E-mail — Gmail SMTP (dev) | E-mails de vérification, réinitialisation, bienvenue, reçu, rappels (`smtp.gmail.com:587`, TLS, compte dédié + mot de passe d'application) | `MAIL_*` dans `.env` (identifiants non versionnés) |
| E-mail — **Brevo (production)** | **Render Free bloque le SMTP sortant** → en production, envoi via l'**API HTTP Brevo** (expéditeur unique vérifié, sans domaine). Câblé dans le code le 2026-10-18 (`symfony/brevo-mailer` + `symfony/http-client` ^7.4, mailer `brevo`, `MAIL_MAILER=brevo` dans `render.yaml`) ; **actif en production seulement une fois `BREVO_API_KEY` et un `MAIL_FROM_ADDRESS` vérifié dans Brevo saisis dans Render** (⚠️ À VÉRIFIER : livraison réelle depuis le site en ligne non encore testée) | `BREVO_API_KEY` (secret Render) |
| Render (hébergement) | Déploiement du conteneur Docker du backend et base PostgreSQL | `render.yaml` (racine du dépôt) |

### Paquets JavaScript dans `nexus-vpn/package.json`

Les dépendances npm de `nexus-vpn/` (`@inertiajs/react`, React 19, Radix UI, Tailwind CSS 4, Vite, ESLint, Prettier…) appartiennent au **starter kit hérité** (pages Inertia sous `resources/js/`) et ne sont pas utilisées par l'application réelle.

## Frontend (application Next.js à la racine)

> Versions installées relevées dans `pnpm-lock.yaml` (section `importers`, lockfile v9) le 2026-10-05 ; contraintes déclarées dans `package.json`. Gestionnaire de paquets : **pnpm** (10.34.6 utilisé pour l'audit) ; Node.js v22.15.0 en local.

### Socle

| Paquet | Version installée | Rôle / où il est utilisé |
|---|---|---|
| `next` | 16.2.6 | Framework React (App Router, Turbopack, `proxy.ts`, réécriture `/backend-api`, en-têtes de sécurité, `next/font`, `next/dynamic`) |
| `react`, `react-dom` | 19.2.4 | Bibliothèque d'interface |
| `typescript` (dev) | 5.7.3 | Typage statique (`strict: true`) |
| `@types/node`, `@types/react`, `@types/react-dom` (dev) | 22.19.11 / 19.2.14 / 19.2.3 | Définitions de types |

### Styles et interface

| Paquet | Version installée | Rôle / où il est utilisé |
|---|---|---|
| `tailwindcss` (dev) | 4.2.0 | Framework CSS utilitaire (`app/globals.css`) |
| `@tailwindcss/postcss` (dev), `postcss` (dev) | 4.2.0 / 8.5.6 | Intégration de Tailwind 4 via PostCSS (`postcss.config.mjs`) |
| `tw-animate-css` (dev) | 1.3.3 | Animations utilitaires (importé dans `globals.css`) |
| `@radix-ui/react-*` (27 paquets) | versions figées dans `package.json` (ex. `react-dialog` 1.1.15) | Primitives accessibles sous-jacentes aux composants shadcn/ui |
| `class-variance-authority` | 0.7.1 | Variantes de style des composants UI (`button`…) |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.4.0 | Fusion des classes CSS (`lib/utils.ts` → `cn()`) |
| `lucide-react` | 0.564.0 | Icônes (admin, navbar, composants UI) |
| `framer-motion` | 12.38.0 | Animations des sections marketing (8 composants) |
| `next-themes` | 0.4.6 | Thème sombre/clair (`ThemeProvider`, `theme-toggle`) |

### Qualité du code

| Paquet | Version installée | Rôle |
|---|---|---|
| `eslint` (dev) | 9.39.5 | Analyse statique (`eslint.config.mjs`, configuration « flat ») |
| `eslint-config-next` (dev) | 16.3.4 | Règles Next.js `core-web-vitals` + `typescript` |

### Paquets installés mais non utilisés par le code applicatif

Importés nulle part, ou seulement par des primitives `components/ui/` elles-mêmes inutilisées (voir `04-frontend.md` §12) :

| Paquet | Version installée | Remarque |
|---|---|---|
| `@vercel/analytics` | 1.6.1 | Composant `Analytics` jamais monté |
| `zod`, `@hookform/resolvers` | 3.25.76 / 3.10.0 | Aucune validation de schéma côté client |
| `react-hook-form` | 7.71.1 | Seulement `components/ui/form.tsx` (inutilisé) |
| `date-fns` | 4.1.0 | Aucun import |
| `recharts` | 2.15.0 | Seulement `components/ui/chart.tsx` (les graphiques admin sont faits à la main) |
| `sonner` | 1.7.4 | Seulement `components/ui/sonner.tsx` |
| `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-day-picker`, `react-resizable-panels` | 8.6.0 / 1.1.1 / 1.1.2 / 1.4.2 / 9.13.2 / 2.1.9 | Seulement leurs primitives UI respectives |
| `autoprefixer` | 10.4.24 | Non référencé dans `postcss.config.mjs` |

### Hébergement

| Service | Rôle | Source |
|---|---|---|
| Vercel | Hébergement du frontend Next.js ; la variable `NEXT_PUBLIC_API_URL` y pointe vers le service Laravel | `DEPLOYMENT.md`, `next.config.mjs` |
