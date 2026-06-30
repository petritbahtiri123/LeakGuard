import {
  clickSend,
  expect,
  expectBlocked,
  expectComposerTextExactly,
  expectNoFileEvents,
  expectNoDoubleSend,
  getFileEvents,
  getWhatsAppPreviewState,
  expectNoRawSecretVisible,
  getSentMessages,
  getComposerText,
  pressEnterToSend,
  pasteImageFromClipboard,
  pasteImageFromSystemClipboard,
  pressShiftEnter,
  test,
  typeIntoComposer,
  uploadWhatsAppAttachFile
} from "./helpers/extensionFixture.mjs";
import { imageFixture, malformedImageFixture } from "./helpers/e2eFileFixtures.mjs";

const whatsappInput = [
  "LGQA_WA_DUPLICATE_1",
  "BACKUP_OPENAI_API_KEY=sk-proj-LGQAFakeBackupKey1234567890",
  "ANTHROPIC_API_KEY=sk-ant-LGQAFakeAnthropicKey1234567890",
  "GITHUB_TOKEN=ghp_LGQAFakeGithubToken1234567890",
  "DATABASE_URL=postgres://admin:FakePass123@db.example.com:5432/customerdb"
].join("\n");

const expectedSanitized = [
  "LGQA_WA_DUPLICATE_1",
  "BACKUP_OPENAI_API_KEY=[PWM_1]",
  "ANTHROPIC_API_KEY=[PWM_2]",
  "GITHUB_TOKEN=[PWM_3]",
  "DATABASE_URL=postgres://admin:[PWM_4]@db.example.com:5432/customerdb"
].join("\n");

const rawSecrets = [
  "sk-proj-LGQAFakeBackupKey1234567890",
  "sk-ant-LGQAFakeAnthropicKey1234567890",
  "ghp_LGQAFakeGithubToken1234567890",
  "FakePass123"
];

const multilineInput = [
  "LGQA_WA_MULTILINE",
  "my password is LGQA_WA_MULTILINE_FakePassword123456789!",
  "my backup password is LGQA_WA_MULTILINE_SecondFakePassword123456789!"
].join("\n");

const multilineExpected = [
  "LGQA_WA_MULTILINE",
  "my password is [PWM_1]",
  "my backup password is [PWM_2]"
].join("\n");

function countOccurrences(text, needle) {
  return String(text || "").split(needle).length - 1;
}

async function getFixtureState(page) {
  return await page.evaluate(() => ({ ...window.__leakguardE2E.state }));
}

test.describe("@whatsapp @text WhatsApp-like reproduction contract", () => {
  test("current fail-closed guard never sends raw fake secrets", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);
    await page.waitForTimeout(750);

    const messages = await getSentMessages(page);
    for (const message of messages) {
      for (const secret of rawSecrets) {
        expect(message).not.toContain(secret);
      }
    }
    expect(messages.length, "WhatsApp reproduction must not double-send").toBeLessThanOrEqual(1);
  });

  test("expected sanitized exact-once rewrite and send contract", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    const [sentText] = await getSentMessages(page);
    expect(countOccurrences(sentText, expectedSanitized), "sanitized block should appear exactly once").toBe(1);
    for (const label of [
      "BACKUP_OPENAI_API_KEY=",
      "ANTHROPIC_API_KEY=",
      "GITHUB_TOKEN=",
      "DATABASE_URL="
    ]) {
      expect(countOccurrences(sentText, label), `${label} should not be duplicated`).toBe(1);
    }

    for (const secret of rawSecrets) {
      expect(sentText).not.toContain(secret);
    }

    await expectComposerTextExactly(page, "");
    const messagesBeforeRetry = await getSentMessages(page);
    await clickSend(page);
    await expect.poll(() => getSentMessages(page)).toEqual(messagesBeforeRetry);
  });

  test("Enter-send redacts exactly once", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await pressEnterToSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    await expectNoDoubleSend(page, "LGQA_WA_DUPLICATE_1");
    await expectComposerTextExactly(page, "");
  });

  test("multiline block redacts exactly once", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, multilineInput);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([multilineExpected]);
    const [sentText] = await getSentMessages(page);
    expect(countOccurrences(sentText, "LGQA_WA_MULTILINE"), "multiline block should not duplicate").toBe(1);
    expect(countOccurrences(sentText, "[PWM_1]"), "first placeholder should appear once").toBe(1);
    expect(countOccurrences(sentText, "[PWM_2]"), "second placeholder should appear once").toBe(1);
    await expectNoRawSecretVisible(page, "LGQA_WA_MULTILINE_FakePassword123456789!");
    await expectNoRawSecretVisible(page, "LGQA_WA_MULTILINE_SecondFakePassword123456789!");
  });

  test("clear step syncs empty before sanitized insert", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    await expect.poll(async () => {
      const state = await getFixtureState(page);
      return {
        clearAccepted: state.whatsappClearAccepted,
        clearRejected: state.whatsappClearRejected,
        staleResurrections: state.whatsappStaleResurrections,
        duplicateSanitizedWrites: state.whatsappDuplicateSanitizedWrites
      };
    }).toEqual({
      clearAccepted: true,
      clearRejected: false,
      staleResurrections: 0,
      duplicateSanitizedWrites: 0
    });
  });

  test("stale raw text cannot reappear after async settle", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    await page.waitForTimeout(750);
    for (const secret of rawSecrets) {
      await expectNoRawSecretVisible(page, secret);
    }
    await expectComposerTextExactly(page, "");
  });

  test("already-redacted placeholders do not redetect", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const text = "LGQA_WA_PLACEHOLDERS already redacted [PWM_1] and [PWM_2]";

    await typeIntoComposer(page, text);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([text]);
    await expectNoDoubleSend(page, "LGQA_WA_PLACEHOLDERS");
  });

  test("Shift+Enter creates newline and does not send", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, "LGQA_WA_SHIFT line one");
    await pressShiftEnter(page);
    await page.locator("[data-testid='prompt-textarea']:visible").first().pressSequentially("line two");

    await expect.poll(() => getComposerText(page)).toBe("LGQA_WA_SHIFT line one\nline two");
    await expect.poll(() => getSentMessages(page)).toEqual([]);
  });

  test("programmatic replay does not recurse", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    await page.waitForTimeout(500);
    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
  });

  test("second-click retry is not accepted", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await typeIntoComposer(page, whatsappInput);
    await clickSend(page);
    await clickSend(page);

    await expect.poll(() => getSentMessages(page)).toEqual([expectedSanitized]);
    await expectComposerTextExactly(page, "");
  });

  test("@images clipboard image paste redacts or fails closed", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await pasteImageFromClipboard(page, file);

    await expect.poll(async () => {
      const events = await getFileEvents(page);
      const body = await page.evaluate(() => {
        const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
          .map((element) => element.innerText || element.textContent || "")
          .join("\n");
        return `${document.body.innerText || ""}\n${modalText}`;
      });
      return events.some((event) =>
        event.source === "paste" &&
        event.name === file.expectedOutputName &&
        event.type === "image/png"
      ) || /Raw image upload blocked/i.test(body);
    }, { timeout: 90000 }).toBe(true);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive raw clipboard image").toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "WhatsApp clipboard raw preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "Clipboard raw preview must not appear before sanitized handoff").toBe(false);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@images keyboard clipboard image paste redacts or fails closed", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await pasteImageFromSystemClipboard(page, file);

    await expect.poll(async () => {
      const events = await getFileEvents(page);
      const body = await page.evaluate(() => {
        const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
          .map((element) => element.innerText || element.textContent || "")
          .join("\n");
        return `${document.body.innerText || ""}\n${modalText}`;
      });
      return events.some((event) =>
        event.source === "paste" &&
        event.name === file.expectedOutputName &&
        event.type === "image/png"
      ) || /Raw image upload blocked/i.test(body);
    }, { timeout: 90000 }).toBe(true);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive raw keyboard clipboard image").toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "WhatsApp keyboard clipboard raw preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "Keyboard clipboard raw preview must not appear before sanitized handoff").toBe(false);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files @images attach-button PNG image redacts or fails closed without raw preview", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await uploadWhatsAppAttachFile(page, file);

    await expect.poll(async () => {
      const preview = await getWhatsAppPreviewState(page);
      const events = await getFileEvents(page);
      const body = await page.evaluate(() => {
        const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
          .map((element) => element.innerText || element.textContent || "")
          .join("\n");
        return `${document.body.innerText || ""}\n${modalText}`;
      });
      return Boolean(
        preview?.sanitized ||
          events.some((event) =>
            event.source === "input" &&
            event.name === file.expectedOutputName &&
            event.type === "image/png"
          ) ||
          /Raw image upload blocked/i.test(body)
      );
    }, { timeout: 90000 }).toBe(true);

    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "WhatsApp raw preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "Raw preview must not appear before sanitized handoff").toBe(false);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive the raw attach image").toBe(true);
    if (preview?.sanitized) {
      expect(preview.files).toEqual([
        expect.objectContaining({ name: file.expectedOutputName, type: "image/png", sanitized: true })
      ]);
    } else {
      await expectBlocked(page, /Raw image upload blocked/i);
      await expectNoFileEvents(page);
    }
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files @images attach-button OCR failure blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = malformedImageFixture();

    await uploadWhatsAppAttachFile(page, file);

    await expectBlocked(page, /Raw image upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "blocked OCR failure must not open a preview").toBe(false);
    expect(preview?.rawPreviewSeen, "blocked OCR failure must not show raw preview").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files @images attach-button unsupported type blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = {
      name: "lgqa-whatsapp-unsupported.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("GIF89a unsupported image bytes")
    };

    await uploadWhatsAppAttachFile(page, file);

    await expectBlocked(page, /WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "unsupported attach must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "unsupported attach must not show raw preview").toBe(false);
    await expectNoFileEvents(page);
  });

  test("@files @images attach-button multi-file blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const first = await imageFixture("png");
    const second = await imageFixture("jpg");

    await uploadWhatsAppAttachFile(page, [first, second]);

    await expectBlocked(page, /WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "multi-file attach must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "multi-file attach must not show raw preview").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, first.secret);
    await expectNoRawSecretVisible(page, second.secret);
  });
});
