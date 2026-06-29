import {
  clickSend,
  expect,
  expectBlocked,
  expectComposerTextExactly,
  expectNoFileEvents,
  expectNoDoubleSend,
  getFileEvents,
  expectNoRawSecretVisible,
  getSentMessages,
  getComposerText,
  pressEnterToSend,
  pasteImageFromClipboard,
  pressShiftEnter,
  test,
  typeIntoComposer,
  uploadFile
} from "./helpers/extensionFixture.mjs";
import { imageFixture } from "./helpers/e2eFileFixtures.mjs";

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
      const body = await page.locator("body").innerText();
      return events.some((event) =>
        event.source === "paste" &&
        event.name === file.expectedOutputName &&
        event.type === "image/png"
      ) || /Raw image upload blocked/i.test(body);
    }, { timeout: 90000 }).toBe(true);
    const events = await getFileEvents(page);
    expect(events.every((event) => event.name !== file.name), "WhatsApp must not receive raw clipboard image").toBe(true);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@files @images attach-button image remains unsupported", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await uploadFile(page, file);

    await expectBlocked(page, /WhatsApp file upload blocked/i);
    await page.waitForTimeout(250);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });
});
