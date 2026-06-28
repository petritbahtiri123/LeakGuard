import {
  defineAdapterContractScenarios,
  localAdapterProfiles
} from "./helpers/adapterContract.mjs";
import { expect, test } from "./helpers/extensionFixture.mjs";

for (const profile of localAdapterProfiles) {
  defineAdapterContractScenarios(profile);
}

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
