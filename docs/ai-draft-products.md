# AI Draft Products

AI can help expand the catalog, but it should not publish new products automatically.

Recommended workflow:

1. The recognizer returns a `visualGuess`, optional barcode/PLU hints, and reasoning.
2. If there is no strong catalog match, the app creates a `draft` product candidate.
3. The draft stays invisible to public users until an admin reviews it.
4. An admin confirms:
   - product name
   - aliases
   - barcode or PLU hints
   - nutrition facts
   - whether origin is `producido_en_mexico`, `importado`, or `no_confirmado`
5. Only then does the product move from `draft` to `active`.

Why this is the safest path:

- it lets the AI accelerate data entry
- it preserves the trust principle
- it prevents the model from silently inventing products or origins
- it keeps uncertain produce items, like bananas, from being mislabeled as Mexican by default

For produce in particular, identity and origin should be treated separately:

- `identity` can be inferred from image, PLU, and label
- `origin` should require evidence from the seller, sticker, packaging, or curated admin review
