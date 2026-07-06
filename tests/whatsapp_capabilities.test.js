const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/whatsapp/whatsappCapabilities.js"));

function createCapabilities(overrides = {}) {
  const whatsappAdapter = {
    id: "whatsapp",
    supportsClipboardImagePasteHandoff: true,
    supportsSanitizedDropHandoff: true,
    supportsSanitizedMultiFileAttachHandoff: true
  };
  return globalThis.PWM.WhatsAppCapabilities.createWhatsAppCapabilities({
    isWhatsAppHost: () => true,
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => whatsappAdapter,
    getFileHandoffAdapterForLocation: () => whatsappAdapter,
    dataTransferHasFiles: (transfer) => Array.from(transfer?.files || []).length > 0,
    listLocalTransferFiles: (transfer) => Array.from(transfer?.files || []),
    filePasteHelpers: {
      isSupportedClipboardImageMimeType: (mimeType) => mimeType === "image/png"
    },
    ...overrides
  });
}

function transfer(files) {
  return {
    files,
    types: files.length ? ["Files"] : [],
    items: []
  };
}

function testClipboardImagePasteRequiresHostPasteSingleImageAndCapability() {
  const capabilities = createCapabilities();

  assert.strictEqual(
    capabilities.isSupportedWhatsAppClipboardImagePaste(transfer([{ type: "image/png" }]), "paste"),
    true
  );
  assert.strictEqual(
    capabilities.isSupportedWhatsAppClipboardImagePaste(transfer([{ type: "image/gif" }]), "paste"),
    false
  );
  assert.strictEqual(
    capabilities.isSupportedWhatsAppClipboardImagePaste(transfer([{ type: "image/png" }]), "drop"),
    false
  );
  assert.strictEqual(
    createCapabilities({ isWhatsAppHost: () => false }).isSupportedWhatsAppClipboardImagePaste(
      transfer([{ type: "image/png" }]),
      "paste"
    ),
    false
  );
}

function testSanitizedDropAndFileHandoffContextsUseAdapterCapability() {
  const capabilities = createCapabilities();

  assert.strictEqual(capabilities.isWhatsAppSanitizedDropHandoffEnabled("drop"), true);
  assert.strictEqual(capabilities.isWhatsAppSanitizedDropHandoffEnabled("file-input"), false);
  assert.strictEqual(capabilities.isWhatsAppHandoffContext(), true);
  assert.strictEqual(capabilities.isWhatsAppSanitizedFileHandoffContext("file-input"), true);
  assert.strictEqual(capabilities.isWhatsAppSanitizedFileHandoffContext("drop"), true);
}

function testMultiFileAttachGateRequiresWhatsAppContextAndMoreThanOneFile() {
  const capabilities = createCapabilities();

  assert.strictEqual(capabilities.isWhatsAppSanitizedMultiFileAttachEnabled("file-input"), true);
  assert.strictEqual(capabilities.isPotentialWhatsAppMultiFileAttach([{ name: "one.txt" }], "file-input"), false);
  assert.strictEqual(
    capabilities.isPotentialWhatsAppMultiFileAttach([{ name: "one.txt" }, { name: "two.txt" }], "file-input"),
    true
  );
  assert.strictEqual(
    createCapabilities({
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedMultiFileAttachHandoff: false
      })
    }).isPotentialWhatsAppMultiFileAttach([{ name: "one.txt" }, { name: "two.txt" }], "file-input"),
    false
  );
}

testClipboardImagePasteRequiresHostPasteSingleImageAndCapability();
testSanitizedDropAndFileHandoffContextsUseAdapterCapability();
testMultiFileAttachGateRequiresWhatsAppContextAndMoreThanOneFile();

console.log("PASS WhatsApp capabilities");
