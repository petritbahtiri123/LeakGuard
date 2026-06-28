export function shouldAbortForInitialComposer(initial) {
  const normalizedText = String(initial?.normalizedText || "");
  const hasVisibleText = initial?.visualEmpty === false || normalizedText.trim().length > 0;
  const hasNonLgqaRedaction = normalizedText.includes("[REDACTED_NON_LGQA_TEXT");
  const lgqaCandidateText = normalizedText.replace(/\[REDACTED_NON_LGQA_TEXT[^\]]*\]/g, "");

  if (!hasVisibleText) {
    return false;
  }
  if (hasNonLgqaRedaction) {
    return true;
  }
  return !lgqaCandidateText.includes("LGQA_");
}
