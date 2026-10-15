# 19 — Limites actuelles et perspectives

> État au 2026-10-05. Les **risques de sécurité et de fiabilité** (R-01 à R-25, avec sévérité) sont recensés dans `08-authentication-security.md` §11 et ne sont pas répétés ici. Ce fichier ajoute les limites fonctionnelles et techniques qui n'y figurent pas, puis les perspectives.

## 1. Limites fonctionnelles

| ID | Limite | Constat dans le code |
|---|---|---|
| L-01 | Pas de renouvellement automatique : l'utilisateur doit repayer à chaque période | Paiements Chargily ponctuels (`15-technical-decisions.md` TD-09) |
| L-02 | Changement d'offre sans prorata : les jours restants de l'ancienne offre sont perdus | `Payment::applyToSubscription()` termine l'ancien abonnement immédiatement |
| L-03 | Une seule passerelle VPN, pas de choix de pays/serveur | `config/services.php` (`services.vpn.*`) |
| L-04 | Un seul identifiant WireGuard actif par utilisateur ; la gestion multi-appareils (un pair par appareil) n'est pas implémentée. Les offres ne mentionnent plus de nombre d'appareils (contenu aligné, 2026-10-11). | `VpnCredential::issueFor()` |
| L-05 | Fonctionnalités non implémentées (perspectives) : OpenVPN, kill switch, split tunneling, protection DNS dédiée, SSO/SAML, IP dédiée, SLA. **Retirées du site et des offres le 2026-10-11** ; elles ne sont donc plus annoncées. | `04-frontend.md` §13 |
| L-06 | Pas de page de reçu/facture ni de facture PDF, alors que l'endpoint de reçu existe | `07-api.md` §13.1 |
| L-07 | Renommage d'équipe sans interface ; les membres doivent déjà avoir un compte (pas d'invitation par e-mail) | `TeamController` |
| L-08 | ✅ **Résolu (2026-10-06)** — Suppression de compte en libre-service ajoutée (`DELETE /api/account`, anonymisation + soft delete). La route web héritée `DELETE /settings/profile` a été supprimée le 2026-10-15 (R-03). | `05-backend.md` §7.6, `07-api.md` §5 |
| L-09 | Interface uniquement en anglais, sans internationalisation | `app/layout.tsx` (`lang="en"`) |
| L-10 | Une seule devise (DZD) | Validation `currency in:DZD` |
| L-11 | Paiement en mode test (`CHARGILY_MODE=test`) : aucun paiement réel validé | `render.yaml` |

## 2. Limites techniques

| ID | Limite | Constat |
|---|---|---|
| L-12 | Aucun test exécuté sur PostgreSQL (SGBD de production) | `12-testing.md` |
| L-13 | Aucune mesure de performance ni test de charge | — |
| L-14 | Pas de supervision (monitoring, alertes) au-delà des journaux `stderr` | `render.yaml` (`LOG_CHANNEL=stderr`) |
| L-15 | Pas de spécification OpenAPI ni de versionnement d'API (`/api/v1`) | `routes/api.php` |
| L-16 | Pas d'intégration continue (CI) active | Aucun `.github/workflows` à la racine. Les fichiers `nexus-vpn/.github/workflows/lint.yml` et `tests.yml` viennent du starter kit : GitHub n'exécute que les workflows situés à la racine du dépôt, ils sont donc inactifs (et prévus pour PHP 8.4 et le build Vite hérité). ⚠️ À VÉRIFIER : s'ils s'exécutaient sur un ancien dépôt où `nexus-vpn/` était la racine. |
| L-17 | Sauvegardes de la base non configurées | `render.yaml`, offre Free |

## 3. Perspectives

Classées par priorité suggérée (⚠️ À VÉRIFIER : priorités de l'étudiant et de l'encadrant).

1. **Automatiser la synchronisation de la passerelle WireGuard** (agent ou tâche qui applique `vpn:peers` + `wg syncconf`) — corrige R-01.
2. **Hébergement de production** : base PostgreSQL payante avec sauvegardes, planificateur et worker séparés — corrige R-02, R-04, L-17.
3. **Retirer le reste du code hérité** (pages Inertia, middleware, dépendances inutilisées) — corrige R-20, R-21 (les routes web héritées ont été supprimées le 2026-10-15, R-03).
4. Transmettre l'IP réelle du visiteur à Laravel (en-tête signé par un secret partagé entre `proxy.ts` et Laravel, `CF-Connecting-IP` pour les appels directs) et restreindre les origines CORS par environnement — R-05, R-11.
5. Authentification à deux facteurs pour les administrateurs — R-07.
6. Tests frontend (unitaires et de bout en bout, ex. parcours inscription → paiement) et CI exécutant tests, lint et build — R-08, L-16.
7. ✅ Contenu marketing aligné sur les fonctionnalités réelles (2026-10-11, R-09). Reste, si souhaité, à implémenter la gestion multi-appareils (un pair par appareil) — L-04 ; les fonctionnalités retirées (OpenVPN, kill switch…) demeurent des perspectives — L-05.
8. Prorata lors d'un changement d'offre, factures PDF, page de reçu — L-02, L-06.
9. Internationalisation (français/arabe/anglais) — L-09.
10. File d'attente pour les e-mails — R-19.
11. Documentation OpenAPI générée et uniformisation de la casse des réponses — L-15, R-22.

> Réalisé depuis l'audit de base : réconciliation planifiée des paiements `pending` (R-06, commande `payments:reconcile`) et contrôle montant/devise avant activation (R-10) — voir `14-problems-and-solutions.md` (P-21, P-22).
