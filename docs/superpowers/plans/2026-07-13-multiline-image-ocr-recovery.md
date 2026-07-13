# Multi-line Image OCR Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover readable 10–30 line protected-site images by using an independently verified medium/high-confidence line box when a detected secret's word box is genuinely low confidence.

**Architecture:** Keep the existing single OCR pass and confidence thresholds. Preserve both word and line geometry through the OCR worker/runtime boundary, prefer precise word boxes, and conservatively redact a complete containing line only when its independent confidence and geometry remain protected-site eligible.

**Tech Stack:** Chrome MV3 extension JavaScript, local Tesseract WASM OCR, Node.js assertion tests, Playwright E2E, Sharp synthetic image fixtures.

## Global Constraints

- Processing remains local-only; no backend, telemetry, analytics, remote OCR, or remote model calls.
- Do not lower or reinterpret the current high/medium OCR thresholds (`high >= 85`, `medium >= 60`).
- Image resolution alone must not determine eligibility.
- Never upload the raw image or substitute OCR text for an image-only flow.
- Preserve one user action, one sanitized handoff, placeholder stability, and multi-file all-or-nothing behavior.
- Keep fallback whole-image boxes protected-site ineligible.
- Do not change manifest, permissions, CSP, network behavior, policy, detector thresholds, or public privacy behavior.
- Chrome and Edge are the product targets for this work; Firefox validation is excluded.

---

### Task 1: Preserve auxiliary line geometry and select it safely

**Files:**
- Modify: `tests/scanner_ocr.test.js`
- Modify: `src/shared/scannerOcr.js`

**Interfaces:**
- Consumes: OCR layout objects shaped as `{ source, boxes, lineBoxes? }`, with raw-safe box metadata only.
- Produces: `sanitizeOcrLayout()` results that retain `lineBoxes`, and `redactionBoxesForOcrFindings()` results that use a containing eligible line only when the primary word mapping is unsafe.

- [ ] **Step 1: Add a failing low-word/high-line recovery test**

Add a test beside `testOcrWordBoxesArePreferredOverLineBoxes` using a 12-line `ocrText`. Return both a low-confidence word box for the synthetic secret and a medium-confidence line box covering its full line:

```js
async function testLowConfidenceWordBoxRecoversWithEligibleContainingLine() {
  const rawSecret = "sk-proj-MultilineRecovery1234567890abcdef";
  const lines = Array.from({ length: 12 }, (_, index) =>
    index === 7 ? `API_KEY=${rawSecret}` : `SAFE_LINE_${index + 1}=visible`
  );
  const ocrText = lines.join("\n");
  const secretStart = ocrText.indexOf(rawSecret);
  const secretLineStart = ocrText.indexOf(`API_KEY=${rawSecret}`);
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "medium",
        warnings: [],
        words: [wordBox(rawSecret, secretStart, { x: 260, y: 350, width: 900, height: 42 }, 42)],
        lines: [
          lineBox(
            `API_KEY=${rawSecret}`,
            secretLineStart,
            { x: 24, y: 340, width: 1180, height: 62 },
            78
          )
        ]
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("multiline.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 1400, height: 720 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=multiline.png",
    ocrText,
    ocrMetadata: ocr
  });
  const scanResult = scanOcrText(scanText, "multiline.png");
  const result = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult, scanText, ocrText });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.boxKind, "line");
  assert.strictEqual(result.boxes[0].x, 24);
  assert.strictEqual(result.boxes[0].width, 1180);
  assert.ok(result.warnings.includes("ocr_line_boxes_used"));
  assert.strictEqual(JSON.stringify(ocr.layout).includes(rawSecret), false);
}
```

Register the test in `run()` immediately after the current word-preference test.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node tests/scanner_ocr.test.js`

Expected: FAIL because the current sanitizer discards `lines` when `words` exist, leaving `ocr_box_confidence_too_low`.

- [ ] **Step 3: Preserve sanitized auxiliary line boxes**

In the legacy `words`/`lines` branch of `sanitizeOcrLayout()`, normalize word and line collections independently. Keep `layout.boxes` as the current primary collection and add `layout.lineBoxes` only when the primary source is `word` and valid independent line boxes exist:

```js
function boxesFromEntries(entries, kind, normalizedText) {
  const boxes = [];
  let cursor = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const entryText = String(entry?.text || "");
    const fallbackStart = entryText ? normalizedText.indexOf(entryText, cursor) : -1;
    const box = layoutBoxFromEntry(entry, kind, fallbackStart);
    if (!box) continue;
    boxes.push(box);
    cursor = box.end;
  }
  return boxes;
}
```

Build both legacy collections, retain words as primary, and attach line boxes separately. Leave the already structured `result.layout` branch unchanged for Task 2 so its focused structured-layout test demonstrates the live runtime contract gap.

- [ ] **Step 4: Add conservative line selection**

In `redactionBoxesForOcrFindings()`, keep the current word mapping first. If primary matched boxes are absent or merge to low/unknown confidence, select exactly the auxiliary line candidates that fully contain the sensitive finding offsets:

```js
function eligibleContainingLineBoxes(lineBoxes, findingStart, findingEnd) {
  return lineBoxes.filter((box) =>
    box.boxKind === "line" &&
    box.start <= findingStart &&
    box.end >= findingEnd &&
    box.protectedSiteEligible === true &&
    box.visualRedactionSafe === true &&
    (box.confidenceBucket === "high" || box.confidenceBucket === "medium")
  );
}
```

Use the smallest containing eligible line when multiple candidates exist. Merge only that selected line. If no eligible line exists, return the existing `ocr_box_confidence_too_low` or `ocr_box_mapping_missing` result without changing its safety semantics.

- [ ] **Step 5: Add containment, multiple-secret, and resolution-independence regressions**

Add three focused assertions to `tests/scanner_ocr.test.js`:

```js
// An eligible line that ends before the secret ends must not be accepted.
assert.strictEqual(partialContainmentResult.ok, false);
assert.strictEqual(partialContainmentResult.status, "ocr_box_confidence_too_low");

// Two findings on different lines must produce two independent line boxes.
assert.strictEqual(multipleSecretResult.ok, true);
assert.strictEqual(multipleSecretResult.boxes.length, 2);
assert.strictEqual(multipleSecretResult.boxes.every((box) => box.boxKind === "line"), true);

// Small dimensions alone do not make verified geometry ineligible.
assert.strictEqual(lowResolutionResult.ok, true);
assert.strictEqual(lowResolutionResult.protectedSiteEligible, true);
```

Construct each result through `redactionBoxesForOcrFindings()` with synthetic findings and raw-safe geometry. Use `{ width: 320, height: 240 }` for the resolution-independence case and keep its line confidence at `78`; do not bypass the normal dimension validation or box mapping.

- [ ] **Step 6: Verify GREEN and existing precision behavior**

Run: `node tests/scanner_ocr.test.js`

Expected: PASS, including the current tests proving high-confidence word boxes remain preferred and genuine low-confidence boxes remain blocked.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- src/shared/scannerOcr.js tests/scanner_ocr.test.js
git diff --cached --check
git commit -m "fix: recover OCR redaction with verified line boxes"
```

---

### Task 2: Carry independent line boxes through the live OCR runtime

**Files:**
- Modify: `tests/scanner_ocr.test.js`
- Modify: `src/shared/ocr/ocrWorker.js`
- Modify: `src/shared/ocr/ocrRuntime.js`

**Interfaces:**
- Consumes: Tesseract word and text-line iterators from one recognition pass.
- Produces: raw-safe OCR layout `{ source: "word", boxes: WordBox[], lineBoxes: LineBox[] }` when both kinds exist; no OCR text is duplicated inside box metadata.

- [ ] **Step 1: Add failing structured-layout propagation assertions**

Extend the recovery test so its mock returns a structured `layout` instead of legacy `words`/`lines`, with `boxes` containing the low word and `lineBoxes` containing the eligible line. Assert that `recognizeScannerImageFile()` preserves both collections and strips arbitrary fields:

```js
assert.strictEqual(ocr.layout.boxes[0].boxKind, "word");
assert.strictEqual(ocr.layout.lineBoxes[0].boxKind, "line");
assert.strictEqual(ocr.layout.lineBoxes[0].protectedSiteEligible, true);
assert.strictEqual(Object.prototype.hasOwnProperty.call(ocr.layout.lineBoxes[0], "text"), false);
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node tests/scanner_ocr.test.js`

Expected: FAIL because current structured layout sanitization drops `layout.lineBoxes`.

- [ ] **Step 3: Retain both iterator outputs in `ocrWorker.js`**

Update `buildOcrLayout()` to collect both iterator levels once and attach line boxes when words remain the primary precision source:

```js
function buildOcrLayout(module, api, image, text, confidence) {
  const wordBoxes = extractIteratorBoxes(module, api, text, module.RIL_WORD, "word");
  const lineBoxes = extractIteratorBoxes(module, api, text, module.RIL_TEXTLINE, "line");
  if (wordBoxes.length) {
    return {
      ...layoutSummary("word", wordBoxes),
      ...(lineBoxes.length ? { lineBoxes } : {})
    };
  }
  if (lineBoxes.length) return layoutSummary("line", lineBoxes);
  // Preserve the existing scanner-only fallback branch unchanged.
}
```

- [ ] **Step 4: Sanitize auxiliary geometry in `ocrRuntime.js`**

Extract the existing layout-box normalization into a local `sanitizeLayoutBoxes(entries, expectedKind)` helper. Sanitize `response.layout.boxes` exactly as today and sanitize `response.layout.lineBoxes` only as `line` boxes. Attach `lineBoxes` to `result.layout` only when non-empty. Do not copy entry text, raw confidence numbers, or unknown properties.

- [ ] **Step 5: Verify focused tests and runtime syntax**

Run:

```powershell
node tests/scanner_ocr.test.js
node --check src/shared/ocr/ocrWorker.js
node --check src/shared/ocr/ocrRuntime.js
node --check src/shared/scannerOcr.js
```

Expected: all PASS with no warnings or syntax errors.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/shared/ocr/ocrWorker.js src/shared/ocr/ocrRuntime.js tests/scanner_ocr.test.js
git diff --cached --check
git commit -m "fix: retain OCR line geometry for safe recovery"
```

---

### Task 3: Prove protected-site sanitized handoff and genuine failure behavior

**Files:**
- Modify: `tests/content_file_extraction_pipeline.test.js`
- Modify: `tests/e2e/helpers/e2eFileFixtures.mjs`
- Modify: `tests/e2e/whatsapp_reproduction.spec.mjs`

**Interfaces:**
- Consumes: protected-site OCR result with low-confidence word boxes plus eligible containing `lineBoxes`.
- Produces: exactly one verified `.redacted.png` handoff, or no handoff when both word and line confidence remain low.

- [ ] **Step 1: Add protected-site line-recovery integration test**

Add a test beside `testProtectedSiteImageOcrUnsafeBoxesFailClosed`. Configure `makeProtectedSiteOcrRuntime()` with a 12-line OCR string, one low-confidence word box, and one medium-confidence containing line box. Use `installProtectedSiteImageRedactor()` and assert:

```js
assert.strictEqual(redactorCalls.length, 1);
assert.strictEqual(result.status, "ready");
assert.strictEqual(result.safeForUpload, true);
assert.strictEqual(result.outputKind, "redacted_image_file");
assert.match(result.outputName, /\.redacted\.png$/);
assert.strictEqual(result.fileOnlyUpload, true);
assert.strictEqual(result.sanitizedText, "");
assert.strictEqual(JSON.stringify(result).includes(rawSecret), false);
assert.strictEqual(redactorCalls[0].boxes.length, 1);
assert.strictEqual(redactorCalls[0].boxes[0].boxKind, "line");
```

- [ ] **Step 2: Add genuine-low-confidence integration assertion**

Extend the existing unsafe-box test with a low-confidence containing line and keep these assertions:

```js
assert.strictEqual(redactorCalls.length, 0);
assert.strictEqual(result.status, "blocked");
assert.strictEqual(result.safeForUpload, false);
assert.strictEqual(result.sanitizedFile, null);
assert.strictEqual(result.fallbackReason, "ocr_box_confidence_too_low");
```

- [ ] **Step 3: Add a real multiline browser fixture**

Add an exported fixture to `tests/e2e/helpers/e2eFileFixtures.mjs` using the existing Sharp SVG pattern:

```js
export async function multilineImageFixture() {
  const secret = "sk-proj-LGQAMultilineImageKey1234567890abcdef";
  const lines = Array.from({ length: 12 }, (_, index) =>
    index === 7 ? `API_KEY=${secret}` : `SAFE_LINE_${index + 1}=visible test content`
  );
  const svgLines = lines
    .map((line, index) => `<text x="40" y="${80 + (index * 68)}" font-family="Arial" font-size="44" fill="black">${line}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900"><rect width="100%" height="100%" fill="white"/>${svgLines}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return payload("lgqa-multiline-image-secret.png", "image/png", buffer, {
    secret,
    text: lines.join("\n"),
    expectedOutputName: "lgqa-multiline-image-secret.redacted.png"
  });
}
```

- [ ] **Step 4: Add a WhatsApp test that requires sanitized success**

Import `multilineImageFixture` in `tests/e2e/whatsapp_reproduction.spec.mjs`. Add an `@images` test after the existing attach-button PNG test. Unlike the older safety tests, this test must not accept fail-closed as success:

```js
test("@images readable multiline image produces sanitized WhatsApp preview", async ({ extensionApp }) => {
  test.setTimeout(180000);
  const page = await extensionApp.openProtectedFixture("whatsapp");
  const file = await multilineImageFixture();

  await uploadWhatsAppAttachFile(page, file);
  await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized, {
    timeout: 120000
  }).toBe(true);

  const preview = await getWhatsAppPreviewState(page);
  expect(preview.rawPreviewSeen).toBe(false);
  expect(preview.rawPreviewBeforeSanitized).toBe(false);
  expect(preview.files).toEqual([
    expect.objectContaining({ name: file.expectedOutputName, type: "image/png", sanitized: true })
  ]);
  await expectNoRawSecretVisible(page, file.secret);
});
```

- [ ] **Step 5: Run focused integration and browser tests**

Run:

```powershell
node tests/content_file_extraction_pipeline.test.js
npx playwright test --config=playwright.e2e.config.mjs tests/e2e/whatsapp_reproduction.spec.mjs --grep "readable multiline image"
```

Expected: both PASS. The browser test must observe a sanitized preview, not a block. If recovery fails, correct the layout propagation or mapping code; do not loosen the test assertion or confidence threshold.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- tests/content_file_extraction_pipeline.test.js tests/e2e/helpers/e2eFileFixtures.mjs tests/e2e/whatsapp_reproduction.spec.mjs
git diff --cached --check
git commit -m "test: cover protected multiline image recovery"
```

---

### Task 4: Chrome validation and release evidence

**Files:**
- Modify only if test evidence requires a narrowly scoped correction to files already listed above.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a clean Chrome build and regression evidence for OCR safety, protected image handoff, WhatsApp preview safety, and no duplicate upload.

- [ ] **Step 1: Run focused and changed-file validation**

```powershell
node tests/scanner_ocr.test.js
node tests/content_file_extraction_pipeline.test.js
node tests/file_input_change_orchestration.test.js
npm run test:changed
```

Expected: every command exits `0`.

- [ ] **Step 2: Build Chrome and run WhatsApp image E2E**

```powershell
npm run build:chrome
npx playwright test --config=playwright.e2e.config.mjs tests/e2e/whatsapp_reproduction.spec.mjs --grep "@images"
```

Expected: Chrome build exits `0`; all WhatsApp image tests pass with no raw preview, raw upload, text fallback, or duplicate handoff. Allow up to 20 minutes for the browser suite based on prior observed runtime.

- [ ] **Step 3: Run full image E2E because shared OCR runtime changed**

```powershell
npm run test:e2e:images
```

Expected: all image-tagged tests pass. Do not run Firefox build or Firefox tests.

- [ ] **Step 4: Run final static and Git checks**

```powershell
node --check src/shared/scannerOcr.js
node --check src/shared/ocr/ocrWorker.js
node --check src/shared/ocr/ocrRuntime.js
git diff --check
git status --short
```

Expected: syntax checks and diff check pass; status contains only intentional files, or is clean after commits.

- [ ] **Step 5: Commit any validation-driven correction separately**

Only when a test exposed a defect in the already-approved scope:

```powershell
git add -- src/shared/scannerOcr.js src/shared/ocr/ocrWorker.js src/shared/ocr/ocrRuntime.js tests/scanner_ocr.test.js tests/content_file_extraction_pipeline.test.js
git diff --cached --check
git commit -m "fix: correct multiline OCR recovery regression"
```

Do not create an empty commit when no correction was necessary.

- [ ] **Step 6: Prepare live QA handoff**

Rebuild `dist/chrome`, leave the Git worktree clean, and report the exact branch, commits, changed source/tests, test counts, remaining live WhatsApp check, risks, and rollback command. The user reloads the unpacked Chrome extension and tests a clean 10–30 line synthetic screenshot plus a genuinely low-confidence image.
