# Documentation PFE — NexusVPN

Dossier de travail regroupant les informations techniques et les preuves nécessaires à la rédaction du mémoire. **Point d'entrée de chaque session : `00-project-context.md`.** Règles de maintenance : `AGENT-WORKFLOW.md`.

## Index

| Fichier | Contenu |
|---|---|
| `AGENT-WORKFLOW.md` | Règles de développement et de documentation du projet |
| `00-project-context.md` | Résumé court du projet (à lire en premier) |
| `01-project-overview.md` | Objectif, problème, utilisateurs, fonctionnalités, périmètre |
| `02-requirements.md` | Acteurs, 31 exigences fonctionnelles, 14 non fonctionnelles |
| `03-architecture.md` | **Non créé** (architecture actuellement répartie dans 04, 05, 07, 13) |
| `04-frontend.md` | Application Next.js : routes, layouts, composants, état, `apiFetch`, `proxy.ts`, styles |
| `05-backend.md` | API Laravel : middleware, authentification, contrôleurs, routes, workflows métier, code hérité |
| `06-database.md` | Tables, contraintes, index, relations, migrations, seeders |
| `07-api.md` | Contrat frontend ↔ backend : 50 endpoints, CSRF, conventions d'erreur, incohérences |
| `08-authentication-security.md` | Mécanismes de sécurité et registre des risques R-01 à R-25 |
| `09-technologies-and-packages.md` | Inventaire des technologies et paquets (backend et frontend) |
| `10-features.md` | 23 fonctionnalités reliées aux exigences |
| `11-development-history.md` | État initial du dépôt et phases de développement |
| `12-testing.md` | Tests backend (130) et vérifications frontend (lint, types, build) |
| `13-deployment.md` | Vercel + Render (Docker, PostgreSQL), variables, développement local |
| `14-problems-and-solutions.md` | 13 problèmes résolus visibles dans le code |
| `15-technical-decisions.md` | 16 décisions techniques justifiées |
| `16-sources.md` | Sources consultées (aucune externe pour l'instant) |
| `17-changelog.md` | Journal daté des changements |
| `18-glossary.md` | Abréviations et termes techniques |
| `18-audit-final.md` | Audit final de qualité/débogage avant soutenance (2026-10-07) |
| `19-limitations-and-future-work.md` | Limites fonctionnelles/techniques et perspectives |
| `20-memoire-mapping.md` | Correspondance fichiers ↔ chapitres du mémoire |
| `memoire-assets/` | Assets du mémoire : `diagrams/` (9 .mmd + PNG/SVG), `database/` (erd.mmd + tables.md), `code/`, `tests/`, `screenshots/` (68 captures) — voir `memoire-assets/README.md` |

## État actuel (2026-10-05)

* Audit de référence terminé (4 étapes, aucun code modifié). Application fonctionnellement complète, en environnement de test (Chargily `test`, offres gratuites Render/Vercel).
* Preuves : 130 tests backend réussis ; lint, contrôle de types et build frontend réussis (`12-testing.md`).
* Restent à produire : `03-architecture.md` et les diagrammes (cas d'utilisation, classes, séquences, activités, déploiement, architecture, MCD/MLD) ; captures d'écran ; réponses aux questions ci-dessous.

## Points à compléter par l'étudiant

Toutes les mentions ⚠️ À VÉRIFIER des fichiers, reformulées en questions. Une fois une réponse connue, mettre à jour le fichier concerné et retirer la mention.

### `01-project-overview.md`
- [ ] Quels sont l'établissement, la filière et l'année universitaire ?
- [ ] Qui sont les encadrants (académique et, le cas échéant, en entreprise) ?
- [ ] Y a-t-il un organisme d'accueil ?
- [ ] Le projet est-il réalisé seul ou en binôme ? À qui appartient le dépôt GitHub `mossabsrh/nexus-vpn-upgraded` cité dans `DEPLOYMENT.md` ?
- [ ] Quelle est la motivation initiale du projet (besoin d'entreprise, projet personnel, sujet proposé) et pourquoi le marché algérien ?

### `02-requirements.md`
- [ ] Existe-t-il un cahier des charges initial à comparer avec les exigences dérivées du code ?

### `04-frontend.md`
- [ ] Le site affiche-t-il un favicon personnalisé en production (les icônes de `public/` ne sont pas déclarées) ?
- [x] ~~Les chiffres marketing (87 pays, 99,98 %, 10 Gbps, nœuds par région) doivent-ils être présentés comme une maquette dans le mémoire ?~~ **Résolu (2026-10-11)** : retirés du site et des offres ; le contenu décrit uniquement le réel, plus besoin de maquette.

### `05-backend.md`
- [ ] Existe-t-il un mécanisme (cron, agent) hors dépôt qui synchronise automatiquement les pairs WireGuard sur la passerelle ?
- [x] Les routes web héritées (`/register`, `/settings/profile`…) doivent-elles rester actives ? → **Non** : supprimées le 2026-10-15 (R-03). La page `/` répondait `500` en production ; elle redirige désormais vers le frontend.
- [ ] La configuration `services.frontend_url` est-elle utilisée quelque part hors du code (sinon : configuration morte) ?

### `06-database.md`
- [ ] Quels sont les types exacts des colonnes sur la base PostgreSQL de production ?
- [ ] Les tables `jobs`, `job_batches`, `failed_jobs` servent-elles à quelque chose ?
- [ ] Une migration vers MySQL/MariaDB est-elle envisagée (l'index unique partiel n'y serait pas créé) ?

### `08-authentication-security.md`
- [x] Comment Render et Vercel transmettent-ils l'en-tête `X-Forwarded-For` (risque R-05) ? → **Mesuré le 2026-10-15** : Laravel voit des IP de proxys changeantes, pas l'IP du visiteur (détails dans `08` R-05). Correctif non retenu à ce stade.
- [x] Quel est le comportement réel de `/` sur le domaine Render (R-20) ? → `500` constaté le 2026-10-15 ; `/` redirige désormais vers le frontend.

### `09-technologies-and-packages.md`
- [ ] L'extension PHP `sodium` est-elle bien disponible dans l'image Docker de production ?
- [ ] `laravel/sail` est-il utilisé ?
- [ ] Quel fournisseur SMTP est utilisé en production ?

### `11-development-history.md`
- [ ] Quelles sont les dates réelles de début du projet et des grandes étapes ? Existe-t-il un historique git antérieur (dépôt GitHub) ?
- [ ] Les dates des noms de migrations (2026-06-18, 2026-09-15, 2026-10-01, 2026-10-05) correspondent-elles au calendrier réel ?
- [ ] Quand et pourquoi l'interface est-elle passée d'Inertia/React (starter kit) à Next.js ?

### `13-deployment.md`
- [ ] Sur quelle offre et dans quelle région Vercel le frontend est-il déployé ?
- [ ] Quel serveur héberge la passerelle WireGuard (fournisseur, configuration) ? Existe-t-il réellement ?
- [ ] Quel fournisseur SMTP est configuré dans Render ?
- [ ] Quelle version de Node.js Vercel utilise-t-il ?
- [ ] Le planificateur s'arrête-t-il effectivement pendant la mise en veille du service Render gratuit ?
- [ ] Comment les secrets `sync: false` ont-ils été saisis dans Render (procédure à documenter) ?
- [ ] L'URL du webhook a-t-elle été configurée dans le tableau de bord Chargily ? Laquelle ?
- [ ] Comment le premier administrateur a-t-il été créé en production (`admin:grant` via le shell Render ?) ?
- [ ] En local, quel mailer et quelle clé Chargily de test sont utilisés ? Le webhook est-il testé en local (tunnel public) ?

### `14-problems-and-solutions.md`
- [ ] Pour chaque problème P-01 à P-13 : quel symptôme a été observé, comment l'enquête a-t-elle été menée, et à quelle date ? (notamment P-01 doublons d'abonnements, P-02 vérification HMAC dès le départ ou ajoutée ensuite, P-03 incident d'origine, P-09 date de découverte)
- [ ] Comment P-06 (rejeu CSRF 419) et P-07 (protection `/admin`) ont-ils été vérifiés manuellement ?

### `15-technical-decisions.md`
- [ ] TD-01 : pourquoi Next.js séparé plutôt que l'interface Inertia du starter kit ?
- [ ] TD-03 : pourquoi Chargily (et Stripe/PayPal sont-ils effectivement inadaptés aux cartes EDAHABIA/CIB) ? Pourquoi pas de SDK ?
- [ ] TD-04 : pourquoi WireGuard et la génération des clés côté serveur ?
- [ ] TD-05 : pourquoi l'abandon de MySQL (`db/schema.sql`) au profit de SQLite/PostgreSQL ?
- [ ] TD-06 : pourquoi Vercel + Render ? Quelle cible de production est envisagée ?
- [ ] TD-07 : la logique métier dans les modèles est-elle un choix délibéré ?
- [ ] TD-08 : pourquoi pas de file d'attente (contrainte d'hébergement) ?
- [ ] TD-11 : shadcn/ui est-il un choix délibéré ou hérité de v0 ?

### `16-sources.md`
- [ ] Quelles sources (documentations officielles, articles, cours) ont été utilisées pendant le développement ?

### `19-limitations-and-future-work.md`
- [ ] Les workflows `nexus-vpn/.github/workflows/*` ont-ils déjà tourné sur un ancien dépôt dont `nexus-vpn/` était la racine ?
- [ ] Quelles perspectives sont prioritaires pour l'étudiant et l'encadrant ?

### `20-memoire-mapping.md`
- [ ] Quel plan de mémoire l'établissement impose-t-il ?
