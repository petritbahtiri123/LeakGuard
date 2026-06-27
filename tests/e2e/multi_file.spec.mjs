import {
  expect,
  expectBlocked,
  dragDropFile,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  expectNoUnsafeOriginalFilename,
  getFileEvents,
  test,
  uploadFile
} from "./helpers/extensionFixture.mjs";
import {
  multiFileFixtureSet,
  sixLargeFileBlockedSet,
  unsupportedFileFixture
} from "./helpers/e2eFileFixtures.mjs";

async function waitForFileEventCount(page, count) {
  await expect.poll(async () => (await getFileEvents(page)).length, { timeout: 45000 }).toBe(count);
}

function canonicalEventName(name) {
  return String(name || "").replace(/\.redacted(?=\.)/i, "");
}

test.describe("@files @multi protected multi-file contract", () => {
  test("two supported files are processed independently", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const files = multiFileFixtureSet(2);

    await uploadFile(page, files);

    await waitForFileEventCount(page, 2);
    const events = await getFileEvents(page);
    for (const [index, file] of files.entries()) {
      expect(canonicalEventName(events[index].name)).toBe(file.name);
      expect(events[index].text).toMatch(/\[PWM_\d+\]/);
      expect(events[index].text).not.toContain(file.secret);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("five supported files preserve deterministic order", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const files = multiFileFixtureSet(5);

    await uploadFile(page, files);

    await waitForFileEventCount(page, 5);
    const events = await getFileEvents(page);
    expect(events.map((event) => canonicalEventName(event.name))).toEqual(files.map((file) => file.name));
    for (const [index, file] of files.entries()) {
      expect(events[index].text).toMatch(/\[PWM_\d+\]/);
      expect(events[index].text).not.toContain(file.secret);
      await expectNoRawSecretVisible(page, file.secret);
    }
  });

  test("one failed file blocks or fails closed without raw fallback", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("textarea");
    const [supported] = multiFileFixtureSet(1);
    const unsafeName = "LGQA_UNSAFE_MULTI_ORIGINAL_FILENAME_FakePassword123456789.bin";
    const unsupported = unsupportedFileFixture({ name: unsafeName });

    await dragDropFile(page, [supported, unsupported]);

    await expect.poll(async () => {
      const events = await getFileEvents(page);
      const bodyText = await page.evaluate(() => document.body.innerText || "");
      return events.length > 0 || /Raw file upload blocked|unsupported files blocked/i.test(bodyText);
    }, { timeout: 45000 }).toBe(true);

    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== unsupported.name), "unsupported raw file must not reach fixture").toBe(true);
    await expectNoRawSecretVisible(page, supported.secret);
    await expectNoRawSecretVisible(page, unsupported.secret);
    await expectNoUnsafeOriginalFilename(page, unsafeName);
  });

  test("six large files are blocked before read", async ({ extensionApp }) => {
    test.setTimeout(90000);
    const page = await extensionApp.openProtectedFixture("textarea");
    const files = sixLargeFileBlockedSet();

    await uploadFile(page, files);

    await expectBlocked(page, /Raw file upload blocked/i);
    await expectNoFileEvents(page);
    for (const file of files) {
      await expectNoRawSecretVisible(page, file.secret);
    }
  });
});
