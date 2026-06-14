// Headless browser stubs so the real game modules run under Node.
const fs = require("fs");
const ctxStub = new Proxy({}, {
  // memoize the noop per property: a fresh closure per canvas call makes
  // 50k-frame bot runs allocation-bound
  get: (t, p) => {
    if (p in t) return t[p];
    // measureText returns a TextMetrics object in the real canvas; the engine
    // reads .width (e.g. world.js drawPrompt), so the stub must too
    if (p === "measureText") return (t[p] = () => ({ width: 0 }));
    return (t[p] = () => {});
  },
  set: (t, p, v) => { t[p] = v; return true; },
});
globalThis.document = { getElementById: () => ({ getContext: () => ctxStub, width: 0, height: 0 }), title: "" };
globalThis.window = { addEventListener: () => {} };
globalThis.requestAnimationFrame = () => {};
globalThis.fetch = async (path) => ({ json: async () => JSON.parse(fs.readFileSync(path, "utf-8")) });
globalThis.Image = class { set src(v) { queueMicrotask(() => this.onload && this.onload()); } };
const _store = {};
globalThis.localStorage = {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
};
