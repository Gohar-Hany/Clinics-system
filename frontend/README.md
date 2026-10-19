# عيادتي — Frontend

Next.js 16 (App Router) + Tailwind CSS 4, Arabic RTL.

```bash
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
echo NEXT_PUBLIC_CLINIC_TOKEN=<CLINIC_CONFIG_TOKEN from backend/.env> >> .env.local
npm run dev        # http://localhost:3000
```

- Patient pages: `/`, `/chat`, `/queue` — `src/app/(patient)`
- Staff pages: `/dashboard`, `/reception`, `/doctor` — `src/app/(staff)`
- Design tokens live in `src/app/globals.css` (`@theme`); shared UI in `src/components/ui`.

See the root [README](../README.md) for the full system.
