const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "../src/content/rehydration/placeholderRehydrator.js"));

const {
  placeholderSessionIndex,
  isPlaceholderTrustedForSession,
  tokenizePlaceholderText
} = globalThis.PWM.PlaceholderRehydrator;

const options = {
  placeholderTokenRegex: /\[(?:PWM|NET|PUB_HOST|PRIVATE_IP|AZURE_RG|EMAIL|FAKE_SECRET)_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?\]/g,
  normalizeVisiblePlaceholders: (value) => String(value || ""),
  canonicalizePlaceholderToken: (value) => String(value || "")
};

function testPlaceholderSessionIndex() {
  assert.strictEqual(placeholderSessionIndex("[PWM_1]"), 1);
  assert.strictEqual(placeholderSessionIndex("[PWM_12]"), 12);
  assert.strictEqual(placeholderSessionIndex("[NET_1]"), 1);
  assert.strictEqual(placeholderSessionIndex("[NET_12_SUB_2_HOST_3]"), 12);
  assert.strictEqual(placeholderSessionIndex("[NET_12_GW]"), 12);
  assert.strictEqual(placeholderSessionIndex("[PUB_HOST_1]"), 1);
  assert.strictEqual(placeholderSessionIndex("[PUB_HOST_12_SUB_2_DNS]"), 12);
  assert.strictEqual(placeholderSessionIndex("[PRIVATE_IP_4]"), 4);
  assert.strictEqual(placeholderSessionIndex("[AZURE_RG_12]"), 12);
  assert.strictEqual(placeholderSessionIndex("[UNKNOWN_1]"), 1);
  assert.strictEqual(placeholderSessionIndex("[PWM_X]"), null);
  assert.strictEqual(placeholderSessionIndex("PWM_1"), null);
}

function testPlaceholderTrust() {
  assert.strictEqual(isPlaceholderTrustedForSession("[PWM_1]", 1), true);
  assert.strictEqual(isPlaceholderTrustedForSession("[PWM_12]", 12), true);
  assert.strictEqual(isPlaceholderTrustedForSession("[NET_2]", 3), true);
  assert.strictEqual(isPlaceholderTrustedForSession("[PUB_HOST_3]", 3), true);
  assert.strictEqual(isPlaceholderTrustedForSession("[PWM_2]", 1), false);
  assert.strictEqual(isPlaceholderTrustedForSession("[NET_12]", 3), false);
  assert.strictEqual(isPlaceholderTrustedForSession("[PUB_HOST_12]", 3), false);
  assert.strictEqual(isPlaceholderTrustedForSession("[UNKNOWN_1]", 3), false);
  assert.strictEqual(isPlaceholderTrustedForSession("[PWM_1]", 0), false);
}

function testTokenizePreservesPlainText() {
  assert.deepStrictEqual(tokenizePlaceholderText("plain text", options), [
    {
      type: "text",
      value: "plain text"
    }
  ]);
}

function testTokenizeLeavesUnknownPlaceholdersAsPlainText() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("before [PWM_3] after", {
      ...options,
      placeholderCount: 2
    }),
    [
      {
        type: "text",
        value: "before "
      },
      {
        type: "text",
        value: "[PWM_3]"
      },
      {
        type: "text",
        value: " after"
      }
    ]
  );
}

function testTokenizeMarksTrustedPlaceholdersHydratable() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("before [PWM_2] and [NET_1_GW] after", {
      ...options,
      placeholderCount: 2
    }),
    [
      {
        type: "text",
        value: "before "
      },
      {
        type: "secret",
        placeholder: "[PWM_2]"
      },
      {
        type: "text",
        value: " and "
      },
      {
        type: "secret",
        placeholder: "[NET_1_GW]"
      },
      {
        type: "text",
        value: " after"
      }
    ]
  );
}

function testTokenizeHydratesTrustedTypedPlaceholders() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("IP [PRIVATE_IP_1]", {
      ...options,
      trustedPlaceholders: ["[PRIVATE_IP_1]"]
    }),
    [
      {
        type: "text",
        value: "IP "
      },
      {
        type: "secret",
        placeholder: "[PRIVATE_IP_1]"
      }
    ]
  );
}

function testTokenizeHydratesKnownTypedPlaceholders() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("RG [AZURE_RG_1]", {
      ...options,
      knownPlaceholders: ["[AZURE_RG_1]"]
    }),
    [
      {
        type: "text",
        value: "RG "
      },
      {
        type: "secret",
        placeholder: "[AZURE_RG_1]"
      }
    ]
  );
}

function testTokenizeLeavesUntrustedTypedPlaceholdersPlain() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("fake [PRIVATE_IP_999]", {
      ...options,
      trustedPlaceholders: []
    }),
    [
      {
        type: "text",
        value: "fake "
      },
      {
        type: "text",
        value: "[PRIVATE_IP_999]"
      }
    ]
  );
}

function testTokenizeHydratesMixedSessionAndTrustedTypedPlaceholders() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("[PWM_1] [PRIVATE_IP_1] [AZURE_RG_1] [EMAIL_1]", {
      ...options,
      placeholderCount: 1,
      trustedPlaceholders: ["[PRIVATE_IP_1]", "[AZURE_RG_1]", "[EMAIL_1]"]
    }),
    [
      {
        type: "secret",
        placeholder: "[PWM_1]"
      },
      {
        type: "text",
        value: " "
      },
      {
        type: "secret",
        placeholder: "[PRIVATE_IP_1]"
      },
      {
        type: "text",
        value: " "
      },
      {
        type: "secret",
        placeholder: "[AZURE_RG_1]"
      },
      {
        type: "text",
        value: " "
      },
      {
        type: "secret",
        placeholder: "[EMAIL_1]"
      }
    ]
  );
}

function testCanonicalTrustedTypedPlaceholderHydrates() {
  assert.deepStrictEqual(
    tokenizePlaceholderText("legacy [AZURE_RG_1] fake [FAKE_SECRET_999]", {
      ...options,
      trustedPlaceholders: [" [AZURE_RG_1] "],
      canonicalizePlaceholderToken: (value) => String(value || "").trim()
    }),
    [
      {
        type: "text",
        value: "legacy "
      },
      {
        type: "secret",
        placeholder: "[AZURE_RG_1]"
      },
      {
        type: "text",
        value: " fake "
      },
      {
        type: "text",
        value: "[FAKE_SECRET_999]"
      }
    ]
  );
}

testPlaceholderSessionIndex();
testPlaceholderTrust();
testTokenizePreservesPlainText();
testTokenizeLeavesUnknownPlaceholdersAsPlainText();
testTokenizeMarksTrustedPlaceholdersHydratable();
testTokenizeHydratesTrustedTypedPlaceholders();
testTokenizeHydratesKnownTypedPlaceholders();
testTokenizeLeavesUntrustedTypedPlaceholdersPlain();
testTokenizeHydratesMixedSessionAndTrustedTypedPlaceholders();
testCanonicalTrustedTypedPlaceholderHydrates();

console.log("PASS placeholder rehydrator pure helper regressions");
