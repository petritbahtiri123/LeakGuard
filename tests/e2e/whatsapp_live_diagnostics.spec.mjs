import { test, expect } from "@playwright/test";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchExtensionContext } from "./helpers/extensionFixture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const artifactRoot = path.join(repoRoot, "test-results", "whatsapp-live-diagnostics");
const liveDiagEnabled = process.env.LEAKGUARD_LIVE_WHATSAPP_DIAG === "1";
const liveWaitMs = Math.max(15000, Number(process.env.LEAKGUARD_LIVE_WHATSAPP_WAIT_MS) || 240000);
const fakeRawValues = [
  "sk-proj-LGQAWALiveDiagFakeKey1234567890",
  "LGQA_WA_LIVE_FAKE_PASS_1234567890"
];
const liveInput = [
  "LGQA_WA_LIVE_DIAG_BLOCK_20260628",
  `LGQA_OPENAI_API_KEY=${fakeRawValues[0]}`,
  `LGQA_DB_URL=postgres://lgqa:${fakeRawValues[1]}@db.example.com:5432/lgqa`
].join("\n");
const expectedSanitized = [
  "LGQA_WA_LIVE_DIAG_BLOCK_20260628",
  "LGQA_OPENAI_API_KEY=[PWM_1]",
  "LGQA_DB_URL=postgres://lgqa:[PWM_2]@db.example.com:5432/lgqa"
].join("\n");

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeArtifact(name, payload) {
  await fsp.mkdir(artifactRoot, { recursive: true });
  const targetPath = path.join(artifactRoot, `${timestampSlug()}-${name}.json`);
  await fsp.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return targetPath;
}

test.describe("@live @whatsapp manual WhatsApp Web diagnostics", () => {
  test.skip(!liveDiagEnabled, "Set LEAKGUARD_LIVE_WHATSAPP_DIAG=1 to run the manual live WhatsApp diagnostic.");

  test("captures live composer rewrite evidence with LGQA fake data only", async () => {
    test.setTimeout(liveWaitMs + 90000);

    const runtimeDir = await fsp.mkdtemp(path.join(os.tmpdir(), "leakguard-whatsapp-live-diag-"));
    const profileDir = process.env.LEAKGUARD_LIVE_WHATSAPP_PROFILE_DIR || path.join(runtimeDir, "profile");
    const launched = await launchExtensionContext({
      runtimeDir,
      profileDir,
      headless: false,
      routeWhatsAppFixture: false
    });

    const artifact = {
      enabledBy: "LEAKGUARD_LIVE_WHATSAPP_DIAG",
      host: "web.whatsapp.com",
      privacy: "LGQA fake markers only; non-LGQA text is redacted or summarized.",
      inputLength: liveInput.length,
      expectedSanitizedLength: expectedSanitized.length,
      fakeRawValueCount: fakeRawValues.length,
      startedAt: new Date().toISOString()
    };

    try {
      const page = await launched.context.newPage();
      await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        window.__LGQA_WHATSAPP_LIVE_DIAG__ = null;
      });

      const composerHandle = await page.waitForFunction(
        () => {
          const selectors = [
            "footer [contenteditable='true'][role='textbox']",
            "[data-lexical-editor='true'][contenteditable='true'][role='textbox']",
            "[contenteditable='true'][role='textbox'][aria-label]",
            "[contenteditable='true'][role='textbox']",
            "footer [contenteditable='true']"
          ];
          return selectors.some((selector) => document.querySelector(selector));
        },
        null,
        { timeout: liveWaitMs }
      );
      await composerHandle.dispose();

      await page.evaluate(({ fakeValues }) => {
        const selectors = [
          "footer [contenteditable='true'][role='textbox']",
          "[data-lexical-editor='true'][contenteditable='true'][role='textbox']",
          "[contenteditable='true'][role='textbox'][aria-label]",
          "[contenteditable='true'][role='textbox']",
          "footer [contenteditable='true']"
        ];
        const normalize = (value) => String(value || "")
          .replace(/\r\n?/g, "\n")
          .replace(/\u00a0/g, " ")
          .replace(/[\u200B-\u200D\uFEFF]/g, "");
        const redactFakeValues = (value) => {
          let next = normalize(value);
          fakeValues.forEach((fake, index) => {
            next = next.split(fake).join(`[LGQA_FAKE_VALUE_${index + 1}]`);
          });
          return next;
        };
        const safeText = (value, limit = 800) => {
          const text = redactFakeValues(value);
          const lines = text.split("\n").map((line) => {
            if (!line.trim()) return "";
            if (line.includes("LGQA_") || /\[(?:PWM|NET|PUB_HOST)_\d+\]/.test(line)) {
              return line.length > limit ? `${line.slice(0, limit)}...[truncated ${line.length - limit}]` : line;
            }
            return `[REDACTED_NON_LGQA_TEXT length=${line.length}]`;
          });
          return lines.join("\n");
        };
        const safeHtml = (value) => safeText(String(value || "").replace(/<[^>]*>/g, (tag) => {
          const safeTag = tag.replace(/\s(?:id|class|style|data-pre-plain-text|title|aria-description)="[^"]*"/g, "");
          return safeTag.length > 160 ? `${safeTag.slice(0, 160)}...[tag-truncated]` : safeTag;
        }), 1200);
        const elementPath = (node) => {
          const parts = [];
          let current = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
          while (current && parts.length < 8) {
            const tag = String(current.tagName || "").toLowerCase();
            const role = current.getAttribute?.("role");
            const testId = current.getAttribute?.("data-testid");
            const editable = current.getAttribute?.("contenteditable");
            const suffix = [
              role ? `[role="${role}"]` : "",
              testId ? `[data-testid="${testId}"]` : "",
              editable ? `[contenteditable="${editable}"]` : ""
            ].join("");
            parts.unshift(`${tag}${suffix}`);
            current = current.parentElement;
          }
          return parts.join(" > ");
        };
        const resolveComposer = () => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return { selector, element };
          }
          return { selector: "", element: null };
        };
        const dataAttributes = (element) => Object.fromEntries(
          Array.from(element?.attributes || [])
            .filter((attribute) => attribute.name.startsWith("data-"))
            .map((attribute) => [attribute.name, String(attribute.value || "").slice(0, 80)])
        );
        const classSummary = (element) => String(element?.className || "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 8);
        const childTree = (node, depth = 0) => {
          if (!node || depth > 4) return null;
          if (node.nodeType === Node.TEXT_NODE) {
            const text = safeText(node.nodeValue || "", 120);
            return { type: "text", length: normalize(node.nodeValue || "").length, text };
          }
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return { type: `node-${node.nodeType}` };
          }
          return {
            type: "element",
            tagName: node.tagName,
            role: node.getAttribute?.("role") || "",
            contenteditable: node.getAttribute?.("contenteditable") || "",
            dataAttributes: dataAttributes(node),
            childCount: node.childNodes?.length || 0,
            children: Array.from(node.childNodes || []).slice(0, 10).map((child) => childTree(child, depth + 1))
          };
        };
        const selectionState = (composer) => {
          const selection = window.getSelection?.();
          if (!selection || !selection.rangeCount) return { rangeCount: 0, insideComposer: false };
          const range = selection.getRangeAt(0);
          return {
            rangeCount: selection.rangeCount,
            collapsed: selection.isCollapsed,
            anchorPath: elementPath(selection.anchorNode),
            focusPath: elementPath(selection.focusNode),
            anchorOffset: selection.anchorOffset,
            focusOffset: selection.focusOffset,
            insideComposer: Boolean(
              composer &&
                composer.contains(range.startContainer) &&
                composer.contains(range.endContainer)
            )
          };
        };
        const sendButtonState = () => {
          const candidates = Array.from(document.querySelectorAll([
            "[aria-label*='send' i]",
            "[data-testid*='send' i]",
            "button[type='submit']",
            "span[data-icon='send']"
          ].join(",")));
          const button = candidates.find((candidate) => {
            const rect = candidate.getBoundingClientRect?.();
            return rect && rect.width > 0 && rect.height > 0;
          });
          if (!button) return { found: false, enabled: null };
          const hostButton = button.closest?.("button") || button;
          return {
            found: true,
            path: elementPath(hostButton),
            enabled: !hostButton.disabled && hostButton.getAttribute?.("aria-disabled") !== "true"
          };
        };
        const rawText = (element) => normalize(element?.innerText || element?.textContent || "");
        const capture = (label) => {
          const { selector, element } = resolveComposer();
          const text = rawText(element);
          return {
            label,
            at: Date.now(),
            matchedComposer: {
              selector,
              path: elementPath(element)
            },
            activeElementPath: elementPath(document.activeElement),
            attributes: {
              tagName: element?.tagName || "",
              role: element?.getAttribute?.("role") || "",
              contenteditable: element?.getAttribute?.("contenteditable") || "",
              ariaLabel: element?.getAttribute?.("aria-label") || "",
              dataAttributes: dataAttributes(element),
              classNames: classSummary(element)
            },
            dom: {
              innerText: safeText(element?.innerText || ""),
              textContent: safeText(element?.textContent || ""),
              innerHTML: safeHtml(element?.innerHTML || ""),
              childTree: childTree(element)
            },
            normalizedText: safeText(text),
            rawLength: text.length,
            visualEmpty: !text.trim(),
            selection: selectionState(element),
            sendButton: sendButtonState()
          };
        };
        const countInBody = (needle) => {
          const body = normalize(document.body?.innerText || "");
          return needle ? body.split(needle).length - 1 : 0;
        };

        window.__LGQA_WHATSAPP_LIVE_DIAG__ = {
          selectors,
          resolveComposer,
          capture,
          samples: [],
          startSampling(intervalMs = 75, durationMs = 1800) {
            const startedAt = Date.now();
            this.samples = [];
            const tick = () => {
              this.samples.push(capture("settle-sample"));
              if (Date.now() - startedAt < durationMs) {
                window.setTimeout(tick, intervalMs);
              }
            };
            tick();
          },
          summarizeResult(expectedText, fakeValuesForResult) {
            const { element } = resolveComposer();
            const actual = rawText(element);
            const samples = this.samples || [];
            const sanitizedActual = safeText(actual);
            const sanitizedExpected = safeText(expectedText);
            const fakeCounts = fakeValuesForResult.map((value) => ({
              value: safeText(value),
              composerCount: actual.split(value).length - 1,
              bodyCount: countInBody(value)
            }));
            return {
              beforeReplaySend: {
                normalizedComposerText: sanitizedActual,
                expectedSanitizedText: sanitizedExpected,
                exactMatch: normalize(actual) === normalize(expectedText),
                diff: normalize(actual) === normalize(expectedText)
                  ? null
                  : {
                      actualLength: actual.length,
                      expectedLength: normalize(expectedText).length,
                      actualPreview: sanitizedActual,
                      expectedPreview: sanitizedExpected
                    }
              },
              afterResult: {
                fakeRawValueCounts: fakeCounts,
                markerBodyCount: countInBody("LGQA_WA_LIVE_DIAG_BLOCK_20260628"),
                duplicateBlockLikely: countInBody("LGQA_WA_LIVE_DIAG_BLOCK_20260628") > 1
              },
              samples,
              staleOldTextReappeared: samples.some((sample) =>
                fakeValuesForResult.some((value) => String(sample.normalizedText || "").includes(safeText(value)))
              ),
              sanitizedTextDuplicated: samples.some((sample) => {
                const text = String(sample.normalizedText || "");
                return (text.match(/LGQA_OPENAI_API_KEY=/g) || []).length > 1 ||
                  (text.match(/\[PWM_\d+\]/g) || []).length > 2;
              })
            };
          }
        };
      }, { fakeValues: fakeRawValues });

      artifact.initial = await page.evaluate(() => window.__LGQA_WHATSAPP_LIVE_DIAG__.capture("initial"));
      if (artifact.initial.rawLength > 0 && !String(artifact.initial.normalizedText || "").includes("LGQA_")) {
        artifact.aborted = "Composer contained non-LGQA text before diagnostic input; clear the safe test chat composer and rerun.";
        artifact.path = await writeArtifact("aborted", artifact);
        expect(artifact.aborted).toBe("");
        return;
      }

      const composer = page.locator("footer [contenteditable='true'][role='textbox'], [data-lexical-editor='true'][contenteditable='true'][role='textbox'], [contenteditable='true'][role='textbox']").first();
      await composer.click();
      await composer.fill(liveInput);
      await composer.focus();

      artifact.beforeRewrite = await page.evaluate(() => window.__LGQA_WHATSAPP_LIVE_DIAG__.capture("before-rewrite"));
      await page.evaluate(() => window.__LGQA_WHATSAPP_LIVE_DIAG__.startSampling(75, 2200));
      const sendButton = page.locator("[aria-label*='send' i], [data-testid*='send' i], button[type='submit'], span[data-icon='send']").last();
      await sendButton.click();
      await page.waitForTimeout(2400);
      artifact.afterSettle = await page.evaluate(({ expected, fakeValues }) => {
        const diag = window.__LGQA_WHATSAPP_LIVE_DIAG__;
        return {
          current: diag.capture("after-settle"),
          result: diag.summarizeResult(expected, fakeValues)
        };
      }, { expected: expectedSanitized, fakeValues: fakeRawValues });
      artifact.completedAt = new Date().toISOString();
      artifact.path = await writeArtifact("diagnostic", artifact);

      expect(artifact.path).toContain("whatsapp-live-diagnostics");
    } finally {
      await launched.close();
      if (!process.env.LEAKGUARD_LIVE_WHATSAPP_PROFILE_DIR) {
        await fsp.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
});
