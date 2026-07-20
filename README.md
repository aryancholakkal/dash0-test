# Journal

A photo and text journal, organized by field. Built with Next.js, Supabase (auth, Postgres, storage), and OpenAI-generated entry summaries. Instrumented end-to-end with OpenTelemetry, exporting to [Dash0](https://www.dash0.com/).

## Features

- Email/password auth via Supabase, with session refresh handled in `src/proxy.ts`
- Fields (categories) containing pages (journal entries) with text, photos, and tags
- Photos stored in a private Supabase Storage bucket (`journal-photos`), scoped per user via RLS
- AI-generated summaries and tags for each entry, via the OpenAI Responses API (`src/lib/actions/summarize.ts`)
- Row Level Security on every table/bucket — see `supabase/schema.sql`

## Getting Started

### 1. Configure environment variables

Create `.env.local` in the project root with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# OpenAI (entry summarization)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5 # optional, this is the default

# OpenTelemetry / Dash0 (optional — telemetry is disabled if unset)
OTEL_EXPORTER_OTLP_ENDPOINT=
DASH0_AUTH_TOKEN=
OTEL_SERVICE_NAME=journal-app # optional
```

### 2. Set up the database

Run `supabase/schema.sql` once in the Supabase SQL Editor (Project > SQL Editor > New query). It creates the `fields` and `pages` tables, RLS policies, and the private `journal-photos` storage bucket.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Telemetry

The app ships OpenTelemetry traces, metrics, and logs for every server action (auth, fields, pages, photos, summarize).

- **Setup**: `src/instrumentation.ts` runs Next.js's `register()` hook on server start and dynamically imports `src/lib/otel-node.ts` (Node-only OTel code is kept out of the edge bundle, and `.env.local` isn't loaded until `register()` runs).
- **Exporters**: `startOtel()` in `src/lib/otel-node.ts` wires up an OTLP HTTP trace, metric, and log exporter, plus `getNodeAutoInstrumentations()` for automatic instrumentation of Node built-ins and libraries (filesystem and DNS instrumentation are disabled). Metrics export every 10s.
- **Enable/disable**: telemetry only initializes if `OTEL_EXPORTER_OTLP_ENDPOINT` is set. If it's unset, the app logs `[OTel] ... telemetry disabled` and runs without instrumentation. If `DASH0_AUTH_TOKEN` is set, it's sent as a `Bearer` token on every exporter request.
- **Resource attributes**: `service.name` (from `OTEL_SERVICE_NAME`, default `journal-app`), `service.version` (from `npm_package_version`), `deployment.environment.name` (from `VERCEL_ENV` or `NODE_ENV`), and `service.criticality: medium`.
- **App-level helpers**: `src/lib/telemetry.ts` exposes `getTracer()`, `getMeter()`, `getLogger()`, a `logger.info`/`logger.error` wrapper that stamps the active trace/span ID onto every log, and `withSpan()` for wrapping a server action in a span with automatic error status + error logging.
- **Custom metrics**: e.g. `journal.summarize.duration`, a histogram of OpenAI summary-call latency (`src/lib/actions/summarize.ts`).
- **Privacy**: span/log attributes are restricted to opaque IDs, counts, and booleans — journal content, titles, and photo bytes are never attached to telemetry (see comments in `src/lib/telemetry.ts` and `summarize.ts`).
- **Graceful shutdown**: on `SIGTERM`/`SIGINT`, the logger provider is flushed and both the log provider and SDK are shut down before the process exits.

To point telemetry at a Dash0 endpoint, set `OTEL_EXPORTER_OTLP_ENDPOINT` to your Dash0 OTLP HTTP endpoint and `DASH0_AUTH_TOKEN` to your Dash0 auth token.

## Project Structure

```
src/
  app/                    # Next.js App Router pages (login, signup, fields, pages)
  components/             # Client components (page editor, forms, buttons)
  lib/
    actions/              # Server actions: auth, fields, pages, photos, summarize
    supabase/              # Supabase browser/server client factories
    telemetry.ts           # OTel tracer/meter/logger helpers
    otel-node.ts           # OTel SDK bootstrap (traces/metrics/logs exporters)
  instrumentation.ts        # Next.js instrumentation hook, loads otel-node
  proxy.ts                  # Auth middleware — redirects based on session state
supabase/
  schema.sql               # Tables, RLS policies, storage bucket
```

## Learn More

This project uses a pre-release Next.js version with breaking changes from the version most tooling is trained on — see `AGENTS.md` and `node_modules/next/dist/docs/` before making framework-level changes.
