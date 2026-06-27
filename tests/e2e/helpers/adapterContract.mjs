import {
  clickSend,
  dragDropFile,
  expect,
  expectComposerText,
  expectBlocked,
  expectNoDoubleSend,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  expectSentMessage,
  getSentMessages,
  pressEnterToSend,
  pressShiftEnter,
  test,
  typeIntoComposer,
  uploadFile
} from "./extensionFixture.mjs";

export const localAdapterProfiles = [
  {
    id: "local-textarea",
    label: "Local textarea fixture",
    fixtureMode: "textarea"
  },
  {
    id: "local-contenteditable",
    label: "Local contenteditable fixture",
    fixtureMode: "contenteditable"
  },
  {
    id: "whatsapp-web",
    label: "WhatsApp Web text-only fixture",
    fixtureMode: "whatsapp",
    unsupportedBlockPattern: /WhatsApp file upload blocked|Raw file upload blocked/i
  }
];

function profileMarker(profile, suffix) {
  return `LGQA_E2E_${profile.id.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}_${suffix}`;
}

function redactedPasswordPattern(marker) {
  return new RegExp(`${marker} my password is \\[PWM_\\d+\\]`);
}

async function openProfilePage(extensionApp, profile) {
  if (typeof profile.openPage === "function") {
    return await profile.openPage(extensionApp);
  }
  return await extensionApp.openProtectedFixture(profile.fixtureMode || profile.mode || "textarea");
}

export function defineAdapterContractScenarios(profile) {
  test.describe(`${profile.label} adapter contract`, () => {
    test("@text normal text sends unchanged", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const text = `${profileMarker(profile, "SAFE")} normal planning note with token_limit=4096`;

      await typeIntoComposer(page, text);
      await clickSend(page);

      await expectSentMessage(page, text);
      await expectNoDoubleSend(page, profileMarker(profile, "SAFE"));
    });

    test("@text fake password redacts on first click", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "CLICK");
      const secret = `${marker}_SuperFakePassword123456789!`;

      await typeIntoComposer(page, `${marker} my password is ${secret}`);
      await clickSend(page);

      await expectSentMessage(page, redactedPasswordPattern(marker));
      await expectNoRawSecretVisible(page, secret);
      await expectNoDoubleSend(page, marker);
    });

    test("@text fake password redacts on Enter", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "ENTER");
      const secret = `${marker}_EnterOnlyFakePassword123456789!`;

      await typeIntoComposer(page, `${marker} my password is ${secret}`);
      await pressEnterToSend(page);

      await expectSentMessage(page, redactedPasswordPattern(marker));
      await expectNoRawSecretVisible(page, secret);
      await expectNoDoubleSend(page, marker);
    });

    test("@text placeholders [PWM_1] and [PWM_2] stay unchanged", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "PLACEHOLDER");
      const text = `${marker} already redacted [PWM_1] [PWM_2]`;

      await typeIntoComposer(page, text);
      await clickSend(page);

      await expectSentMessage(page, text);
      await expectNoDoubleSend(page, marker);
    });

    test("@text Shift+Enter does not send", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "SHIFT");

      await typeIntoComposer(page, `${marker} line one`);
      await pressShiftEnter(page);
      await page.locator("[data-testid='prompt-textarea']:visible").first().pressSequentially("line two");

      await expectComposerText(page, `${marker} line one\nline two`);
      await expect.poll(() => getSentMessages(page)).toEqual([]);
    });

    test("@text empty composer does not create false failure", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);

      await typeIntoComposer(page, "");
      await clickSend(page);
      await page.waitForTimeout(250);

      await expect.poll(() => getSentMessages(page)).toEqual([]);
      await expect(page.locator(".pwm-modal-backdrop")).toHaveCount(0);
    });

    test("@files unsupported file path fails closed", async ({ extensionApp }) => {
      const inputPage = await openProfilePage(extensionApp, profile);
      const inputSecret = `${profileMarker(profile, "FILE_INPUT")}_FakePassword123456789!`;

      await uploadFile(inputPage, {
        name: "payload.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(`${profileMarker(profile, "FILE_INPUT")} my password is ${inputSecret}`, "utf8")
      });

      await expectBlocked(inputPage, profile.unsupportedBlockPattern || /Raw file upload blocked/i);
      await inputPage.waitForTimeout(250);
      await expectNoFileEvents(inputPage);
      await expectNoRawSecretVisible(inputPage, inputSecret);

      const dropPage = await openProfilePage(extensionApp, profile);
      const dropSecret = `${profileMarker(profile, "FILE_DROP")}_FakePassword123456789!`;
      await dragDropFile(dropPage, {
        name: "dropped-payload.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(`${profileMarker(profile, "FILE_DROP")} my password is ${dropSecret}`, "utf8")
      });

      await expectBlocked(dropPage, profile.unsupportedBlockPattern || /Raw file upload blocked/i);
      await dropPage.waitForTimeout(250);
      await expectNoFileEvents(dropPage);
      await expectNoRawSecretVisible(dropPage, dropSecret);
    });

    test("@text programmatic replay does not recurse", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "REPLAY");
      const secret = `${marker}_ReplayFakePassword123456789!`;

      await typeIntoComposer(page, `${marker} my password is ${secret}`);
      await clickSend(page);

      await expectSentMessage(page, redactedPasswordPattern(marker));
      await page.waitForTimeout(500);
      await expectNoRawSecretVisible(page, secret);
      await expectNoDoubleSend(page, marker);
    });

    test("@text second-click retry is not accepted", async ({ extensionApp }) => {
      const page = await openProfilePage(extensionApp, profile);
      const marker = profileMarker(profile, "NO_RETRY");
      const secret = `${marker}_SingleClickFakePassword123456789!`;

      await typeIntoComposer(page, `${marker} my password is ${secret}`);
      await clickSend(page);

      await expectSentMessage(page, redactedPasswordPattern(marker));
      await expectComposerText(page, "");
      await expectNoRawSecretVisible(page, secret);
      await expectNoDoubleSend(page, marker);
      expect(await getSentMessages(page)).toHaveLength(1);
    });
  });
}
