# Deployment

## Laravel API on Render

The root Next.js site remains on Vercel. Laravel runs as a Docker web service with Render PostgreSQL; Vercel proxies browser requests under `/backend-api`, so the browser stays on the Vercel origin.

1. In Render, create a Blueprint from `mossabsrh/nexus-vpn-upgraded` and grant Render access to the private repository.
2. Select the root `render.yaml`. Both services use Render's Free plan; confirm the plan shown in the dashboard before creating them.
3. Wait for the `nexus-vpn-api` service to become healthy. Its container runs database migrations at startup; `/up` is the health check.
4. Copy the service's public origin, such as `https://nexus-vpn-api.onrender.com`.
5. In the Vercel project, add `NEXT_PUBLIC_API_URL` for Production with that origin as its value. Do not append `/api` or a trailing slash. Add it to Preview too if preview deployments are used.
6. Redeploy the Vercel project. Its rewrite forwards `/backend-api/*` to the Laravel `/api/*` routes.

Do not set this variable to `127.0.0.1` in Vercel; that address points to the Vercel function itself, not the Laravel service.

## Free-tier limitations

This configuration is for testing, not production. Render Free web services spin down after 15 minutes without traffic and can take about a minute to wake. Free PostgreSQL is limited to 1 GB and expires 30 days after creation; after a further 14-day grace period, Render deletes the database and its data. Do not store real customer accounts or other important data here. Upgrade PostgreSQL before the expiry date to preserve the database.
