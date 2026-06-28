import assert from "node:assert";
import { shouldAbortForInitialComposer } from "./e2e/helpers/whatsappLiveDiagnostics.mjs";

assert.strictEqual(
  shouldAbortForInitialComposer({
    rawLength: 1,
    visualEmpty: true,
    normalizedText: "\n"
  }),
  false,
  "WhatsApp's newline-only empty composer scaffolding should not abort diagnostics"
);

assert.strictEqual(
  shouldAbortForInitialComposer({
    rawLength: 11,
    visualEmpty: false,
    normalizedText: "[REDACTED_NON_LGQA_TEXT length=11]"
  }),
  true,
  "non-LGQA draft text should still abort diagnostics"
);

assert.strictEqual(
  shouldAbortForInitialComposer({
    rawLength: 40,
    visualEmpty: false,
    normalizedText: "LGQA_WA_LIVE_DIAG_BLOCK_20260628"
  }),
  false,
  "LGQA diagnostic leftovers may be reused by the live diagnostic"
);

assert.strictEqual(
  shouldAbortForInitialComposer({
    rawLength: 52,
    visualEmpty: false,
    normalizedText: "LGQA_WA_LIVE_DIAG_BLOCK_20260628\n[REDACTED_NON_LGQA_TEXT length=11]"
  }),
  true,
  "mixed LGQA and non-LGQA draft text should still abort diagnostics"
);
