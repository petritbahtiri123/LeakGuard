const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");

require(path.join(repoRoot, "src/shared/detection/urlUserinfo.js"));

const UrlUserinfo = globalThis.PWM.DetectionUrlUserinfo;

const text = "Use postgres://admin:p%40ssw0rd@db.example.internal:5432/app and ignore mailto:user@example.com";
const candidates = UrlUserinfo.collectUrlUserinfoCandidates(text);

assert.strictEqual(candidates.length, 1);
assert.deepStrictEqual(
  {
    scheme: candidates[0].scheme,
    hostport: candidates[0].hostport,
    usernameRaw: candidates[0].usernameRaw,
    username: candidates[0].username,
    passwordRaw: candidates[0].passwordRaw,
    password: candidates[0].password,
    usernameStart: candidates[0].usernameStart,
    usernameEnd: candidates[0].usernameEnd,
    passwordStart: candidates[0].passwordStart,
    passwordEnd: candidates[0].passwordEnd
  },
  {
    scheme: "postgres",
    hostport: "db.example.internal:5432",
    usernameRaw: "admin",
    username: "admin",
    passwordRaw: "p%40ssw0rd",
    password: "p@ssw0rd",
    usernameStart: 15,
    usernameEnd: 20,
    passwordStart: 21,
    passwordEnd: 31
  }
);

assert.strictEqual(UrlUserinfo.isDbUriWithCredentials("redis://default:s3cret@localhost:6379"), true);
assert.strictEqual(UrlUserinfo.isDatabaseUrlUserinfoScheme("https"), false);
assert.strictEqual(UrlUserinfo.isDatabaseUrlUserinfoScheme("mongodb+srv"), true);
assert.strictEqual(UrlUserinfo.parseUrlUserinfoToken("mailto:user@example.com", 0), null);
assert.strictEqual(UrlUserinfo.parseUrlUserinfoToken("https://token@example.com", 0), null);
assert.strictEqual(UrlUserinfo.safeDecodeURIComponent("%E0%A4%A"), "%E0%A4%A");

console.log("PASS url userinfo helpers");
