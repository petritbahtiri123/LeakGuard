# LeakGuard 2.0.x Image Redaction Incident Fix Closeout

Date: 2026-06-15
Status: patch implemented; release remains NO-GO until headed Chrome/package gates pass in a clean QA environment

## Confirmed root cause

The local confirmed root cause is an output-validation gap in the protected-site visual image redaction path: a redactor result that reported success but produced an empty or invalid generated PNG `File` could be treated as safe for upload by the content file extraction pipeline. Real providers commonly reject zero-byte or malformed synthetic files, which matches the rollout symptom where protected-site image redaction appeared to fail when users attempted image uploads.

This patch makes the image path fail closed unless the generated replacement is a usable `.redacted.png` file with MIME `image/png` and non-zero size. It also makes the lower-level image redactor report `image_redaction_empty_output` if canvas export returns an empty blob.

## Exact affected path

1. Protected-site image upload enters `ContentFileExtractionPipeline.processFileForAdapterHandoff()`.
2. OCR and box mapping produce an image redaction request.
3. `ImageRedactor.createRedactedPng()` creates a PNG blob.
4. The pipeline converts the blob/result file into `sanitizedFile` and marks it safe for file-only upload.
5. Before this patch, non-null was enough at the pipeline boundary; after this patch, the generated file must be non-empty, `image/png`, and named `*.redacted.png`.

## Raw leak assessment

No raw pass-through was added. If redacted image generation returns an empty or invalid output, the protected-site path returns `blocked`, clears `sanitizedFile`, clears output name/kind, and preserves the existing fail-closed behavior. The new regression asserts that the raw synthetic marker and raw image text do not appear in the blocked result.

## Regression tests added

- Scanner/image-redactor regression: empty canvas output is rejected with `image_redaction_empty_output` and no blob is returned.
- Protected-site pipeline regression: empty generated `.redacted.png` is rejected, no sanitized upload is produced, and raw marker data is not exposed in the result.
- Release artifact regression: release packages must include the protected-site OCR broker, content pipeline, scanner OCR, image redactor, and required local OCR assets.

## Artifact/package verification

The exact 2.0.0 Chrome Web Store zip remains unavailable in this checkout. Local release artifact validation is blocked in this environment because `prepare:build` tries to install Python training dependencies and pip cannot fetch `joblib` through the configured proxy. Therefore, package-drift and Store-upload identity remain open release blockers.

## Browser/profile verification

Headed Chrome QA was not possible in this container because Chrome, Edge, and Firefox executables are unavailable. Web Store installed verification and clean-profile upgrade verification remain required before release GO.

## Go/no-go for patched 2.0.x Chrome release

NO-GO in this environment. The code patch is ready for clean-environment validation, but Chrome release should wait for:

- exact Store/upload candidate zip identity and checksum
- `npm run test:release-gates` in an environment with working build dependencies
- `npm run test:browser-gates` in an environment with configured Chrome
- headed clean-profile protected-site image picker/drop verification
- scanner `.redacted.png` download verification
- at least ChatGPT and Gemini synthetic image handoff verification if those providers are release claims
