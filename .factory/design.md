# Design thesis — Paper Trail

## Direction

**Risograph tactile collage.** Gmail Takeout is an awkward physical-feeling job: a huge sealed archive must be opened, thumbed through, and clipped into useful pieces. The interface treats the file as a stack of overprinted paper, with rough ink edges, crop marks, stamped states, and a looping paper trail that passes through a small indexing machine. It should feel private, legible, and dependable—not like cloud software or a glossy converter sales page.

The utility view keeps the collage at the edges so message content remains the most prominent layer. Hard outlines, offset shadows, and paper layers communicate what is local, indexed, selected, or exportable.

## Palette

The light treatment is explicit and primary, inspired by archival paper and two-ink printing. Dark mode swaps the paper stock rather than becoming neon.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#F4EEDC` | `#1E211D` | page/background |
| `sheet` | `#FFFDF5` | `#292C27` | reading surfaces |
| `ink` | `#17211D` | `#F7F0DA` | primary text |
| `muted` | `#5C655E` | `#B9BEAE` | secondary text |
| `tomato` | `#C83B2E` | `#F26B5B` | primary action / focus |
| `blue` | `#186E89` | `#59B9D1` | links / selected state |
| `mustard` | `#E6B93E` | `#E8BE50` | progress / warning |
| `green` | `#286C4B` | `#6FC08F` | success |
| `danger` | `#A72E28` | `#FF8177` | errors |
| `rule` | `#24312A` | `#D7DCCB` | outlines |

All normal text combinations meet 4.5:1; color is always paired with a label, icon, or shape.

## Type

- **Display:** Georgia, `Times New Roman`, serif. Its sturdy editorial forms turn archive work into a readable records desk and avoid an imported font payload.
- **Utility and message UI:** `ui-monospace`, SFMono-Regular, Consolas, monospace. Headers, byte counts, dates, and index state align cleanly and recall raw mail without becoming terminal cosplay.
- Body is 16px minimum, message copy 17px/1.6, labels 12–13px with weight rather than tiny type. Numeric columns use tabular figures.

## Spacing and shape

- 4px base rhythm; primary intervals: 8, 12, 16, 24, 32, 48, 72px.
- Corners are clipped or only slightly rounded (2–8px). Main controls are 48px tall; every target is at least 44×44px.
- 2px ink rules and 4px offset shadows create the print layers. Cards only identify independent sheets: archive summary, message rows, and licensing panel.
- Desktop is a 320px filter rail beside a fluid message desk. At ≤760px the rail becomes the first stacked section and message reading takes over the viewport. Decorative scraps disappear before content compresses.

## Interaction grammar

- Primary buttons depress their offset print shadow on activation.
- Import progress advances as a striped registration bar with explicit count, bytes, rate, and Cancel.
- Selected messages gain a blue left registration stripe plus a checked control; selection never relies on color alone.
- Opening a message moves from its row into a reading sheet; Back returns focus to the originating row.
- Async changes are announced through one polite live region. Errors state the failed job and the next action.

## Motion

Transitions last 160–240ms and use only opacity/transform: sheets lift by 3px, the reading pane enters from the row’s direction, and toast notices rise from their dock. No ambient looping animation. With `prefers-reduced-motion: reduce`, all transforms and smooth scrolling are removed and state changes are immediate.

## Asset plan and provenance

- `hero-archive.webp`: original AI-generated risograph collage showing a monumental folded mail archive feeding through a small desktop indexer into sorted paper slips. Used only on the pre-import welcome panel, with meaningful alt text. Responsive WebP, explicit dimensions, ≤300KB.
- `social-preview.webp`: 1200×630 WebP crop derived from `hero-archive.webp` on 2026-08-28 with ImageMagick. Used for Open Graph and Twitter previews; it retains the same original factory-image provenance and contains no text.
- App icons and all interface glyphs are hand-authored geometric SVG/CSS, not stock assets.
- Paper grain and halftone use CSS gradients at very low opacity; no external texture requests.

### Hero prompt sheet

Use case: `illustration-story`. Asset: wide landing-page hero. Subject: an enormous accordion-fold paper email archive feeding through a compact hand-cranked indexing machine and emerging as a few neatly sorted message cards and one paperclip. World/materials: tactile cut paper, rough fibers, imperfect two-pass risograph overprint, halftone dots, tiny registration marks. Composition: landscape, machinery right of center, generous calm negative space on the left/top, no people. Light: flat editorial print lighting. Palette words: warm archival cream, carbon ink, tomato red, petrol blue, mustard accents. Avoid: readable text, letters, logos, Gmail branding, UI screenshots, photorealism, gradients, glossy 3D, watermarks, borders, unintended symbols.

Generated with the factory image model (`factory-image`) on 2026-08-27 using `/opt/fleet/lib/gen-image.sh`. Original for this product; no source image or third-party copyrighted asset.
