# LeakGuard ChatGPT Multiline Firefox Fix - Complete Summary

## Issue
ChatGPT in Firefox was not properly handling multiline text input. When users pasted or inserted text containing newlines, only the first line would appear in the ChatGPT composer. The same functionality worked correctly for Grok and Gemini.

## Root Cause
The `tryChatGptDirectWrite` function in `src/content/content.js` (line 4040) was dispatching an input event with `null` data instead of the actual text being inserted.

**Before the fix:**
```javascript
function tryChatGptDirectWrite(input, writeText, options = {}) {
  suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
  focusChatGptComposer(input);
  const written = setInputTextDirect(input, writeText, {
    caretOffset: options.caretOffset
  });
  if (!written) return false;
  dispatchChatGptComposerInputEvent(input, "insertReplacementText", null);  // BUG: null instead of writeText
  dispatchChatGptComposerChange(input);
  return true;
}
```

## Why This Caused the Issue
1. `setInputTextDirect` calls `writePlainTextToContentEditablePreservingNewlines` which properly inserts multiline text with BR nodes
2. However, the input event dispatched with `null` data means React's synthetic event system doesn't receive the actual text
3. React cannot sync its internal state with the actual DOM content
4. React's state remains out of sync, causing only the first line to be recognized

## The Fix
Changed line 4040 to pass `writeText` instead of `null`:

```javascript
dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);
```

**After the fix:**
```javascript
function tryChatGptDirectWrite(input, writeText, options = {}) {
  suppressFollowupInputScan(options.suppressMs || PROGRAMMATIC_INPUT_SUPPRESS_MS);
  focusChatGptComposer(input);
  const written = setInputTextDirect(input, writeText, {
    caretOffset: options.caretOffset
  });
  if (!written) return false;
  dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);  // FIXED: pass writeText
  dispatchChatGptComposerChange(input);
  return true;
}
```

## How The Fix Works
1. React now receives the actual text data in the synthetic event
2. React's internal state syncs properly with the DOM content
3. Multiline text with newlines is preserved correctly
4. The fix brings ChatGPT's behavior into alignment with how `tryChatGptExecCommandWrite` already handles it (line 4028)

## Safety
The fix is completely safe because:
- `dispatchChatGptComposerInputEvent` internally checks if `data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS`
- If text exceeds 256KB, it internally converts to `null` anyway
- This maintains the same size-limiting behavior while fixing the multiline issue

## Files Changed
- `src/content/content.js` - Line 4040

## Consistency
This change makes the ChatGPT sync strategy consistent with:
- `tryChatGptExecCommandWrite` (line 4028) which also passes `writeText`
- `setInputText` used by Grok/Gemini which internally dispatches events with proper data
- Browser standards for input events which expect event.data to contain the inserted text

## Impact
- ✅ ChatGPT on Firefox now properly handles multiline text input
- ✅ No breaking changes to existing code
- ✅ Maintains consistency with other browser hosts (Grok, Gemini)
- ✅ Preserves all safety features (size limits, event handling)
- ✅ Single line change with minimal risk
