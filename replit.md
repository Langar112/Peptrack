# PeptidePro — Peptide Tracker

A production-ready mobile-first app for calculating reconstituted peptide doses, scheduling injection cycles, tracking events on a calendar, and keeping a detailed injection journal.

## Architecture

**Monorepo** managed with pnpm workspaces.

| Layer | Package | Description |
|---|---|---|
| Mobile app | `artifacts/mobile` | Expo (React Native + Web) — three-tab UI |
| API server | `artifacts/api-server` | Express 5 (ESM) REST API |
| Database schema | `lib/db` | Drizzle ORM + PostgreSQL |
| API types | `lib/api-zod` | Shared Zod schemas |
| API client | `lib/api-client-react` | Typed fetch client (React) |

## Key Features

- **Dosage Calculator** — vial strength (mg/mcg/IU), BAC water, dose, syringe diagram, doses-per-vial
- **Cycle Management** — create/edit/pause/resume/archive cycles; daily / specific-days / times-per-week / every-X-days schedules; auto-generated injection events
- **Calendar** — monthly grid + weekly schedule views; tap to complete/skip with injection site picker; active cycles panel
- **Journal** — general notes, dose changes, and observations with tags, intensity rating, linked cycle, and full-text search
- **Auth** — JWT (bcryptjs + jsonwebtoken); register, login, settings, delete account
- **Settings** — theme, first day of week, default syringe size; stored per user

## Running Locally

```bash
# Install all packages
pnpm install

# Start the API server (builds then starts on $PORT)
pnpm --filter @workspace/api-server run dev

# Start the Expo app (web preview on $PORT, native via QR)
pnpm --filter @workspace/mobile run dev

# Run tests
pnpm --filter @workspace/api-server run test
```

## Environment Variables / Secrets

| Name | Where | Purpose |
|---|---|---|
| `SESSION_SECRET` | Replit Secret | JWT signing key |
| `DATABASE_URL` | Auto-injected | Replit PostgreSQL connection string |
| `EXPO_PUBLIC_DOMAIN` | Set by Expo workflow | Base URL for API calls from mobile |

## Database

Uses **Replit's built-in PostgreSQL** via Drizzle ORM.

Tables: `users`, `peptide_catalog`, `cycles`, `schedule_rules`, `injection_events`, `journal_entries`, `cycle_change_history`.

The catalog is pre-seeded with 17 common peptides (BPC-157, TB-500, GLP-1 agonists, etc.).

To push schema changes to development DB:
```bash
pnpm --filter @workspace/db exec drizzle-kit push --force
```

## Tests

Located in `artifacts/api-server/src/lib/`:
- `dosageCalc.test.ts` — 29 tests covering unit conversion, validation, mg/mcg/IU calculation paths, warning logic, and precision edge cases
- `schedule.test.ts` — 22 tests covering all frequency types (daily, specific_days, every_x_days), injection times, fromDate, and ongoing cycles

Run: `pnpm --filter @workspace/api-server run test`

## File Structure (Mobile App)

```
artifacts/mobile/
  app/
    _layout.tsx          # Root layout — AuthProvider, Stack nav
    (tabs)/
      _layout.tsx        # 3-tab layout (Calculator, Calendar, Journal)
      index.tsx          # Dosage Calculator screen
      calendar.tsx       # Calendar screen (monthly + weekly views)
      journal.tsx        # Journal screen
    add-cycle.tsx        # Create / edit cycle form
    cycle/[id].tsx       # Cycle detail screen
    settings.tsx         # Settings modal
    auth/
      login.tsx
      register.tsx
  services/
    api.ts               # Typed API client (all endpoints)
    dosageCalc.ts        # Pure calculation utility (also used by tests)
  contexts/
    AuthContext.tsx       # Auth state — login/logout/register/updateUser
  hooks/
    useColors.ts         # Theme-aware color hook
```

## User Preferences

- Keep the three-tab structure: Calculator, Calendar, Journal
- Settings accessible via gear icon (⚙️) in the top-right header
- All new features should gate on `isAuthenticated` and prompt login if not signed in
- Use `Inter` font family throughout (loaded via `@expo-google-fonts/inter`)
- Use `useColors()` hook for all color values — never hardcode hex colors
