const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/shared/streamingFileRedactor.js"));

const {
  LARGE_TEXT_STREAMING_MAX_BYTES,
  redactTextFileStream
} = globalThis.PWM.StreamingFileRedactor;

function encode(text) {
  return new TextEncoder().encode(text);
}

function createStreamingFile({ name = "large.env", type = "text/plain", text, chunkBytes = 512 * 1024 }) {
  const bytes = encode(text);
  return {
    name,
    type,
    size: bytes.byteLength,
    textCalls: 0,
    arrayBufferCalls: 0,
    async text() {
      this.textCalls += 1;
      throw new Error("streaming redaction must not call file.text()");
    },
    async arrayBuffer() {
      this.arrayBufferCalls += 1;
      throw new Error("streaming redaction must not call file.arrayBuffer()");
    },
    stream() {
      let offset = 0;
      return new ReadableStream({
        pull(controller) {
          if (offset >= bytes.byteLength) {
            controller.close();
            return;
          }
          const end = Math.min(bytes.byteLength, offset + chunkBytes);
          controller.enqueue(bytes.slice(offset, end));
          offset = end;
        }
      });
    }
  };
}

function createRedactor() {
  const manager = new globalThis.PWM.PlaceholderManager();
  const detector = new globalThis.PWM.Detector();
  const calls = [];
  return {
    calls,
    async redactText(text) {
      calls.push(text);
      const findings = detector.scan(text, { manager }).filter((finding) => finding.severity !== "low");
      return globalThis.PWM.transformOutboundPrompt(text, {
        manager,
        findings,
        mode: "hide_public"
      });
    }
  };
}

function createOutputFile({ name, type, parts }) {
  return {
    name,
    type,
    parts,
    async text() {
      return parts.join("");
    }
  };
}

async function redactFixture(text, options = {}) {
  const file = createStreamingFile({
    text,
    chunkBytes: options.chunkBytes || 64
  });
  const redactor = createRedactor();
  const result = await redactTextFileStream(file, {
    chunkSize: options.chunkSize || 64,
    overlapSize: options.overlapSize || 96,
    redactText: redactor.redactText,
    createFile: createOutputFile
  });
  const output = result.sanitizedFile ? await result.sanitizedFile.text() : "";
  return { file, redactor, result, output };
}

async function testLargeFileStreamsWithoutWholeFileRead() {
  const rawSecret = "sk-proj-STREAMING111111111111111111111111111111111111111111111";
  const filler = "safe_line=0123456789abcdef0123456789abcdef0123456789abcdef\n";
  const text = `OPENAI_API_KEY=${rawSecret}\n${filler.repeat(Math.ceil((5 * 1024 * 1024) / filler.length))}`;
  const file = createStreamingFile({ text, chunkBytes: 512 * 1024 });
  const redactor = createRedactor();
  const result = await redactTextFileStream(file, {
    redactText: redactor.redactText,
    createFile: createOutputFile
  });
  const output = await result.sanitizedFile.text();

  assert.strictEqual(result.action, "redacted");
  assert.strictEqual(file.textCalls, 0);
  assert.strictEqual(file.arrayBufferCalls, 0);
  assert.strictEqual(output.includes(rawSecret), false);
  assert.ok(output.includes("OPENAI_API_KEY=[PWM_"));
}

async function testRepeatedSecretAcrossChunksKeepsSamePlaceholder() {
  const rawSecret = "sk-proj-REPEATEDSTREAM111111111111111111111111111111111111111";
  const { output } = await redactFixture(
    `A=${rawSecret}\n${"x".repeat(512)}\nB=${rawSecret}\n`,
    { chunkSize: 80, chunkBytes: 80, overlapSize: 128 }
  );
  const placeholders = output.match(/\[PWM_\d+\]/g) || [];

  assert.strictEqual(output.includes(rawSecret), false);
  assert.ok(placeholders.length >= 2);
  assert.strictEqual(new Set(placeholders).size, 1);
}

async function testSecretSplitAcrossChunkBoundaryRedacts() {
  const rawSecret = "sk-proj-SPLITSTREAM111111111111111111111111111111111111111";
  const prefix = `OPENAI_API_KEY=${rawSecret.slice(0, 20)}`;
  const suffix = `${rawSecret.slice(20)}\nNEXT=safe\n`;
  const { output } = await redactFixture(prefix + suffix, {
    chunkSize: prefix.length,
    chunkBytes: prefix.length,
    overlapSize: 128
  });

  assert.strictEqual(output.includes(rawSecret), false);
  assert.ok(output.includes("OPENAI_API_KEY=[PWM_"));
  assert.ok(output.includes("NEXT=safe"));
}

async function testDatabaseUrlSplitAcrossChunkBoundaryRedacts() {
  const password = "StreamDbPassword123!";
  const url = `DATABASE_URL=postgres://admin:${password}@db.example.com:5432/app\n`;
  const split = url.indexOf(password) + 8;
  const { output } = await redactFixture(url, {
    chunkSize: split,
    chunkBytes: split,
    overlapSize: 128
  });

  assert.strictEqual(output.includes(password), false);
  assert.ok(/postgres:\/\/\[PWM_\d+\]:\[PWM_\d+\]@db\.example\.com/.test(output));
}

async function testPrivateKeySpanningChunksRedacts() {
  const key = [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCFAKESTREAMPRIVATEKEYDATA111111",
    "FAKESTREAMPRIVATEKEYDATA22222222222222222222222222222222222222",
    "-----END PRIVATE KEY-----"
  ].join("\n");
  const { output } = await redactFixture(`before\n${key}\nafter\n`, {
    chunkSize: 70,
    chunkBytes: 70,
    overlapSize: 96
  });

  assert.strictEqual(output.includes("FAKESTREAMPRIVATEKEYDATA"), false);
  assert.ok(output.includes("[PWM_"));
  assert.ok(output.includes("before"));
  assert.ok(output.includes("after"));
}

async function testSafeControlsRemainUnredacted() {
  const text = [
    "token_limit=4096",
    'password_hint="Use long passwords"',
    'secret_santa="office-game"'
  ].join("\n");
  const { output } = await redactFixture(text);

  assert.strictEqual(output, text);
}

async function testFiveMiBUploadFixtureRedactsShortProjectKeyAssignment() {
  const fullKey = "sk-proj-AAAA1111bbbb2222CCCC3333dddd4444eeee5555";
  const repeatedKey = "sk-proj-ZZZ111";
  const anotherKey = "sk-proj-BBB222";
  const header = [
    `full_key=${fullKey}`,
    `half_key=${repeatedKey}`,
    `backup_key=${repeatedKey}`,
    `another_key=${anotherKey}`,
    "token_limit=4096",
    "password_hint=use a password manager",
    "secret_santa=party"
  ].join("\n");
  const fillerLine = "safe_line=0123456789abcdef0123456789abcdef0123456789abcdef\n";
  const filler = fillerLine.repeat(Math.ceil((5 * 1024 * 1024) / fillerLine.length));
  const { output } = await redactFixture(`${header}\n${filler}`, {
    chunkSize: 512 * 1024,
    chunkBytes: 512 * 1024,
    overlapSize: 16 * 1024
  });

  assert.strictEqual(output.includes(fullKey), false);
  assert.strictEqual(output.includes(repeatedKey), false);
  assert.strictEqual(output.includes(anotherKey), false);
  assert.ok(/^full_key=\[PWM_\d+\]$/m.test(output));
  assert.ok(/^half_key=(\[PWM_\d+\])$/m.test(output));
  const repeatedPlaceholder = /^half_key=(\[PWM_\d+\])$/m.exec(output)?.[1];
  assert.ok(repeatedPlaceholder, "half key should redact to a placeholder");
  assert.ok(output.includes(`backup_key=${repeatedPlaceholder}`));
  assert.ok(/^another_key=\[PWM_\d+\]$/m.test(output));
  assert.ok(output.includes("token_limit=4096"));
  assert.ok(output.includes("password_hint=use a password manager"));
  assert.ok(output.includes("secret_santa=party"));
}

async function testOverFiftyMiBBlocks() {
  const file = {
    name: "too-large.log",
    type: "text/plain",
    size: LARGE_TEXT_STREAMING_MAX_BYTES + 1,
    stream() {
      throw new Error("blocked file should not be streamed");
    }
  };
  const result = await redactTextFileStream(file, {
    redactText: async () => {
      throw new Error("blocked file should not be redacted");
    },
    createFile: createOutputFile
  });

  assert.strictEqual(result.action, "blocked");
  assert.ok(result.error.includes("over 50 MB"));
}

async function testInvalidUtf8FailsClosedWithFriendlyMessage() {
  const file = {
    name: "utf16-large.env",
    type: "text/plain",
    size: 5 * 1024 * 1024,
    stream() {
      let sent = false;
      return new ReadableStream({
        pull(controller) {
          if (sent) {
            controller.close();
            return;
          }
          sent = true;
          controller.enqueue(Uint8Array.from([0xff, 0xfe, 65, 0, 66, 0]));
        }
      });
    }
  };
  const result = await redactTextFileStream(file, {
    redactText: async () => {
      throw new Error("invalid UTF-8 should fail before redaction");
    },
    createFile: createOutputFile
  });

  assert.strictEqual(result.action, "failed");
  assert.strictEqual(result.code, "invalid_utf8");
  assert.ok(result.error.includes("not valid UTF-8 text"));
  assert.strictEqual(result.error.includes("TextDecoder"), false);
  assert.strictEqual(result.sanitizedFile, undefined);
}

(async () => {
  await testLargeFileStreamsWithoutWholeFileRead();
  await testRepeatedSecretAcrossChunksKeepsSamePlaceholder();
  await testSecretSplitAcrossChunkBoundaryRedacts();
  await testDatabaseUrlSplitAcrossChunkBoundaryRedacts();
  await testPrivateKeySpanningChunksRedacts();
  await testSafeControlsRemainUnredacted();
  await testFiveMiBUploadFixtureRedactsShortProjectKeyAssignment();
  await testOverFiftyMiBBlocks();
  await testInvalidUtf8FailsClosedWithFriendlyMessage();
  console.log("PASS streaming large file redaction regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
