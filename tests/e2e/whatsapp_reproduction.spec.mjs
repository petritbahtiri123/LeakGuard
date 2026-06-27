import {
  clickSend,
  expect,
  expectBlocked,
  expectComposerTextExactly,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  getSentMessages,
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

function countOccurrences(text, needle) {
  return String(text || "").split(needle).length - 1;
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

  test("@files @images image attachment remains unsupported", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("whatsapp");
    const file = await imageFixture("png");

    await uploadFile(page, file);

    await expectBlocked(page, /WhatsApp file upload blocked/i);
    await page.waitForTimeout(250);
    await expectNoFileEvents(page);
    await expectNoRawSecretVisible(page, file.secret);
  });
});
