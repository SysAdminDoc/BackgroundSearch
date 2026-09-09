# BackgroundSearch concept archive

This folder preserves the original materials and the review trail for the v2.7.1 marketing pass. A capture being here doesn't mean it was selected for the README.

## Selected direction

Keep the existing blue browser-and-search artwork. It has a readable wordmark and a recognizable search motif. The full raster works on a dark background; the small magnifier is used for the toolbar and settings interface. These are different sizes and uses, not competing replacement brands.

The README leads with the product in use. A short selection menu explains the benefit more clearly than a large decorative logo. Settings and side-panel captures show the controls users actually install. The static toolbar icons now use exports from the existing runtime drawing, which removes the old squared-off handle without changing the mark.

## What is preserved

- `original-source-fc5fd69.zip` contains all 23 files from the original Git snapshot, including every original PNG. The source artwork hasn't been overwritten.
- `original-marketing/` contains copies of the existing, previously ignored generation prompts and icon generator. They are historical inputs, not instructions to run the generator.
- `reviews/` contains original and revised screenshots and their test reports. Only top-level capture and report files are archived. Browser profiles, credentials and signing keys are never copied here.
- `brand-review.png` compares the existing artwork and runtime icon sizes on light and dark backgrounds. It's a review sheet, not a screenshot of the extension.

## Why early captures were rejected

The baseline popup hid engine choices below advanced controls and produced horizontal overflow. Its side panel clipped the search button. Quick Menu wasn't appearing on the test page. Later review catches included a vertical icon-only menu, faint destination badges and captures taken before transitions had settled.

The selected screenshots show readable engine names in Quick Menu, engine choices near the top of settings, settled control states and a side panel that fits its width. Dark and light captures are checked separately.

## Future generation brief

If a higher-resolution brand export is needed, use the original artwork as the reference. Preserve the blue browser outline, search lens and exact BackgroundSearch spelling. Simplify reflections before adding detail. Produce an editable vector wordmark and a separate small icon; don't squeeze the wordmark into toolbar sizes. Supply a solid dark-background preview as well as a genuine RGBA export with zero alpha outside the mark. Do not simulate transparency with a checkerboard.

Review any new export at 16, 32 and 128 pixels, in both light and dark contexts. Reject broken letterforms, doubled outlines, illegible small marks or decorative detail that weakens the silhouette. A new concept should remain in this archive until it is clearly stronger than the current identity.
