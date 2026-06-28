import {
  dragDropFile,
  expect,
  expectBlocked,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  getFileEvents,
  getSentMessages,
  pasteImageFromClipboard,
  test,
  uploadFile
} from "./helpers/extensionFixture.mjs";
import {
  imageFixture,
  malformedImageFixture,
  oversizedImageFixture
} from "./helpers/e2eFileFixtures.mjs";

async function imageOutcome(page, file, source) {
  return await page.evaluate((payload) => {
    const events = window.__leakguardE2E.fileEvents;
    const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
      .map((element) => element.innerText || element.textContent || "")
      .join("\n");
    const text = `${document.body.innerText || ""}\n${modalText}`;
    const sanitized = events.some((event) => {
      return event.source === payload.source &&
        event.name === payload.expectedOutputName &&
        event.type === "image/png";
    });
    const blocked = /Raw image upload blocked|Raw file upload blocked/i.test(text);
    return { sanitized, blocked };
  }, {
    expectedOutputName: file.expectedOutputName,
    source
  });
}

async function expectSanitizedImageOrBlocked(page, file, source) {
  await expect.poll(async () => {
    const outcome = await imageOutcome(page, file, source);
    return outcome.sanitized || outcome.blocked;
  }, { timeout: 90000 }).toBe(true);

  const finalOutcome = await imageOutcome(page, file, source);
  expect(finalOutcome.sanitized || finalOutcome.blocked, "image path should sanitize or fail closed").toBe(true);
  if (finalOutcome.sanitized) {
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), `${file.name} must not be handed to the host`).toBe(true);
    expect(await getSentMessages(page), "image redaction output should stay file-only").toEqual([]);
    await expectNoRawSecretVisible(page, file.secret);
    return finalOutcome;
  }

  await expectNoFileEvents(page);
  expect(await getSentMessages(page), "blocked image path must not text-submit a fallback").toEqual([]);
  await expectNoRawSecretVisible(page, file.secret);
  return finalOutcome;
}

test.describe("@images protected image contract", () => {
  for (const kind of ["png", "jpg", "webp"]) {
    test(`${kind.toUpperCase()} image OCR path redacts or fails closed`, async ({ extensionApp }) => {
      test.setTimeout(130000);
      const page = await extensionApp.openProtectedFixture("textarea");
      const file = await imageFixture(kind);

      await uploadFile(page, file);

      await expectSanitizedImageOrBlocked(page, file, "input");
    });
  }

  test("clipboard image paste is intercepted and redacts or fails closed", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("contenteditable");
    const file = await imageFixture("png");

    await pasteImageFromClipboard(page, file);

    await expectSanitizedImageOrBlocked(page, file, "paste");
  });

  test("drag/drop image is intercepted and redacts or fails closed", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("contenteditable");
    const file = await imageFixture("jpg");

    await dragDropFile(page, file);

    await expectSanitizedImageOrBlocked(page, file, "drop");
  });

  test("OCR failure blocks raw image upload", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const file = malformedImageFixture();

    await uploadFile(page, file);

    await expectBlocked(page, /Raw image upload blocked|Raw file upload blocked/i);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("unsafe image dimensions block raw upload", async ({ extensionApp }) => {
    test.setTimeout(90000);
    const page = await extensionApp.openProtectedFixture("textarea");
    const file = await oversizedImageFixture();

    await uploadFile(page, file);

    await expectBlocked(page, /Raw image upload blocked|Raw file upload blocked/i);
    await expectNoFileEvents(page);
  });
});
