---
name: documind-frontend
description: Frontend engineering conventions for DocuMind's Next.js app — TypeScript, component patterns, state/data fetching, styling, accessibility, and testing. Read before implementing or reviewing any frontend code for DocuMind.
---

# DocuMind — Frontend Skills & Conventions

Companion to `documind-master-v3.md` (what to build) and `DESIGN.md` (the visual system). This document is *how to write it*: conventions that keep the frontend consistent, accessible, and typed correctly as it grows.

---

## Purpose

Anyone — human or agent — implementing or reviewing frontend code for DocuMind should follow these conventions. They exist so server state and UI state don't get tangled, types don't silently drift from the backend, and accessibility is built in rather than patched on.

---

## Core Principles

1. **Server state and UI state are different things, handled differently.** Anything the backend owns (documents, processing status, chat history) goes through TanStack Query. Anything purely local (a modal's open/closed state, a form draft) is plain React state. Don't reach for global state management to solve either problem — see [State & Data Fetching](#state--data-fetching).
2. **Components are typed, not `any`'d.** TypeScript's value is proportional to how strictly it's used.
3. **Accessibility is built during the component, not added in a Phase-4 pass.** Every new interactive element gets keyboard and screen-reader support at the same time it gets a visual design.
4. **No component calls `fetch` directly.** All HTTP goes through `lib/api.ts`.

---

## Project Layout Conventions

```
frontend/
├── app/               route segments (App Router) — pages compose components, they don't contain business logic
├── components/        one component per file, PascalCase, colocated test file
├── lib/
│   ├── api.ts         the only place fetch/HTTP calls are made
│   ├── auth-context.tsx  AuthProvider — holds the in-memory access token
│   └── types.ts       shared types, mirroring backend Pydantic schemas
└── public/
```

---

## TypeScript Conventions

- `strict: true` in `tsconfig.json` — non-negotiable.
- No `any`. If a type is genuinely unknown (e.g. a third-party callback payload), use `unknown` and narrow it before use.
- Processing status is a discriminated union (`status: "uploaded" | "processing" | ... | "ready" | "failed"`), not a loose `string` — this makes an invalid status a compile error, not a runtime surprise.
- Keep `lib/types.ts` mirrored to the backend's Pydantic schemas by hand for V1. As the API surface grows, consider generating types from the OpenAPI schema (e.g. `openapi-typescript` — verify version) so the two can't silently drift; this is a good candidate for a CI check once the manual mirroring starts to hurt.

---

## Component Conventions

- Function components only, one per file.
- Pages/route segments fetch data and manage top-level state; components below them receive data via props. A `TableViewer` should not know how to fetch a document — it renders the rows it's given.
- Styling is Tailwind utility classes co-located with the markup; no separate CSS files unless something is genuinely global (e.g. font-face declarations).
- Every component that shows async data has three explicit states — loading, error, success — never just the success case with a hope that the others won't happen.

---

## State & Data Fetching

- **Server state** — the documents list, a document's detail, processing status, chat history — is owned by **TanStack Query** (verify version before use). Query keys follow a consistent shape: `['document', id]`, `['documents', { page, sort }]`, `['chat', documentId]`.
- **Processing status** polls via `refetchInterval`, active only while status is non-terminal; stop polling once `ready` or `failed` is reached. This is the one place polling is correct — don't generalize it into a global polling pattern for things that don't need it.
- **Mutations** (upload, delete, send chat message) invalidate the relevant query key(s) on success — e.g., a successful upload invalidates `['documents', ...]` so the list reflects it without a manual refetch call scattered elsewhere.
- **UI state** — modal open/closed, active tab, form input before submit — is `useState`/`useReducer`, kept local to the component that needs it. Don't introduce Redux or Zustand at this scope; there's no cross-cutting client state that justifies the overhead.
- **Auth token**: held in a small `AuthProvider` context (`lib/auth-context.tsx`), attached automatically by `lib/api.ts` to every request. Never read or write it via `localStorage`.
- Optimistic UI is fine for things that are safe to assume succeeded (e.g., an instantly-appended user chat message before the answer arrives) but never for processing status, which must reflect real backend state per `documind-master-v3.md`.

---

## Styling Conventions

- Tailwind, utility-first. Design tokens (color, spacing) are centralized in `tailwind.config.ts`, sourced from `DESIGN.md` — never hardcode a hex value inline in a component.
- Dark mode is the only mode for V1 (per the design system), but token names should be semantic (`bg-surface`, not `bg-neutral-900`) so a future light mode is a token-file change, not a component rewrite.

---

## Accessibility Checklist

Every new interactive component should clear this list before it's considered done:

- [ ] Reachable and operable by keyboard alone (tab order makes sense, no keyboard trap)
- [ ] Visible focus indicator (never `outline: none` without a replacement)
- [ ] Semantic HTML first (`<button>`, not a `<div onClick>`) — ARIA roles are a fallback, not the default
- [ ] Form inputs have associated `<label>`s; errors use `aria-describedby`
- [ ] Async status changes (processing stage, chat answer arriving) announced via `aria-live="polite"`
- [ ] Respects `prefers-reduced-motion`
- [ ] Color is never the only signal (pair status colors with an icon or text label)

---

## Performance Patterns

- Dynamically import heavy, below-the-fold components (`TableViewer`, the markdown renderer) via `next/dynamic` rather than including them in the initial bundle.
- Memoize expensive renders (`React.memo`, `useMemo`) where profiling shows an actual cost — don't memoize preemptively everywhere, it adds complexity for no measured benefit.
- If a table or chat history genuinely grows large enough to matter, consider list virtualization (`@tanstack/react-virtual`) — but only once real usage shows it's needed, not as a default.

---

## Error & Loading State Pattern

Every data-fetching component handles all three states explicitly:
- **Loading:** a skeleton or spinner appropriate to the content's shape, not a full-page blocker for a small widget.
- **Error:** shows the backend's error envelope `message` — never a raw stack trace or `error.toString()`.
- **Success:** the actual content.

No silent failures — an empty state and an error state are visually and textually distinct (see `DESIGN.md` → Content & Voice).

---

## Testing Conventions

- **Vitest + React Testing Library** for components and hooks, colocated as `ComponentName.test.tsx`. Test behavior (what the user sees/can do), not implementation details.
- **Playwright** for one critical end-to-end path: register → upload → wait for ready → ask a question → see a cited answer. This one path catches integration breaks that unit tests can't.
- Mock `lib/api.ts` in component tests — don't hit a real backend from a unit test.
- Verify library versions before use, per the Library Version Rule in `documind-master-v3.md`.

---

## Do's and Don'ts

| Do | Don't |
|---|---|
| Fetch server data through TanStack Query | Roll your own `useEffect` + `fetch` + `useState` for server data |
| Keep the access token in memory (`AuthProvider`) | Store the access token in `localStorage` |
| Use semantic HTML elements | Reach for `<div onClick>` where a `<button>` works |
| Reference design tokens (`bg-surface`, `text-accent`) | Hardcode hex colors inline in components |
| Show loading/error/success states explicitly | Assume the happy path and let errors render blank |
| Dynamically import heavy, rarely-first-viewed components | Bundle the table viewer and markdown renderer into the initial page load unconditionally |
