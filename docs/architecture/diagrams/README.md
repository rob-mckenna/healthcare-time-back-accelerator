# Architecture diagrams

This directory holds the shift-closeout architecture diagram in two
synchronized forms:

| File | Role |
|---|---|
| [`shift-closeout-architecture.excalidraw`](shift-closeout-architecture.excalidraw) | Editable source. Open and edit in [`https://aka.ms/excalidraw`](https://aka.ms/excalidraw). This is the file you change. |
| [`shift-closeout-architecture.svg`](shift-closeout-architecture.svg) | Committed, accessibility-optimized render embedded in the repository [`README.md`](../../../README.md). This is the file readers see on GitHub. |

The two artifacts must always communicate the same architecture. The committed
SVG is a hand-tuned render — it uses system fonts, an explicit `role`, `title`,
and `desc`, and no external resources — rather than a raw Excalidraw export, so
it stays legible and accessible on GitHub. `npm run validate:diagram` enforces
that every label in the Excalidraw source also appears in the SVG, so the render
cannot silently drift from the source.

## What the diagram must always show

These invariants come from `SQUAD_BOOTSTRAP.md` (Option A scope lock) and are
checked by `npm run validate:diagram`:

- Exactly **one** Copilot Studio care-team experience (workflow).
- Exactly **one** Microsoft Foundry Shift Closeout Agent, marked `(exactly one)`.
- The **solid** path is the working local deterministic P0 simulation
  (`npm run demo`); the **dashed** path is the live Copilot Studio → Foundry
  binding, which is `NOT CONNECTED` / `NOT RUN` under `RISK-020`.
- The working-versus-blocked distinction is legible **without relying on color
  alone**: solid versus dashed strokes, explicit text labels (`local run —
  working`, `binding — not connected`), and a legend all carry the meaning.
- The persistent safety notice (`DRAFT — HUMAN REVIEW REQUIRED`, synthetic data
  only, no clinical recommendation) stays at the top.
- No secrets, tenant IDs, endpoints, or real patient/staff values appear;
  Harborlight is labeled the example-only configuration. `npm run scan:secrets`
  covers both artifacts.

## Reproducible update and export process

1. **Edit the source.** Open
   `docs/architecture/diagrams/shift-closeout-architecture.excalidraw` in
   [`https://aka.ms/excalidraw`](https://aka.ms/excalidraw) (do **not** use
   `excalidraw.com`) and make the change there. Keep boxes chunked and text
   short so the diagram survives being downscaled on GitHub and narrow/mobile
   viewports. Save back over the same `.excalidraw` file.

2. **Update the SVG to match.** Reflect the same labels and structure in
   `shift-closeout-architecture.svg`. When you add, remove, or reword a box or
   arrow label in the source, make the identical edit in the SVG. Preserve the
   SVG's `role="img"`, the `aria-labelledby` root attribute, and the
   `<title>` / `<desc>` block, and keep all references internal (only
   `url(#…)` fragment references — no `href`, `<image>`, `<script>`, remote
   URLs, `@import`, or `data:` URIs).

3. **Keep the description and README alt text in sync.** The SVG `<desc>` and
   the README image alt text both describe the diagram for screen readers and
   for anyone who cannot read the downscaled image on a phone. Update all three
   — source, SVG `<desc>`, and README alt text — in the same change so they tell
   the same story.

4. **Validate.** Run the diagram gate, then the full gate:

   ```bash
   npm run validate:diagram
   npm run verify
   ```

   `validate:diagram` checks artifact parity, self-containment, accessibility,
   the Option A scope invariants above, and the README embed. `npm run verify`
   also runs `scan:secrets` over both artifacts. Both must exit zero before the
   change is complete.

## Legibility on GitHub and mobile

GitHub scales the SVG down to the content column on desktop and to the screen
width on phones, which shrinks the smallest labels. Two durable mitigations keep
the architecture readable regardless:

- The diagram is composed of a small number of clearly separated, high-contrast
  boxes with short labels rather than dense small print.
- The repository `README.md` restates the entire diagram in prose — the legend,
  the solid working path, the dashed not-connected path, and every safety
  boundary — and the SVG carries the same information in its `<desc>`. A reader
  on a narrow screen never depends on reading the shrunken image.

When you change the diagram, update the README prose legend and the SVG `<desc>`
so this text mirror stays accurate.
