# Deployment

## Laravel API on Render

The root Next.js site remains on Vercel. Laravel runs as a Docker web service with Render PostgreSQL; Vercel proxies browser requests under `/backend-api`, so the browser stays on the Vercel origin.

1. Push this project to a Git provider that Render can access. This workspace currently has no Git repository metadata.
2. In Render, create a Blueprint from that repository and select the root `render.yaml`. Review the web-service and PostgreSQL plan charges before confirming.
3. Wait for the `nexus-vpn-api` service to become healthy. Render runs database migrations before each deploy; `/up` is its health check.
4. Copy the service's public origin, such as `https://nexus-vpn-api.onrender.com`.
5. In the Vercel project, add `NEXT_PUBLIC_API_URL` for Production with that origin as its value. Do not append `/api` or a trailing slash. Add it to Preview too if preview deployments are used.
6. Redeploy the Vercel project. Its rewrite forwards `/backend-api/*` to the Laravel `/api/*` routes.

Do not set this variable to `127.0.0.1` in Vercel; that address points to the Vercel function itself, not the Laravel service.
