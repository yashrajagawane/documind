# DocuMind — Design System

Companion to `documind-master-v3.md`, which sets the base palette and two core layouts. This document is the full system those decisions sit inside: why they're shaped this way, and what to do with everything the master prompt didn't specify.

---

## Design Philosophy

DocuMind's users are doing focused analytical work — reading a contract, checking a financial report, verifying what a dense document actually says. The interface's job is to support sustained attention, not compete for it. That rules out anything that behaves like a marketing site: no scroll-triggered reveals, no decorative gradients, no chrome that exists to look like "an AI product" rather than to help someone read.

The one place DocuMind is allowed to feel alive is in showing real progress and real grounding — an honest processing indicator, a citation you can actually click through to the source. Spend the interface's personality there, not on surface decoration.

---

## Foundations

### Color

The base palette from `documind-master-v3.md` is the source of truth for hue and mood — this section formalizes it into full semantic tokens with the states the master prompt didn't spell out.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0a0a0a` | App background |
| `surface` | `#111111` | Cards, panels |
| `surface-raised` | `#171717` | Modals, dropdowns — one step lighter than `surface` so layering is visible without a heavy shadow |
| `border` | `#1f1f1f` | Default dividers/borders |
| `border-strong` | `#2a2a2a` | Focus rings, active input borders |
| `text-primary` | `#f9fafb` | Body text, headings |
| `text-secondary` | `#9ca3af` | Metadata, captions, timestamps |
| `text-tertiary` | `#6b7280` | Disabled text, placeholder text |
| `accent` | `#7c3aed` | Primary actions, links, active states |
| `accent-hover` | `#6d28d9` | Hover/active on accent elements |
| `accent-muted-bg` | `#7c3aed1a` (10% opacity) | Subtle highlight background — e.g. the active sidebar item, a selected citation |
| `success` / `warning` / `error` | `#10b981` / `#f59e0b` / `#ef4444` | Status only — never decorative |

**Contrast check before shipping any new text/background pairing:** `text-primary` on `bg` and `surface` both clear WCAG AA. `accent` as a *text* color on `bg` is borderline for small text — prefer `accent` for large text, icons, and fills (buttons), and lean on `text-primary` with an `accent`-colored icon or underline for small inline links.

### Typography

Pick faces deliberately rather than defaulting to the system stack — the type is doing real work distinguishing "the assistant's prose" from "your document's actual words."

- **UI and prose (headings, body, chat answers):** Inter or Geist Sans — highly legible at small sizes, free, self-hostable, and unremarkable in the right way for a tool used for long reading sessions.
- **Extracted/source content (table viewer, citation snippets, raw markdown export preview):** Geist Mono or JetBrains Mono. This isn't decorative — a monospace treatment is the visual signal that "this is verbatim source text," distinct from the AI's generated prose next to it. That distinction is the product's core trust mechanism made visible.

**Type scale** (line-height in parentheses):

| Role | Size | Weight |
|---|---|---|
| Page title | 24px (32) | 600 |
| Section heading | 20px (28) | 600 |
| Body | 16px (24) | 400 |
| Secondary/meta | 14px (20) | 400 |
| Caption/label | 12px (16) | 500 |

Keep body text line length under ~75 characters in the chat and preview panes — both are read continuously, and an unconstrained line length is the single easiest thing to get wrong in a two-column layout.

### Spacing

4px base unit. Steps: `4, 8, 12, 16, 24, 32, 48, 64`. Pick from this scale rather than arbitrary pixel values — consistency here is what makes the "professional spacing" requirement in the master prompt actually hold up across dozens of components built at different times.

### Radius & Elevation

- Inputs and buttons: `6px` radius.
- Cards and panels: `10px` radius.
- Full-bleed panels (the document preview pane, the chat pane): `0px` — they're structural, not "cards."
- Elevation is a `border` + a very slight shadow (`0 4px 12px rgba(0,0,0,0.3)`), reserved for things that are genuinely floating above the layout — modals, dropdowns, toasts. Don't apply a shadow to every card by default; a shared border color already communicates a flat, calm surface, which fits the philosophy above better than a soft-shadow-on-everything treatment.

---

## Layout System

The two layouts specified in `documind-master-v3.md` (app shell with sidebar, document detail split view) are canonical. This adds the responsive behavior the master prompt left open:

**Breakpoints:** mobile `<640px`, tablet `640–1024px`, desktop `>1024px`.

- **App shell:** sidebar collapses to a bottom nav or a hamburger-triggered drawer below `1024px` — don't shrink the sidebar to icon-only, which crowds the "+ New Doc" action that should stay prominent.
- **Document detail split view:** below `1024px`, the side-by-side Preview/Chat layout becomes two tabs ("Preview" / "Chat") rather than a squeezed, unreadable split. This is a real interaction decision, not just a CSS breakpoint — a stacked-and-scrolling layout would bury the chat below a potentially long document preview.

---

## Core Components

Brief specs, not full implementations — enough to keep every instance of a component consistent.

| Component | States to design |
|---|---|
| Button | primary / secondary / ghost / destructive, each with default / hover / active / disabled / loading |
| Input & Textarea | default / focus / error, with error text below the field, never only a red border |
| Upload Dropzone | idle / drag-over / uploading (with progress) / error — plus the always-present labeled file input (see Accessibility) |
| Processing Status stepper | pending (hollow) / active (filled, subtly animated) / complete (check) / failed (error color, with the error message inline) — maps directly to the ASCII stepper in `documind-master-v3.md` |
| Chat message | user bubble vs. assistant bubble, visually distinct; assistant messages include collapsed-by-default source citation chips that expand to show page/section/snippet |
| Table viewer | sticky header row, horizontal scroll contained to the table (the page itself never scrolls sideways) |
| Toast / inline error banner | uses the `error`/`warning`/`success` tokens with an icon, never color alone |

The processing stepper is the one place a numbered/sequential visual treatment is earned — the pipeline genuinely is a sequence. Don't extend that same numbered-badge treatment to things that aren't sequential (e.g., don't number the sidebar nav items) just for visual consistency.

---

## Motion

Motion is used to answer something the user did, or to show real system state — never as decoration.

- **Earned:** the active processing step's subtle pulse (shows liveness — the system hasn't stalled), a chat message's arrival, a dropdown opening/closing, a toast sliding in.
- **Not earned:** entrance animations on page load, hover-lift on every card, staggered fade-ins down a list. These are the generic "AI-generated interface" tells, and they actively work against a tool meant for focused reading.
- Always respect `prefers-reduced-motion` — disable non-essential transitions when it's set, per `documind-master-v3.md`'s Accessibility section.

---

## Content & Voice

Words are part of the design, not filler around it.

- **Active voice, consistent verbs end-to-end.** A button that says "Ask" should lead to an answer, not a toast that says "Query submitted." Keep the same word for the same action everywhere it appears.
- **Errors are specific and don't apologize.** The master prompt's own hallucination-guard message is the model to follow: *"I could not find enough information in the uploaded document to answer this question."* It says exactly what happened and implies nothing false. Apply the same standard to upload errors, processing failures, and auth errors — say what went wrong, not "Oops, something went wrong!"
- **Empty states are invitations, not dead ends.** An empty document list reads "Upload your first document to get started," not "No documents found."
- **Plain language over system language.** Users manage "documents" and "questions," not "vectors" or "chunks" — those are backend concepts and should never leak into UI copy.

---

## Accessibility Standards

Full checklist lives in `documind-master-v3.md` (Accessibility) and `SKILLS-FRONTEND.md` (component-level checklist). The short version for design work specifically: every color pairing gets checked against the contrast table above before it ships, every custom interactive element gets a visible focus state designed alongside its default state (not added afterward), and status is never conveyed by color alone — pair it with an icon or label.

---

## Anti-Patterns — What to Avoid

Specific, common defaults that read as generic or templated rather than considered. None of these are permanently banned — the point is that using one should be a deliberate choice for a specific piece of content, not the automatic default:

- **Tracked-out, all-caps eyebrow labels** above every section heading. If a label is needed, sentence case reads calmer and fits the philosophy above better.
- **Numbered badges (01 / 02 / 03)** on content that isn't actually a sequence. The processing stepper earns this treatment because it's genuinely sequential; a features list or a sidebar doesn't.
- **Identical rounded-card-with-soft-shadow** applied to every surface regardless of whether it's floating above the layout or part of it. Reserve elevation for things that are actually elevated (see Radius & Elevation above).
- **Gradient washes as decoration.** Already ruled out in the master prompt's design rules — reinforced here because it's one of the most common "generic AI SaaS" tells.
- **A "→" appended to every button and link.** Use it only where it adds real information (e.g., "Continue to export →" ahead of a multi-step flow), not as a default flourish on "Ask," "Save," or "Delete."

---

## Source of Truth

For the base palette and the two canonical layouts, `documind-master-v3.md` → **Frontend — Design System / Layout** is authoritative. This document expands and explains; if the two ever conflict, treat that as a signal to reconcile them, not to pick one silently.
