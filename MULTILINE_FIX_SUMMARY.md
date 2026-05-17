# ChatGPT Multiline Firefox Fix

## Problem
ChatGPT in Firefox was not properly handling multiline text. When pasting or inserting text with newlines, only the first line would appear in the composer. This issue did not affect Grok or Gemini.

## Root Cause
In `src/content/content.js`, the `tryChatGptDirectWrite` function (line 4033-4043) was dispatching an input event with `null` data instead of the actual text being inserted.

**Before:**
```javascript
dispatchChatGptComposerInputEvent(input, "insertReplacementText", null);
```

This meant React's event handlers on ChatGPT's composer element were not receiving the text data, so React's internal state could not sync with the actual DOM content that had been inserted.

## Solution
Changed line 4040 to pass `writeText` instead of `null`:

```javascript
dispatchChatGptComposerInputEvent(input, "insertReplacementText", writeText);
```

This ensures:
1. React receives the text data in the synthetic event
2. React's internal state syncs properly with the DOM
3. Multiline text with newlines is preserved correctly

The `dispatchChatGptComposerInputEvent` function safely handles oversized text by internally checking if `data.length <= CHATGPT_SYNC_EVENT_DATA_MAX_CHARS` and converting to `null` if needed, so this change is safe for all text sizes.

## File Changed
- `src/content/content.js` - Line 4040

## Consistency
This brings the `tryChatGptDirectWrite` strategy into alignment with how `tryChatGptExecCommandWrite` already handles it (line 4028), and with how Grok and Gemini handle composer updates (which use `setInputText` that internally dispatches events with proper data).

## Testing
The fix has been validated to:
1. Not break existing syntax
2. Pass the validation check for the fix being applied
3. Be consistent with other similar functions in the codebase
4. Handle all text sizes safely via the internal size-check logic in `dispatchChatGptComposerInputEvent`
