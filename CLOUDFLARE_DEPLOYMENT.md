# Cloudflare Pages Deployment Checklist

1. Create or select a Cloudflare Pages project.
2. Connect the GitHub repository containing this project.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. Deploy.
8. Copy the generated `*.pages.dev` URL.
9. Add that URL to Supabase Auth redirect URLs.
10. Test sign-up, sign-in, organisation onboarding, dashboard load and sign-out with synthetic data.
11. Do not enter real patient data yet.
