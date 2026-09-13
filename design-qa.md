# Design QA — Phase 7.5 reading controls

## Visual truth

- Selected concept: `/Users/kh03/.codex/generated_images/01a07412-f055-7120-9fa2-c4ee533273a0/exec-ca0e65dd-5648-4607-ad99-cd54633328aa.png`
- Direction: concept 3 structure with the cooler blue-charcoal color language from concepts 1 and 2.
- Source dimensions: 1487 × 1058 px.

## Implementation capture

- Screenshot: `artifacts/design-qa/implementation-dusk-1440x900.png`
- Viewport: 1440 × 900 CSS px at device scale factor 1.
- State: desktop, Display settings open, Dusk preset selected, Rendered view selected.
- Full comparison: `artifacts/design-qa/full-comparison.png`
- Focused settings comparison: `artifacts/design-qa/settings-comparison.png`

The source was resized to 1440 px wide and cropped from the top to 900 px so the full-view comparison uses the same pixel dimensions. The focused comparison isolates the left navigation and settings surface. Document content differs because the concept uses a representative archived spec while the implementation capture uses the live repository content; structure, hierarchy, control placement, density, and palette were compared.

## Findings and iteration history

1. P1 — On mobile, moving Display settings to the sidebar footer initially allowed the document tree to push the settings surface below the drawer. Fixed by making the sidebar a flex column with an internally scrolling tree and a stable footer.
2. P1 — The no-JavaScript mobile page inherited the enhanced flex drawer behavior and could hide or clip navigation. Fixed with a no-JavaScript mobile override and by hiding the document toolbar until enhancement.
3. P2 — The front-matter summary used muted text with insufficient contrast in some palette combinations. Fixed by using the primary text token.
4. P2 — The previous focus-order assertion assumed settings lived above the tree. Updated the keyboard-flow test to reflect its new footer position while preserving Escape focus restoration.
5. P2 — Dev and static captures at 1440 px differed in 25 of 1,296,000 pixels, with a maximum channel delta of 1. Replaced compressed-PNG byte equality with strict decoded-pixel thresholds: at most 0.005% differing pixels and maximum channel delta 1.

## Final assessment

- Source/Rendered is outside the document surface and aligned as a compact reader toolbar.
- Display settings is a distinct sidebar mode rather than content embedded in the article.
- Paper, Dusk, Night, and Auto are visually legible choices; Dusk matches the selected cool blue-charcoal direction.
- Tree density, folder indentation, responsive bounds, keyboard behavior, no-JavaScript rendering, and accessibility checks pass.
- Full Playwright suite: 6/6 passed.
- Unit suite: 72/72 passed.

Final result: passed

---

# Design QA — reading typography and appearance

## Visual truth

- Selected concept: `/Users/kh03/.codex/generated_images/01a07412-f055-7120-9fa2-c4ee533273a0/exec-02ca8c31-1284-4a13-9b7c-aaf086e9464d.png`
- Direction: concept 3 structure with the restrained neutral and blue color language preferred from concepts 1 and 2.
- Required behaviors: no document-footer pagination; unified body and heading text scaling; lighter heading and bold weights; independent Theme and Color controls.

## Implementation review

- URL: `http://127.0.0.1:4174/`
- State reviewed: desktop reader, Display settings open, Rendered view.
- Theme states reviewed: system dark and explicit Light.
- Color state reviewed: Slate default and Ocean selected; Forest, Sand, and Rose are exposed by the same control pattern.
- Text-size state reviewed: Small, Medium, and Large. Body copy and headings scale together while retaining their hierarchy.

## Findings and resolutions

1. P1 — Appearance presets coupled theme and color, preventing combinations such as Light/Ocean. Replaced them with independent Auto/Light/Dark and five-color controls.
2. P1 — Previous/Next controls occupied the end of the Markdown surface. Removed the footer pagination while retaining keyboard navigation and the document tree.
3. P2 — Text sizing initially affected body copy but not headings. Added a coordinated heading scale while keeping UI copy unchanged.
4. P2 — Headings and inline emphasis used an 800 weight. Reduced the document hierarchy to 650–680 and emphasis to 650, with more deliberate heading spacing.
5. P2 — Theme color selection lacked a compact preview. Added labeled swatches for Slate, Ocean, Forest, Sand, and Rose with distinct light and dark tokens.

## Final assessment

- Display settings matches the selected concept's hierarchy and density.
- Theme and color can be combined independently and retain accessible pressed states.
- Text-size controls explicitly communicate and scale headings with body copy.
- The reading surface contains Markdown content and metadata only; Rendered/Source remains outside it and footer pagination is absent.
- Unit tests (73/73), E2E tests (6/6), TypeScript, formatting, package installation, build, and benchmark checks pass.
- Browser interaction was visually verified in the in-app browser at the live local URL.

Final result: passed
