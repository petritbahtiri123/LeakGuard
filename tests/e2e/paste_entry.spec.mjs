import {
  clickSend,
  copyPasteIntoComposer,
  expect,
  expectNoDoubleSend,
  expectNoRawSecretVisible,
  expectSentMessage,
  getComposerText,
  getSentMessages,
  pasteIntoComposer,
  test
} from "./helpers/extensionFixture.mjs";

const pasteProfiles = [
  ["textarea", "textarea"],
  ["contenteditable", "contenteditable"]
];

function marker(mode, suffix) {
  return `LGQA_E2E_PASTE_${mode.toUpperCase()}_${suffix}`;
}

async function expectComposerRedacted(page, secret) {
  await expect.poll(() => getComposerText(page)).not.toContain(secret);
  await expect.poll(() => getComposerText(page)).toMatch(/\[PWM_\d+\]/);
}

for (const [label, mode] of pasteProfiles) {
  test.describe(`@text @paste ${label} paste contract`, () => {
    test("pasted single-line fake secret redacts", async ({ extensionApp }) => {
      const page = await extensionApp.openProtectedFixture(mode);
      const id = marker(label, "SINGLE");
      const secret = `${id}_SuperFakePassword123456789!`;

      await pasteIntoComposer(page, `${id} my password is ${secret}`);
      await expectComposerRedacted(page, secret);
      await clickSend(page);

      await expectSentMessage(page, new RegExp(`${id} my password is \\[PWM_\\d+\\]`));
      await expectNoRawSecretVisible(page, secret);
      await expectNoDoubleSend(page, id);
    });

    test("pasted multiline fake secrets redact", async ({ extensionApp }) => {
      const page = await extensionApp.openProtectedFixture(mode);
      const id = marker(label, "MULTI");
      const password = `${id}_Password123456789!`;
      const apiKey = "sk-proj-LGQAFakePasteMultiOpenAiKey1234567890AbCdEfGhIjKlMnOp";

      await pasteIntoComposer(page, [
        id,
        `PASSWORD=${password}`,
        `OPENAI_API_KEY=${apiKey}`
      ].join("\n"));
      await expectComposerRedacted(page, password);
      await expectComposerRedacted(page, apiKey);
      await clickSend(page);

      await expectNoRawSecretVisible(page, password);
      await expectNoRawSecretVisible(page, apiKey);
      expect(await getSentMessages(page)).toHaveLength(1);
    });

    test("placeholder paste does not redetect", async ({ extensionApp }) => {
      const page = await extensionApp.openProtectedFixture(mode);
      const id = marker(label, "PLACEHOLDER");
      const text = `${id} already redacted [PWM_1] [PWM_2]`;

      await pasteIntoComposer(page, text);
      await expect.poll(() => getComposerText(page)).toBe(text);
      await clickSend(page);

      await expectSentMessage(page, text);
      await expectNoDoubleSend(page, id);
    });
  });
}

test("@text @paste copy/paste block redacts API keys, DB URL, and GitHub token exactly once", async ({ extensionApp }) => {
  const page = await extensionApp.openProtectedFixture("contenteditable");
  const markerText = "LGQA_E2E_PASTE_BLOCK";
  const openAiKey = "sk-proj-LGQAFakePasteOpenAiKey1234567890AbCdEfGhIjKlMnOp";
  const githubToken = "ghp_LGQAFakePasteGithubToken1234567890AbCdEfGhIjKl";
  const dbPassword = "FakePass123";
  const block = [
    markerText,
    `OPENAI_API_KEY=${openAiKey}`,
    `GITHUB_TOKEN=${githubToken}`,
    `DATABASE_URL=postgres://admin:${dbPassword}@db.example.com:5432/customerdb`
  ].join("\n");

  await copyPasteIntoComposer(page, block);
  await expectComposerRedacted(page, openAiKey);
  await expectComposerRedacted(page, githubToken);
  await expectComposerRedacted(page, dbPassword);
  await clickSend(page);

  const [message] = await getSentMessages(page);
  expect(message).toMatch(/OPENAI_API_KEY=\[PWM_\d+\]/);
  expect(message).toMatch(/GITHUB_TOKEN=\[PWM_\d+\]/);
  expect(message).toMatch(/DATABASE_URL=postgres:\/\/admin:\[PWM_\d+\]@db\.example\.com:5432\/customerdb/);
  for (const label of ["OPENAI_API_KEY=", "GITHUB_TOKEN=", "DATABASE_URL="]) {
    expect(message.split(label).length - 1, `${label} should appear once`).toBe(1);
  }
  await expectNoRawSecretVisible(page, openAiKey);
  await expectNoRawSecretVisible(page, githubToken);
  await expectNoRawSecretVisible(page, dbPassword);
  expect(await getSentMessages(page)).toHaveLength(1);
});
