// Concatenates stubs + the real game modules + tests, then runs the result.
// Usage (from repo root):  node tools/headless/run.js
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const root = path.join(__dirname, "..", "..");
const ORDER = ["tuning","audio","core","physics","player","enemies","bosses","world","overworld","ui","main"];
let src = fs.readFileSync(path.join(__dirname, "stubs.js"), "utf-8");
for (const m of ORDER) {
  let code = fs.readFileSync(path.join(root, "js", m + ".js"), "utf-8");
  code = code.replace(/^"use strict";/m, "");
  // the harness drives update()/render() itself
  if (m === "main") code = code.replace("requestAnimationFrame(loop);", "/* loop driven by tests */");
  src += "\n/* ===== js/" + m + ".js ===== */\n" + code;
}
const suite = process.argv[2] || "tests.js";
src += "\n" + fs.readFileSync(path.join(__dirname, suite), "utf-8");
const out = path.join(__dirname, "_bundle_" + suite);
fs.writeFileSync(out, src);
try {
  execSync(`node "${out}"`, { stdio: "inherit", cwd: root });
} catch (e) {
  process.exit(e.status || 1);
}
