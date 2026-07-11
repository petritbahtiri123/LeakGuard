import {
  expect,
  expectBlocked,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  expectNoUnsafeOriginalFilename,
  dragDropFile,
  getFileEvents,
  test,
  uploadFile
} from "./helpers/extensionFixture.mjs";
import {
  documentFileFixtures,
  malformedPdfFixture,
  textFileFixtures,
  unsupportedFileFixture
} from "./helpers/e2eFileFixtures.mjs";

async function expectFileEvent(page, predicate, label) {
  await expect.poll(async () => {
    const events = await getFileEvents(page);
    return events.some(predicate);
  }, { message: label, timeout: 45000 }).toBe(true);
}

async function expectSanitizedTextUpload(page, file) {
  await uploadFile(page, file);
  await expectFileEvent(
    page,
    (event) => event.source === "input" &&
      /\[PWM_\d+\]/.test(event.text || "") &&
      !(event.text || "").includes(file.secret),
    `${file.name} should be uploaded as sanitized text`
  );
  await expectNoRawSecretVisible(page, file.secret);
}

test.describe("@files protected file upload contract", () => {
  test("TXT, ENV, JSON, LOG, and MD uploads redact before host delivery", async ({ extensionApp }) => {
    // Thirteen sequential local-sanitization fixtures can exceed three minutes on loaded runners.
    test.setTimeout(300000);
    for (const file of textFileFixtures) {
      const page = await extensionApp.openProtectedFixture("textarea");
      await expectSanitizedTextUpload(page, file);
    }
  });

  test("PDF, DOCX, and XLSX uploads are handed off as sanitized files", async ({ extensionApp }) => {
    for (const file of documentFileFixtures) {
      const page = await extensionApp.openProtectedFixture("textarea");
      await uploadFile(page, file);
      await expectFileEvent(
        page,
        (event) => event.source === "input" && event.name !== file.name && /\.redacted\./i.test(event.name || ""),
        `${file.name} should become a redacted file handoff`
      );
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("encrypted or malformed PDF blocks raw upload", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const file = malformedPdfFixture();

    await uploadFile(page, file);

    await expectBlocked(page, /Raw file (?:upload )?blocked/i);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("unsupported file blocks safely", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const file = unsupportedFileFixture();

    await uploadFile(page, file);

    await expectBlocked(page, /Raw file upload blocked/i);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("original unsafe filename is not leaked in unsafe error paths", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const unsafeName = "LGQA_UNSAFE_ORIGINAL_FILENAME_FakePassword123456789.bin";
    const file = unsupportedFileFixture({ name: unsafeName });

    await dragDropFile(page, file);

    await expectBlocked(page, /Raw file upload blocked/i);
    await expectNoFileEvents(page);
    await expectNoUnsafeOriginalFilename(page, unsafeName);
    await expectNoRawSecretVisible(page, file.secret);
  });
});
