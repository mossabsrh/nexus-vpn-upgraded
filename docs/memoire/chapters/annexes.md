# Appendices

## Appendix A — List of the API endpoints

The portal exposes a JSON REST API under `/api`. The front end reaches it through the same-origin path `/backend-api/*`. The table lists the endpoints by area (web session routes; the equivalent `/api/mobile/*` token routes for the postponed mobile client are not repeated).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pricing` | Active plans for the public pricing page |
| GET | `/api/testimonials` · POST | List approved testimonials · submit one |
| POST | `/api/contact` | Send a Team-plan sales enquiry |
| GET | `/api/csrf-cookie` | Obtain the CSRF cookie for the session flow |
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` | Account creation, login, logout |
| POST | `/api/auth/forgot-password` · `/api/auth/reset-password` | Password reset |
| POST | `/api/email/verification-notification` · GET `/api/email/verify/{id}/{hash}` | E-mail verification |
| GET | `/api/me` | Current authenticated user |
| PUT | `/api/account/email` · `/api/account/password` | Change e-mail / password |
| DELETE | `/api/account` | Close the account (anonymise + soft-delete) |
| GET | `/api/account/subscriptions` · `/api/account/payments` · `/api/account/payments/{payment}` | Subscriptions, payment history and receipts |
| POST | `/api/subscriptions/trial` · `/api/subscriptions/cancel` | Start the free trial · cancel |
| POST | `/api/checkout` · GET `/api/checkout/{checkoutId}/verify` | Create a Chargily checkout · verify it |
| GET | `/api/payments/{payment}/verify` | Verify a payment (result-page fallback) |
| POST | `/api/webhooks/chargily` | Chargily webhook (HMAC-signed) |
| GET | `/api/vpn/config` · `/api/vpn/credentials` | Download the WireGuard `.conf` · VPN status |
| GET | `/api/team` · PATCH · POST `/api/team/members` · DELETE `/api/team/members/{member}` | Team management (owner) |
| GET | `/api/admin/users` · PATCH · DELETE `/api/admin/users/{user}` | Administer user accounts |
| GET | `/api/admin/plans` · POST · PATCH · DELETE `/api/admin/plans/{plan}` | Manage offers (plans) |
| GET | `/api/admin/subscriptions` · POST `/api/admin/subscriptions/team` · POST `…/{subscription}/cancel` | Subscriptions and team provisioning |
| GET | `/api/admin/payments` · POST `/api/admin/payments/{payment}/refund` | Payments and refunds |
| GET | `/api/admin/testimonials` · PATCH · DELETE | Testimonial moderation |
| GET | `/api/admin/contact-requests` · PATCH `…/{contactRequest}` | Contact-request inbox |
| GET | `/api/admin/audit-logs` · `/api/admin/stats` | Audit log · dashboard statistics |

*Source: prepared by the authors, from `routes/api.php` (`php artisan route:list`).*

## Appendix B — Environment variable names (no values)

The application is configured entirely through environment variables; the table lists their **names only** — the values (secrets) are entered by the authors and never shared.

| Area | Variables |
|---|---|
| Application | `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_DEBUG`, `APP_URL`, `FRONTEND_URL` |
| Database | `DB_CONNECTION` (and the `DB_*` host/credentials for PostgreSQL in production) |
| Session | `SESSION_DRIVER`, `SESSION_ENCRYPT`, `SESSION_LIFETIME`, `SESSION_DOMAIN` |
| Mail | `MAIL_MAILER`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`; production: `BREVO_API_KEY`; development (SMTP): `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION` |
| Payment (Chargily) | `CHARGILY_MODE`, `CHARGILY_SECRET_KEY`, `CHARGILY_WEBHOOK_URL` |
| VPN (WireGuard gateway) | `VPN_SERVER_PUBLIC_KEY`, `VPN_SERVER_ENDPOINT`, `VPN_DNS`, `VPN_ALLOWED_IPS`, `VPN_ADDRESS_POOL`, `VPN_CLIENT_PREFIX` |
| Mobile token (Sanctum) | `SANCTUM_TOKEN_EXPIRATION` |

*Source: prepared by the authors, from `.env.example` and `config/`.*

## Appendix C — Summary of the automated test suite

The back end is covered by **111 tests (463 assertions)** that run in about thirty seconds on an in-memory SQLite database. The breakdown by area is given in the body of the thesis (Table IV.3): authentication, account and security (28); payments and webhooks (41); subscriptions and VPN provisioning (11); mobile token API (9); administration and billing (19); platform and data integrity (3). The automated front-end test suite is future work; Playwright is currently used to capture the interface screenshots.

*Source: prepared by the authors, from `php artisan test`.*

## Appendix D — EADN interview guide (questions)

*Guide d'entretien utilisé lors du stage à l'EADN. Les questions sont posées aux responsables concernés ; l'autorisation est demandée avant toute copie ou photographie d'un document, et les données personnelles (noms, numéros, données clients) sont masquées.*

**1. Présentation de l'entreprise**

- Quel est le nom officiel complet de l'EADN (en français et en arabe) et son sigle ?
- Quel est le statut juridique de l'entreprise (EPE, SPA, EPIC, …) ?
- Quelle est sa date de création et quel texte juridique l'a créée ?
- De quel ministère, groupe ou holding dépend-elle ?
- Quelle est sa mission ? Quelles sont ses principales activités et services ?
- Quels sont ses types de clients (organismes publics, entreprises, particuliers …) ?
- Quelles sont les dates et les étapes importantes de son histoire ?
- Quel est l'effectif approximatif et le nombre de sites ou d'agences ?

**2. Fiche technique**

- Pouvez-vous nous communiquer : l'adresse du siège, le téléphone/fax, l'e-mail et le site web, le secteur d'activité et, s'il s'agit d'une entreprise publique, le capital ?

**3. Organisation**

- Disposez-vous d'un organigramme officiel ? Dans quel département s'est déroulé le stage ?
- Quelles sont les missions des départements liés au projet (commercial, infrastructure informatique et réseau, service client/support, administration et finances) et leurs effectifs approximatifs ?

**4. Système existant**

- L'EADN vend-elle ou fournit-elle un service de VPN / d'accès distant sécurisé (ou d'hébergement / de services réseau) à ses clients ? Si non, quel processus de vente devrions-nous étudier ?
- Comment se déroule le processus actuel, étape par étape : demande du client → devis → contrat/convention → paiement → création du compte et activation du service → livraison → support → renouvellement/résiliation ?
- Pour chaque étape : qui le fait, avec quel outil (papier, e-mail, Excel, logiciel), en combien de temps et à quelle fréquence ?
- Qui crée les comptes/configurations du service, et comment sont-ils livrés au client ?
- Existe-t-il un paiement en ligne aujourd'hui ?

**5. Documents utilisés**

- Pour chaque document (demande, devis, bon de commande, convention, facture, reçu de paiement, formulaire de création d'accès, bon de livraison/activation, formulaire de réclamation, lettre de renouvellement/résiliation) : qui l'émet, qui le reçoit, est-il interne ou externe, quel est son rôle, en combien d'exemplaires, et quels sont ses champs (nom, signification, type A/N/AN/D, taille approximative) ?

**6. Postes de travail**

- Pour chaque poste lié au projet (responsable commercial, responsable des contrats/facturation, support technique VPN, administrateur système/réseau, ou les équivalents réels à l'EADN) : intitulé, département, nombre de personnes, tâches principales, outils utilisés, documents émis et reçus.

**7. Critique du système existant**

- Quels sont les problèmes rencontrés aujourd'hui (délais, erreurs, trop de papier, absence de paiement en ligne, absence de self-service, absence de suivi …) ?
- Qu'est-ce que le personnel souhaiterait améliorer ?

## Appendix E — EADN documents

*PLACEHOLDER — anonymised samples of the EADN documents studied in Chapter I (enquiry form, quote, contract, invoice, receipt, access-creation form …), collected during the internship with permission and with personal data hidden.*
