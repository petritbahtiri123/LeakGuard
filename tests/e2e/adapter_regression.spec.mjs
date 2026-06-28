import {
  clickSend,
  dragDropFile,
  expect,
  expectNoDoubleSend,
  expectNoFileEvents,
  expectNoRawSecretVisible,
  expectSentMessage,
  getFileEvents,
  pressEnterToSend,
  test,
  typeIntoComposer,
  uploadFile
} from "./helpers/extensionFixture.mjs";
import {
  imageFixture,
  textFileFixtures
} from "./helpers/e2eFileFixtures.mjs";

function passwordCase(id) {
  const secret = `${id}_SuperFakePassword123456789!`;
  return {
    secret,
    text: `${id} my password is ${secret}`,
    expected: new RegExp(`${id} my password is \\[PWM_\\d+\\]`)
  };
}

async function expectTextSend({ extensionApp, mode, input, submit }) {
  const page = await extensionApp.openProtectedFixture(mode);
  const data = passwordCase(input);

  await typeIntoComposer(page, data.text);
  await submit(page);

  await expectSentMessage(page, data.expected);
  await expectNoRawSecretVisible(page, data.secret);
  await expectNoDoubleSend(page, input);
}

test.describe("@adapters local adapter regression contract", () => {
  test("@text ChatGPT-like fixture passes text click", async ({ extensionApp }) => {
    await expectTextSend({
      extensionApp,
      mode: "chatgpt",
      input: "LGQA_E2E_CHATGPT_CLICK",
      submit: clickSend
    });
  });

  test("@text ChatGPT-like fixture passes Enter", async ({ extensionApp }) => {
    await expectTextSend({
      extensionApp,
      mode: "chatgpt",
      input: "LGQA_E2E_CHATGPT_ENTER",
      submit: pressEnterToSend
    });
  });

  test("@text Gemini-like fixture passes text click", async ({ extensionApp }) => {
    await expectTextSend({
      extensionApp,
      mode: "gemini",
      input: "LGQA_E2E_GEMINI_CLICK",
      submit: clickSend
    });
  });

  test("@text Gemini-like fixture passes Enter", async ({ extensionApp }) => {
    await expectTextSend({
      extensionApp,
      mode: "gemini",
      input: "LGQA_E2E_GEMINI_ENTER",
      submit: pressEnterToSend
    });
  });

  test("@files Gemini/Grok-style pending attach surface keeps sanitized handoff behavior", async ({ extensionApp }) => {
    const page = await extensionApp.openProtectedFixture("gemini");
    const file = textFileFixtures[0];

    await dragDropFile(page, file);

    await expect.poll(async () => {
      const events = await getFileEvents(page);
      return events.some((event) =>
        /\[PWM_\d+\]/.test(event.text || "") &&
        !(event.text || "").includes(file.secret));
    }, { timeout: 45000 }).toBe(true);
    await expectNoRawSecretVisible(page, file.secret);
  });

  test("@images existing image/file handoff behavior remains intact", async ({ extensionApp }) => {
    test.setTimeout(130000);
    const page = await extensionApp.openProtectedFixture("chatgpt");
    const file = await imageFixture("png");

    await uploadFile(page, file);

    await expect.poll(async () => {
      const events = await getFileEvents(page);
      const bodyText = await page.evaluate(() => {
        const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
          .map((element) => element.innerText || element.textContent || "")
          .join("\n");
        return `${document.body.innerText || ""}\n${modalText}`;
      });
      return events.some((event) => event.source === "input" && event.name === file.expectedOutputName) ||
        /Raw image upload blocked|Raw file upload blocked/i.test(bodyText);
    }, { timeout: 90000 }).toBe(true);
    const events = await getFileEvents(page);
    if (!events.some((event) => event.source === "input" && event.name === file.expectedOutputName)) {
      await expectNoFileEvents(page);
    }
    await expectNoRawSecretVisible(page, file.secret);
  });
});
