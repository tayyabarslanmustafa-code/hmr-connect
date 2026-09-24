# HMR Connect

Cloudflare-ready frontend for the HMR Connect development platform.

## Current development scope
- Supabase email/password authentication
- organisation onboarding
- pharmacist dashboard
- HMR workflow counters
- PPA claim counters
- monthly initial-HMR usage
- recent HMR episode list
- Cloudflare Pages SPA routing
- environment-variable based Supabase configuration

## Safety status
Use synthetic/test patient data only. This is a development build and is not yet approved for identifiable patient information.

## Cloudflare Pages
Framework preset: Vite

Build command:
```
npm run build
```

Output directory:
```
dist
```

Environment variables:
```
VITE_SUPABASE_URL=https://ynwawconzkaehdjrymwf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>
```

Never expose a Supabase service-role key in the frontend.
