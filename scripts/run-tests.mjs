#!/usr/bin/env node

import { spawnSync } from "child_process";

const testFiles = [
  "tests/detector.test.js",
  "tests/detection/url_userinfo_helpers.test.js",
  "tests/detection/placeholder_families.test.js",
  "tests/detection/enterprise_cloud_detection_contract.test.js",
  "tests/detection/internal_network_metadata.test.js",
  "tests/detection/enterprise_directory_metadata.test.js",
  "tests/detection/file_share_metadata.test.js",
  "tests/detection/structured_metadata_extraction.test.js",
  "tests/detection/internal_metadata_pipeline_contract.test.js",
  "tests/detection/structured_payload_pipeline_regression.test.js",
  "tests/detection/typed_placeholder_rehydration_contract.test.js",
  "tests/detection/live_site_qa_payloads.test.js",
  "tests/detection/cloud_provider_azure.test.js",
  "tests/detection/cloud_provider_aws.test.js",
  "tests/detection/cloud_provider_gcp.test.js",
  "tests/detection/cloud_provider_otc_openstack.test.js",
  "tests/detection/cloud_provider_kubernetes.test.js",
  "tests/detection/cloud_provider_negative.test.js",
  "tests/placeholder_trust.test.js",
  "tests/natural_language_context.test.js",
  "tests/break_pack.test.js",
  "tests/onix_dataset.test.js",
  "tests/ai_candidate_gate.test.js",
  "tests/transform_with_ai.test.js",
  "tests/ip_transform.test.js",
  "tests/ip_child_first_audit.test.js",
  "tests/composer_helpers.test.js",
  "tests/replay_verification.test.js",
  "tests/placeholder_rehydrator.test.js",
  "tests/response_observer.test.js",
  "tests/reveal_controller.test.js",
  "tests/typed_interception.test.js",
  "tests/prompt_pollution.test.js",
  "tests/live_typing_composer_behavior.test.js",
  "tests/adapter_contracts.test.js",
  "tests/gemini_upload_discovery.test.js",
  "tests/gemini_file_handoff.test.js",
  "tests/grok_file_handoff.test.js",
  "tests/content_event_bindings.test.js",
  "tests/content_modal_ui.test.js",
  "tests/content_status_ui.test.js",
  "tests/file_debug_metadata.test.js",
  "tests/file_drop_payload_shape.test.js",
  "tests/file_drop_streaming_guards.test.js",
  "tests/pending_multifile_handoff.test.js",
  "tests/file_drag_guard.test.js",
  "tests/content_allow_once_interaction.test.js",
  "tests/content_file_drop_interception.test.js",
  "tests/background_audit_log.test.js",
  "tests/protected_sites.test.js",
  "tests/enterprise_policy.test.js",
  "tests/feedback_report.test.js",
  "tests/ai_assist.test.js",
  "tests/file_type_registry.test.js",
  "tests/file_extractors.test.js",
  "tests/pdf_redactor.test.js",
  "tests/docx_redactor.test.js",
  "tests/xlsx_redactor.test.js",
  "tests/file_scanner.test.js",
  "tests/scanner_ocr.test.js",
  "tests/content_file_extraction_pipeline.test.js",
  "tests/content_file_type_support.test.js",
  "tests/file_transfer_policy_gate.test.js",
  "tests/sanitized_file_batch_processor.test.js",
  "tests/file_handoff_verification.test.js",
  "tests/file_input_preparation.test.js",
  "tests/file_handoff_discovery.test.js",
  "tests/sanitized_file_handoff.test.js",
  "tests/multi_file_insert_orchestration.test.js",
  "tests/streaming_file_insert_orchestration.test.js",
  "tests/local_file_read_orchestration.test.js",
  "tests/local_file_attach_preflight_orchestration.test.js",
  "tests/local_file_sanitization_orchestration.test.js",
  "tests/sanitized_file_insert_orchestration.test.js",
  "tests/local_file_insert_orchestration.test.js",
  "tests/file_drop_orchestration.test.js",
  "tests/chatgpt_large_paste_orchestration.test.js",
  "tests/gemini_editor_paste_orchestration.test.js",
  "tests/fallback_send_key_orchestration.test.js",
  "tests/typed_secret_scan_orchestration.test.js",
  "tests/before_input_orchestration.test.js",
  "tests/submit_orchestration.test.js",
  "tests/send_button_click_orchestration.test.js",
  "tests/paste_orchestration.test.js",
  "tests/file_interception_modules.test.js",
  "tests/file_processing_ui.test.js",
  "tests/whatsapp_capabilities.test.js",
  "tests/whatsapp_text_flow.test.js",
  "tests/whatsapp_selectors.test.js",
  "tests/file_paste_helpers.test.js",
  "tests/streaming_file_redactor.test.js",
  "tests/manual_qa_artifact_safety.test.js",
  "tests/browser_qa_assertions.test.js",
  "tests/live_prompt_capture_qa_docs.test.js",
  "tests/whatsapp_live_diagnostics_guard.test.mjs",
  "tests/popup_ui.test.js",
  "tests/options_feedback_ui.test.js",
  "tests/productization.test.js",
  "tests/security.test.js",
  "tests/runtime_script_order_contract.test.js",
  "tests/runtime_script_order.test.js",
  "tests/synthetic_pack.test.js",
  "tests/adversarial_redaction.test.js",
  "tests/extreme_redaction_matrix.test.js",
  "tests/performance/redaction-benchmark-flake.test.mjs",
  "tests/performance/redaction-benchmark.mjs",
  "tests/browser/extension_qa_harness_cleanup.test.mjs",
  "tests/build_targets.test.js"
];

// Set environment variables to disable Chrome extension permission prompts in headless mode
const env = {
  ...process.env,
  // Disable interactive prompts and permission dialogs
  CHROME_HEADLESS: "1",
  // Suppress DBus errors from headless Chrome
  NO_SANDBOX: "1"
};

for (const file of testFiles) {
  const result = spawnSync(process.execPath, [file], {
    cwd: process.cwd(),
    stdio: "inherit",
    env
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
