import {
  clickSend,
  expect,
  expectBlocked,
  expectComposerTextExactly,
  expectNoFileEvents,
  expectNoDoubleSend,
  expectNoUnsafeOriginalFilename,
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
  uploadWhatsAppAttachFile,
  dragDropWhatsAppFile
} from "./helpers/extensionFixture.mjs";
import {
  imageFixture,
  encryptedPdfFixture,
  imageOnlyPdfFixture,
  malformedDocxFixture,
  malformedPdfFixture,
  malformedImageFixture,
  multiFileFixtureSet,
  sixLargeFileBlockedSet,
  textFileFixtures,
  documentFileFixtures,
  unsupportedFileFixture
} from "./helpers/e2eFileFixtures.mjs";

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

async function dispatchWhatsAppPasteThenBeforeInput(page, text) {
  await page.locator("[data-testid='prompt-textarea']:visible").first().focus();
  await page.evaluate((value) => {
    const composer = window.__leakguardE2E.activeComposer();
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    composer.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    }));

    window.setTimeout(() => {
      composer.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertFromPaste",
        data: value
      }));
    }, 50);
  }, text);
}

async function waitForWhatsAppSanitizedDocument(page, file, options = {}) {
  const expectedName = file.expectedOutputName || file.name;
  const expectedSource = options.source || "input";
  await expect.poll(async () => {
    const preview = await getWhatsAppPreviewState(page);
    const events = await getFileEvents(page);
    const modalText = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
        .map((element) => element.innerText || element.textContent || "")
        .join("\n")
    );
    return Boolean(
      preview?.sanitized === true ||
        events.some((event) =>
          event.source === expectedSource &&
          event.name === expectedName &&
          String(event.text || "").includes("[PWM_") &&
          !String(event.text || "").includes(file.secret)
        ) ||
        /Raw file upload blocked|WhatsApp file upload blocked/i.test(modalText)
    );
  }, { timeout: 30000 }).toBe(true);
}

function expectSanitizedDocumentEvent(events, file, options = {}) {
  const expectedName = file.expectedOutputName || file.name;
  const expectedSource = options.source || "input";
  const matching = events.filter((event) => event.source === expectedSource && event.name === expectedName);
  expect(matching.length, `${expectedName} should be assigned to WhatsApp only after sanitization`).toBeGreaterThan(0);
  for (const event of matching) {
    expect(event.text, `${expectedName} assigned text should not be raw`).not.toBe(file.text);
    expect(event.text, `${expectedName} assigned text should contain placeholders`).toContain("[PWM_");
    expect(event.text, `${expectedName} assigned text should not contain the fixture secret`).not.toContain(file.secret);
    expect(event.text, `${expectedName} assigned text should not contain database password`).not.toContain("FakePass123");
  }
}

test.describe("@whatsapp @text WhatsApp-like reproduction contract", () => {
  test.setTimeout(130000);

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

  test("paired paste and beforeinput text events redact once without false modal", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");

    await dispatchWhatsAppPasteThenBeforeInput(page, whatsappInput);

    await expect.poll(async () => (await getComposerText(page)).trim()).toBe(expectedSanitized);
    const modalText = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
        .map((node) => node.textContent || "")
        .join("\n")
    );
    expect(modalText).not.toMatch(/Rewrite verification failed/i);
    for (const secret of rawSecrets) {
      await expectNoRawSecretVisible(page, secret);
    }
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

  test("@files @images sanitized image preview send does not show text rewrite failure", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await uploadWhatsAppAttachFile(page, file);
    await expect.poll(async () => {
      const preview = await getWhatsAppPreviewState(page);
      const body = await page.evaluate(() => {
        const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
          .map((element) => element.innerText || element.textContent || "")
          .join("\n");
        return `${document.body.innerText || ""}\n${modalText}`;
      });
      return preview?.sanitized === true || /Raw image upload blocked/i.test(body);
    }, { timeout: 90000 }).toBe(true);

    const initialPreview = await getWhatsAppPreviewState(page);
    expect(initialPreview?.rawPreviewSeen, "sanitized image preview send setup must not show raw preview").toBe(false);
    if (!initialPreview?.sanitized) {
      await expectBlocked(page, /Raw image upload blocked/i);
      await expectNoFileEvents(page);
      await expectNoRawSecretVisible(page, file.secret);
      return;
    }

    await typeIntoComposer(page, "API_KEY=[PWM_1]");
    await page.locator("#whatsapp-preview-send-button").click();

    await expect.poll(async () => {
      const preview = await getWhatsAppPreviewState(page);
      return preview?.sent === true;
    }, { timeout: 15000 }).toBe(true);
    const body = await page.evaluate(() => {
      const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
        .map((element) => element.innerText || element.textContent || "")
        .join("\n");
      return `${document.body.innerText || ""}\n${modalText}`;
    });
    expect(body).not.toMatch(/Rewrite verification failed/i);
    expect(await getSentMessages(page)).toEqual([]);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "sanitized image preview send must not show raw preview").toBe(false);
    await expectNoRawSecretVisible(page, file.secret);
  });

  for (const file of textFileFixtures) {
    test(`@files text document attach-button redacts ${file.name} Phase 5A canonical file`, async ({ extensionApp }) => {
      test.setTimeout(90000);
      const page = await extensionApp.openProtectedFixture("whatsapp");

      await uploadWhatsAppAttachFile(page, file);
      await waitForWhatsAppSanitizedDocument(page, file);

      const preview = await getWhatsAppPreviewState(page);
      expect(preview?.rawPreviewSeen, `${file.name} raw preview must never appear`).toBe(false);
      expect(preview?.rawPreviewBeforeSanitized, `${file.name} raw preview must not appear first`).toBe(false);
      const events = await getFileEvents(page);
      expect(
        events.every((event) => String(event.text || "") !== file.text),
        `${file.name} raw file text must not be assigned`
      ).toBe(true);
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
      await page.locator("#whatsapp-preview-send-button").click();
      await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sent === true).toBe(true);
    });
  }

  test("@files PDF document attach-button redacts rebuilt PDF Phase 3B file", async ({ extensionApp }) => {
    test.setTimeout(120000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = documentFileFixtures.find((fixture) => fixture.name.endsWith(".pdf"));

    await uploadWhatsAppAttachFile(page, file);
    await waitForWhatsAppSanitizedDocument(page, file);

    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "raw PDF preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "raw PDF preview must not appear first").toBe(false);
    expect(preview?.files).toEqual([
      expect.objectContaining({ name: file.expectedOutputName, type: "application/pdf", sanitized: true })
    ]);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive the raw PDF object").toBe(true);
    expect(events.every((event) => String(event.text || "") !== file.text), "raw PDF text must not be assigned").toBe(true);
    expectSanitizedDocumentEvent(events, file);
    await expectNoRawSecretVisible(page, file.secret);
    await page.locator("#whatsapp-preview-send-button").click();
    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sent === true).toBe(true);
  });

  test("@files DOCX document attach-button redacts rebuilt DOCX Phase 3C file", async ({ extensionApp }) => {
    test.setTimeout(120000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = documentFileFixtures.find((fixture) => fixture.name.endsWith(".docx"));

    await uploadWhatsAppAttachFile(page, file);
    await waitForWhatsAppSanitizedDocument(page, file);

    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "raw DOCX preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "raw DOCX preview must not appear first").toBe(false);
    expect(preview?.files).toEqual([
      expect.objectContaining({
        name: file.expectedOutputName,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sanitized: true
      })
    ]);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive the raw DOCX object").toBe(true);
    expect(events.every((event) => String(event.text || "") !== file.text), "raw DOCX text must not be assigned").toBe(true);
    expectSanitizedDocumentEvent(events, file);
    await expectNoRawSecretVisible(page, file.secret);
    await page.locator("#whatsapp-preview-send-button").click();
    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sent === true).toBe(true);
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

  test("@files text document attach-button unsupported extensionless names block without filename leak", async ({ extensionApp }) => {
    for (const file of [
      unsupportedFileFixture({
        name: "lgqa-whatsapp-extensionless-sk-proj-UnsafeName1234567890",
        mimeType: "text/plain"
      }),
      unsupportedFileFixture({
        name: "lgqa-whatsapp-mime-only-sk-proj-UnsafeName1234567890",
        mimeType: "text/yaml"
      })
    ]) {
      const page = await extensionApp.openProtectedFixture("whatsapp");

      await uploadWhatsAppAttachFile(page, file);

      await expectBlocked(page, /WhatsApp file upload blocked/i);
      const preview = await getWhatsAppPreviewState(page);
      expect(preview?.visible, `${file.name} must not open preview`).toBe(false);
      expect(preview?.rawPreviewSeen, `${file.name} raw preview must not show`).toBe(false);
      await expectNoFileEvents(page);
      await expectNoUnsafeOriginalFilename(page, file.name);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files document attach-button encrypted malformed image-only PDFs block without preview", async ({ extensionApp }) => {
    for (const file of [encryptedPdfFixture(), malformedPdfFixture(), imageOnlyPdfFixture()]) {
      const page = await extensionApp.openProtectedFixture("whatsapp");

      await uploadWhatsAppAttachFile(page, file);

      await expectBlocked(page, /Raw file blocked|Raw file upload blocked|WhatsApp file upload blocked/i);
      const preview = await getWhatsAppPreviewState(page);
      expect(preview?.visible, `${file.name} must not open preview`).toBe(false);
      expect(preview?.rawPreviewSeen, `${file.name} raw preview must not appear`).toBe(false);
      await expectNoFileEvents(page);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files XLSX document attach-button redacts rebuilt XLSX Phase 3D file", async ({ extensionApp }) => {
    test.setTimeout(120000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = documentFileFixtures.find((fixture) => fixture.name.endsWith(".xlsx"));

    await uploadWhatsAppAttachFile(page, file);
    await waitForWhatsAppSanitizedDocument(page, file);

    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.rawPreviewSeen, "raw XLSX preview must never appear").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "raw XLSX preview must not appear first").toBe(false);
    expect(preview?.files).toEqual([
      expect.objectContaining({
        name: file.expectedOutputName,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sanitized: true
      })
    ]);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive the raw XLSX object").toBe(true);
    expect(events.every((event) => String(event.text || "") !== file.text), "raw XLSX text must not be assigned").toBe(true);
    expectSanitizedDocumentEvent(events, file);
    await expectNoRawSecretVisible(page, file.secret);
    await page.locator("#whatsapp-preview-send-button").click();
    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sent === true).toBe(true);
  });

  test("@files malformed DOCX attach-button blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = malformedDocxFixture();

    await uploadWhatsAppAttachFile(page, file);

    await expectBlocked(page, /Raw file blocked|Raw file upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "malformed DOCX must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "malformed DOCX raw preview must not appear").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files text document multi-file assigns sanitized files in input order", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = [".yaml", ".pem", ".ps1", ".py", ".sql"].map((extension) =>
      textFileFixtures.find((fixture) => fixture.name.endsWith(extension))
    );
    expect(files.every(Boolean), "mixed canonical text fixtures should exist").toBe(true);

    await uploadWhatsAppAttachFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "multi text document attach should open only sanitized preview").toBe(true);
    expect(preview?.rawPreviewSeen, "multi text document raw preview must not show").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "multi text document raw preview must not appear first").toBe(false);
    expect(preview?.files).toEqual(
      files.map((file) =>
        expect.objectContaining({
          name: file.name,
          type: file.mimeType,
          sanitized: true
        })
      )
    );
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "multi text document output order must match input order").toEqual([
      ...files.map((file) => file.name)
    ]);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events only").toBe(true);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
    await page.locator("#whatsapp-preview-send-button").click();
    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sent === true).toBe(true);
  });

  test("@files text document multi-file Dockerfile and Makefile assign sanitized files", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = ["Dockerfile", "Makefile"].map((name) =>
      textFileFixtures.find((fixture) => fixture.name === name)
    );
    expect(files.every(Boolean), "basename canonical text fixtures should exist").toBe(true);

    await uploadWhatsAppAttachFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "basename text document attach should open only sanitized preview").toBe(true);
    expect(preview?.rawPreviewSeen, "basename text document raw preview must not show").toBe(false);
    expect(preview?.files).toEqual(
      files.map((file) =>
        expect.objectContaining({
          name: file.name,
          type: file.mimeType,
          sanitized: true
        })
      )
    );
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "basename text document output order must match input order").toEqual([
      ...files.map((file) => file.name)
    ]);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files text document 10-file attach assigns sanitized files in input order", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = textFileFixtures.slice(0, 10);
    expect(files.length, "10 canonical text fixtures should exist").toBe(10);

    await uploadWhatsAppAttachFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "10-file WhatsApp attach should open only sanitized preview").toBe(true);
    expect(preview?.rawPreviewSeen, "10-file WhatsApp attach raw preview must not show").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "10-file WhatsApp attach raw preview must not appear first").toBe(false);
    expect(preview?.files).toEqual(
      files.map((file) =>
        expect.objectContaining({
          name: file.name,
          type: file.mimeType,
          sanitized: true
        })
      )
    );
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "10-file attach output order must match input order").toEqual([
      ...files.map((file) => file.name)
    ]);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events only").toBe(true);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop single text document assigns sanitized input handoff", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = textFileFixtures.find((fixture) => fixture.name.endsWith(".yaml"));
    expect(file, "canonical text drop fixture should exist").toBeTruthy();

    await dragDropWhatsAppFile(page, file);
    await waitForWhatsAppSanitizedDocument(page, file);
    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);

    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, `${file.name} drop should open only sanitized preview`).toBe(true);
    expect(preview?.sanitized, `${file.name} drop preview should be sanitized`).toBe(true);
    expect(preview?.rawPreviewSeen, `${file.name} raw drop preview must not show`).toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, `${file.name} raw drop preview must not appear first`).toBe(false);
    expect(preview?.files).toEqual([
      expect.objectContaining({ name: file.name, type: file.mimeType, sanitized: true })
    ]);
    expect(preview?.files?.map((entry) => entry.name)).toEqual([file.name]);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events for drag/drop handoff").toBe(true);
    expect(events.every((event) => String(event.text || "") !== file.text), "raw dropped text must not be assigned").toBe(true);
    expectSanitizedDocumentEvent(events, file);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files drag/drop 2 basename text documents assigns sanitized files in order", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = ["Dockerfile", "Makefile"].map((name) =>
      textFileFixtures.find((fixture) => fixture.name === name)
    );
    expect(files.every(Boolean), "basename drop fixtures should exist").toBe(true);

    await dragDropWhatsAppFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "2-file basename drop should open only sanitized preview").toBe(true);
    expect(preview?.rawPreviewSeen, "2-file basename raw drop preview must not show").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "2-file basename raw drop preview must not appear first").toBe(false);
    expect(preview?.files?.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "2-file drop output order must match input order").toEqual([
      ...files.map((file) => file.name)
    ]);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events for drag/drop handoff").toBe(true);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop 5 mixed supported files assigns sanitized files in order", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = [
      textFileFixtures.find((fixture) => fixture.name.endsWith(".yaml")),
      documentFileFixtures.find((fixture) => fixture.name.endsWith(".pdf")),
      documentFileFixtures.find((fixture) => fixture.name.endsWith(".docx")),
      documentFileFixtures.find((fixture) => fixture.name.endsWith(".xlsx")),
      textFileFixtures.find((fixture) => fixture.name === "Dockerfile")
    ];
    expect(files.every(Boolean), "mixed supported drop fixtures should exist").toBe(true);

    await dragDropWhatsAppFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "mixed supported drop should open only sanitized preview").toBe(true);
    expect(preview?.sanitized, "mixed supported drop preview should be sanitized").toBe(true);
    expect(preview?.rawPreviewSeen, "mixed supported raw drop preview must not show").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "mixed supported raw drop preview must not appear first").toBe(false);
    expect(preview?.files?.map((entry) => entry.name)).toEqual(files.map((file) => file.expectedOutputName || file.name));
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "mixed drop output order must match input order").toEqual([
      ...files.map((file) => file.expectedOutputName || file.name)
    ]);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events for drag/drop handoff").toBe(true);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop 10 supported text documents assigns sanitized files in order", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = textFileFixtures.slice(0, 10);
    expect(files.length, "10 canonical text drop fixtures should exist").toBe(10);

    await dragDropWhatsAppFile(page, files);

    await expect.poll(async () => (await getWhatsAppPreviewState(page))?.sanitized).toBe(true);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "10-file drop should open only sanitized preview").toBe(true);
    expect(preview?.sanitized, "10-file drop preview should be sanitized").toBe(true);
    expect(preview?.rawPreviewSeen, "10-file raw drop preview must not show").toBe(false);
    expect(preview?.rawPreviewBeforeSanitized, "10-file raw drop preview must not appear first").toBe(false);
    expect(preview?.files?.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
    const events = await getFileEvents(page);
    expect(events.map((event) => event.name), "10-file drop output order must match input order").toEqual([
      ...files.map((file) => file.name)
    ]);
    expect(events.every((event) => event.source === "input"), "WhatsApp must receive sanitized input events for drag/drop handoff").toBe(true);
    for (const file of files) {
      expectSanitizedDocumentEvent(events, file);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop 21 small supported files blocks before preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = multiFileFixtureSet(21);

    await dragDropWhatsAppFile(page, files);

    await expectBlocked(page, /Raw file upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "21-small-file drop must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "21-small-file raw drop preview must not show").toBe(false);
    await expectNoFileEvents(page);
    for (const file of files) {
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop six large supported files blocks before preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const files = sixLargeFileBlockedSet();

    await dragDropWhatsAppFile(page, files);

    await expectBlocked(page, /Raw file upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "six-large-file drop must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "six-large-file raw drop preview must not show").toBe(false);
    await expectNoFileEvents(page);
    for (const file of files) {
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("@files drag/drop unsupported file blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = unsupportedFileFixture({ name: "lgqa-whatsapp-drop-unsupported.exe" });

    await dragDropWhatsAppFile(page, file);

    await expectBlocked(page, /WhatsApp file upload blocked|Raw file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "unsupported drop must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "unsupported raw drop preview must not show").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files drag/drop failed file blocks whole batch without partial preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const good = textFileFixtures[0];
    const failed = malformedPdfFixture();

    await dragDropWhatsAppFile(page, [good, failed]);

    await expectBlocked(page, /Raw file blocked|Raw file upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "failed drop batch must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "failed drop batch raw preview must not show").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, good.secret);
    await expectNoRawSecretVisible(page, failed.secret);
  });

  test("@files @images attach-button failing multi-file image batch blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const first = await imageFixture("png");
    const second = await imageFixture("jpg");

    await uploadWhatsAppAttachFile(page, [first, second]);

    await expectBlocked(page, /Raw file upload blocked|WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "multi-file attach must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "multi-file attach must not show raw preview").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, first.secret);
    await expectNoRawSecretVisible(page, second.secret);
  });

  test("@files unsupported binary document attach blocks without preview", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = unsupportedFileFixture({ name: "lgqa-whatsapp-unsupported.exe" });

    await uploadWhatsAppAttachFile(page, file);

    await expectBlocked(page, /WhatsApp file upload blocked/i);
    const preview = await getWhatsAppPreviewState(page);
    expect(preview?.visible, "unsupported binary attach must not open preview").toBe(false);
    expect(preview?.rawPreviewSeen, "unsupported binary raw preview must not show").toBe(false);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });
});
