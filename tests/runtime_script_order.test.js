const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/runtime_scripts.js"));

const { contentScripts, backgroundScripts } = globalThis.PWM.RuntimeScripts;

function assertIncludes(scripts, script, label) {
  const index = scripts.indexOf(script);
  assert.notStrictEqual(index, -1, `${label} should include ${script}`);
  return index;
}

function assertBefore(scripts, dependency, consumer, label) {
  const dependencyIndex = assertIncludes(scripts, dependency, label);
  const consumerIndex = assertIncludes(scripts, consumer, label);
  assert.ok(
    dependencyIndex < consumerIndex,
    `${label} should load ${dependency} before ${consumer}`
  );
}

function assertAfterAll(scripts, consumer, dependencies, label) {
  dependencies.forEach((dependency) => assertBefore(scripts, dependency, consumer, label));
}

function assertDetectorModulesBeforeDetector(scripts, label) {
  const detectorModules = [
    "shared/detection/constants/enterpriseTokens.js",
    "shared/detection/constants/providerTokens.js",
    "shared/detection/constants/contextRegexes.js",
    "shared/detection/contextWindow.js",
    "shared/detection/cloudScoring.js",
    "shared/detection/enterprise/shared.js",
    "shared/detection/enterprise/uncPaths.js",
    "shared/detection/enterprise/directoryMetadata.js",
    "shared/detection/enterprise/internalNetwork.js",
    "shared/detection/enterprise/fileShares.js",
    "shared/detection/enterprise/adGroups.js",
    "shared/detection/enterprise/hostnames.js",
    "shared/detection/enterprise/identity.js",
    "shared/detection/enterprise/storageAccounts.js",
    "shared/detection/enterprise/azureResourceGroups.js",
    "shared/detection/enterprise/cloudResourceNames.js",
    "shared/detection/enterprise/index.js",
    "shared/detection/providers/azure.js",
    "shared/detection/providers/azureIds.js",
    "shared/detection/providers/aws.js",
    "shared/detection/providers/gcp.js",
    "shared/detection/providers/otcOpenStack.js",
    "shared/detection/providers/kubernetes.js",
    "shared/detection/providers/genericEndpoints.js",
    "shared/detection/providers/index.js",
    "shared/detection/urlUserinfo.js",
    "shared/detection/httpHeaders.js",
    "shared/detection/structuredMetadata.js"
  ];

  detectorModules.forEach((modulePath) => {
    assertBefore(scripts, modulePath, "shared/detector.js", label);
  });
}

function getScannerPageScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("<script ") && line.includes('src="'))
    .map((line) => {
      const srcStart = line.indexOf('src="') + 'src="'.length;
      const srcEnd = line.indexOf('"', srcStart);
      assert.ok(srcEnd > srcStart, `scanner script tag should have a quoted src: ${line}`);
      return line.slice(srcStart, srcEnd).replace(/^\.\.\//, "");
    });
}

function testContentRuntimeScriptOrder() {
  assert.strictEqual(
    contentScripts.at(-1),
    "content/content.js",
    "content/content.js should remain the final content orchestration script"
  );

  assertAfterAll(contentScripts, "shared/placeholders.js", ["shared/placeholders/families.js"], "content scripts");
  assertAfterAll(contentScripts, "shared/detector.js", ["shared/entropy.js", "shared/patterns.js"], "content scripts");
  assertAfterAll(contentScripts, "shared/transformOutboundPrompt.js", [
    "shared/detector.js",
    "shared/ipClassification.js",
    "shared/ipDetection.js",
    "shared/networkHierarchy.js",
    "shared/placeholderAllocator.js",
    "shared/knownSecretReuse.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "shared/redactor.js", [
    "shared/detector.js",
    "shared/placeholders.js",
    "shared/knownSecretReuse.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "shared/policy.js", ["shared/protected_sites.js"], "content scripts");

  assertDetectorModulesBeforeDetector(contentScripts, "content scripts");

  assertAfterAll(contentScripts, "content/composer/chatgptComposerSync.js", [
    "content/composer_helpers.js",
    "content/input/rewriteVerificationText.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/composer/replayVerification.js", [
    "content/input/rewriteVerificationText.js",
    "content/composer_helpers.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/file_handoff_pending.js", [
    "content/file_paste_helpers.js",
    "content/file_handoff_state.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/file_handoff_flow.js", [
    "content/file_paste_helpers.js",
    "content/file_handoff_state.js",
    "content/file_handoff_pending.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/contentFileExtractionPipeline.js", [
    "shared/fileLimits.js",
    "shared/fileTypeRegistry.js",
    "shared/fileExtractors.js",
    "shared/fileScanner.js",
    "shared/ocr/ocrRuntime.js",
    "shared/scannerOcr.js",
    "content/files/fileTransferPolicy.js",
    "content/files/fileExtractionSessionCache.js",
    "content/files/protectedSiteOcrBroker.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileTypeSupport.js", [
    "shared/fileTypeRegistry.js",
    "shared/fileScanner.js",
    "content/files/contentFileExtractionPipeline.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileAttachPipeline.js", [
    "content/file_paste_helpers.js",
    "content/file_handoff_flow.js",
    "content/files/fileTransferPolicy.js",
    "content/files/contentFileExtractionPipeline.js",
    "content/adapters/index.js",
    "content/diagnostics/safeSnapshots.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/whatsapp/whatsappCapabilities.js", [
    "content/adapters/whatsappAdapter.js",
    "content/adapters/index.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/adapters/geminiUploadDiscovery.js", [
    "content/adapters/geminiAdapter.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/adapters/grokFileHandoff.js", [
    "content/adapters/grokAdapter.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/whatsapp/whatsappTextFlow.js", [
    "content/whatsapp/whatsappCapabilities.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/whatsapp/whatsappSelectors.js", [
    "content/whatsapp/whatsappCapabilities.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "shared/transformOutboundPromptWithAi.js", [
    "shared/detector.js",
    "shared/transformOutboundPrompt.js",
    "shared/aiCandidateGate.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileAttachPipeline.js", [
    "content/diagnostics/fileDebugMetadata.js",
    "content/diagnostics/safeSnapshots.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileProcessingUi.js", [
    "content/diagnostics/fileDebugMetadata.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileAttachPipeline.js", [
    "content/files/fileProcessingUi.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/sanitizedFileBatchProcessor.js", [
    "content/files/fileAttachPipeline.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileHandoffVerification.js", [
    "content/files/fileTypeSupport.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileInputPreparation.js", [
    "content/files/fileHandoffVerification.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileDropInterception.js", [
    "content/files/fileTransferPolicy.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/files/fileInputInterception.js", [
    "content/files/fileHandoffVerification.js",
    "content/files/fileInputPreparation.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/diagnostics/contentDebugFacade.js", [
    "content/diagnostics/debugLogger.js",
    "content/diagnostics/fileDebugMetadata.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/ui/contentStatusUi.js", [
    "content/diagnostics/contentDebugFacade.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/ui/contentModalUi.js", [
    "content/diagnostics/contentDebugFacade.js"
  ], "content scripts");
  assertAfterAll(contentScripts, "content/bootstrap/eventBindings.js", [
    "content/diagnostics/contentDebugFacade.js",
    "content/ui/contentModalUi.js",
    "content/ui/contentStatusUi.js",
    "content/files/fileAttachPipeline.js",
    "content/files/pendingSanitizedFileHandoff.js"
  ], "content scripts");
}

function testScannerPageScriptOrder() {
  const scannerScripts = getScannerPageScripts();
  assertAfterAll(scannerScripts, "shared/detector.js", [
    "shared/entropy.js",
    "shared/patterns.js"
  ], "scanner page scripts");
  assertDetectorModulesBeforeDetector(scannerScripts, "scanner page scripts");
  assertAfterAll(scannerScripts, "shared/fileScanner.js", [
    "shared/detector.js",
    "shared/placeholders.js",
    "shared/transformOutboundPrompt.js"
  ], "scanner page scripts");
  assert.strictEqual(
    scannerScripts.at(-1),
    "scanner.js",
    "scanner.js should remain the final scanner page orchestration script"
  );
}

function testBackgroundRuntimeScriptOrder() {
  assert.strictEqual(
    backgroundScripts.at(-1),
    "background/core.js",
    "background/core.js should remain the final background orchestration script"
  );

  assertAfterAll(backgroundScripts, "shared/placeholders.js", ["shared/placeholders/families.js"], "background scripts");
  assertAfterAll(backgroundScripts, "shared/detector.js", ["shared/entropy.js", "shared/patterns.js"], "background scripts");
  assertAfterAll(backgroundScripts, "shared/transformOutboundPrompt.js", [
    "shared/detector.js",
    "shared/ipClassification.js",
    "shared/ipDetection.js",
    "shared/networkHierarchy.js",
    "shared/placeholderAllocator.js",
    "shared/knownSecretReuse.js"
  ], "background scripts");
  assertAfterAll(backgroundScripts, "shared/redactor.js", [
    "shared/detector.js",
    "shared/placeholders.js",
    "shared/knownSecretReuse.js"
  ], "background scripts");
  assertAfterAll(backgroundScripts, "shared/policy.js", ["shared/protected_sites.js"], "background scripts");

  assertDetectorModulesBeforeDetector(backgroundScripts, "background scripts");

  [
    "background/auditLog.js",
    "background/protectedSiteRegistry.js"
  ].forEach((modulePath) => assertBefore(backgroundScripts, modulePath, "background/core.js", "background scripts"));
}

testContentRuntimeScriptOrder();
testScannerPageScriptOrder();
testBackgroundRuntimeScriptOrder();

console.log("PASS runtime script order");
