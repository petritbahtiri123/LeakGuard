import {
  dispatchFileDrop,
  expect,
  expectComposerText,
  expectNoDoubleSend,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  expectSentMessage,
  getFileEvents,
  getSentMessages,
  setComposerText,
  test
} from "./helpers/extensionFixture.mjs";

const clickSecret = "SuperFakePassword123456789!";
const enterSecret = "EnterOnlyFakePassword123456789!";
const fileSecret = "FileOnlyFakePassword123456789!";

test("first click sends sanitized text once and never sends the raw fake secret", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");
  const marker = "LGQA_E2E_CLICK_1";

  await setComposerText(page, `${marker} my password is ${clickSecret}`);
  await page.locator("#send-button").click();

  await expectSentMessage(page, new RegExp(`${marker} my password is \\[PWM_\\d+\\]`));
  await expectNoRawSecretVisible(page, clickSecret);
  await expectNoDoubleSend(page, marker);
});

test("Enter sends sanitized contenteditable text without requiring a second attempt", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("contenteditable");
  const marker = "LGQA_E2E_ENTER_1";

  await setComposerText(page, `${marker} my password is ${enterSecret}`);
  await page.locator("#editable-composer").press("Enter");

  await expectSentMessage(page, new RegExp(`${marker} my password is \\[PWM_\\d+\\]`));
  await expectNoRawSecretVisible(page, enterSecret);
  await expectNoDoubleSend(page, marker);
});

test("trusted-looking placeholders are sent unchanged", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");
  const text = "LGQA_E2E_PLACEHOLDERS already redacted [PWM_1] and [PWM_2]";

  await setComposerText(page, text);
  await page.locator("#send-button").click();

  await expectSentMessage(page, text);
  await expectNoDoubleSend(page, "LGQA_E2E_PLACEHOLDERS");
});

test("Shift+Enter creates a newline and does not send", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");

  await setComposerText(page, "LGQA_E2E_SHIFT line one");
  await page.locator("#prompt-textarea").press("Shift+Enter");
  await page.locator("#prompt-textarea").pressSequentially("line two");

  await expectComposerText(page, "LGQA_E2E_SHIFT line one\nline two");
  await expect.poll(() => getSentMessages(page)).toEqual([]);
});

test("normal non-sensitive text sends unchanged", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");
  const text = "LGQA_E2E_SAFE normal planning note with token_limit=4096";

  await setComposerText(page, text);
  await page.locator("#send-button").click();

  await expectSentMessage(page, text);
  await expectNoDoubleSend(page, "LGQA_E2E_SAFE");
});

test("empty composer does not create modal failures or sent messages", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");

  await setComposerText(page, "");
  await page.locator("#send-button").click();
  await page.waitForTimeout(250);

  await expect.poll(() => getSentMessages(page)).toEqual([]);
  await expect(page.locator(".pwm-modal-backdrop")).toHaveCount(0);
});

test("unsupported binary file input and drop fail closed without raw fallback", async ({ extensionApp }) => {
  const inputPage = await extensionApp.openProtectedFixture("textarea");
  const rawFileText = `LGQA_E2E_FILE_INPUT my password is ${fileSecret}`;

  await inputPage.setInputFiles("#file-input", {
    name: "payload.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(rawFileText, "utf8")
  });

  await expect(inputPage.locator(".pwm-modal-backdrop")).toContainText(/Raw file upload blocked/i);
  await inputPage.waitForTimeout(250);
  await expectNoFileEvents(inputPage);
  await expectNoRawSecretVisible(inputPage, fileSecret);

  const dropPage = await extensionApp.openProtectedFixture("textarea");
  await dispatchFileDrop(dropPage, {
    name: "dropped-payload.bin",
    mimeType: "application/octet-stream",
    text: `LGQA_E2E_FILE_DROP my password is ${fileSecret}`
  });

  await expect(dropPage.locator(".pwm-modal-backdrop")).toContainText(/Raw file upload blocked/i);
  await dropPage.waitForTimeout(250);
  await expectNoFileEvents(dropPage);
  await expectNoRawSecretVisible(dropPage, fileSecret);
});

test("popup and options pages load without runtime errors", async ({ extensionApp }) => {
  const popup = await extensionApp.openExtensionPage("popup/popup.html");
  await expect(popup.page.locator("#manage-btn")).toBeVisible();
  expect(popup.errors).toEqual([]);
  await popup.page.close();

  const options = await extensionApp.openExtensionPage("options/options.html");
  await expect(options.page.locator("#add-site-form")).toBeVisible();
  expect(options.errors).toEqual([]);
  await options.page.close();
});

test("file fixture does not record raw events when LeakGuard blocks before the page handler", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("textarea");

  await dispatchFileDrop(page, {
    name: "raw-event-check.bin",
    mimeType: "application/octet-stream",
    text: `LGQA_E2E_FILE_EVENT my password is ${fileSecret}`
  });

  await expect(page.locator(".pwm-modal-backdrop")).toContainText(/Raw file upload blocked/i);
  await expect.poll(() => getFileEvents(page)).toEqual([]);
});
