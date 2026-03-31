# Automatic Recognition Plan

## Why the photo is not recognized automatically yet

The current Phase 1 implementation supports:

- photo upload
- optional manual barcode entry
- browser barcode detection when the platform supports it
- manual product confirmation
- trust labels from the selected product

It does **not** yet include a real automatic recognition pipeline for:

- image classification
- OCR text extraction
- barcode decoding on the backend
- LLM or multimodal model analysis

## Recommended next architecture

Use a multi-step pipeline instead of relying on a single model:

1. Try barcode detection
2. Try OCR on visible packaging text
3. Run a vision-capable model to suggest likely product candidates
4. Match against the curated catalog
5. Return:
   - suggested product
   - confidence level
   - explanation
   - fallback to manual confirmation

## LLM role

An LLM or multimodal vision model should be used to:

- identify likely produce or packaged product type
- extract text hints from labels
- rank likely catalog candidates
- generate a short explanation for the suggestion

It should **not** be the final source of truth for product origin by itself.

Origin confidence should still come from:

- barcode match
- OCR text
- curated product records
- origin evidence stored in Supabase

## Product principle

The AI layer should help with:

- `suggest`
- `rank`
- `explain`

It should never:

- fabricate certainty
- overwrite curated evidence silently
- present origin as verified when evidence is weak
