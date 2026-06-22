// Inkdex — local-only storage. Everything lives in chrome.storage.local; nothing is sent anywhere.
// Schema: { "inkdex:days": { "YYYY-MM-DD": { claude:{msgs,in,out}, chatgpt:{msgs,in,out} } } }

const INK_KEY = "inkdex:days";

function inkDayKey(d) {
  // local date YYYY-MM-DD
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inkEmptyBucket() {
  return { msgs: 0, in: 0, out: 0 };
}

// role: "user" | "assistant"; site: "claude" | "chatgpt"
// Serialize writes: chrome.storage.local read-modify-write is racy under rapid messages
// (two concurrent calls read the same state, last write wins → lost increments). The chain makes
// each record atomic. ponytail: a per-key chain is plenty; revisit only if writes get hot.
let _inkChain = Promise.resolve();
function inkRecord(site, role, tokens) {
  _inkChain = _inkChain.catch(() => {}).then(() => _inkRecordOnce(site, role, tokens));
  return _inkChain;
}
async function _inkRecordOnce(site, role, tokens) {
  const all = await inkReadAll();
  const k = inkDayKey();
  all[k] = all[k] || {};
  all[k][site] = all[k][site] || inkEmptyBucket();
  const b = all[k][site];
  b.msgs += 1;
  if (role === "user") b.in += tokens;
  else b.out += tokens;
  await new Promise((res) => chrome.storage.local.set({ [INK_KEY]: all }, res));
}

function inkReadAll() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return Promise.resolve((typeof window !== "undefined" && window.__INKDEX_DEMO__) || {});
  }
  return new Promise((res) =>
    chrome.storage.local.get(INK_KEY, (o) => res((o && o[INK_KEY]) || {}))
  );
}

// Pure: sum the last nDays buckets (days = the schema object). Returns combined totals + per-site.
function inkSum(days, nDays, today) {
  const out = { msgs: 0, in: 0, out: 0, claude: inkEmptyBucket(), chatgpt: inkEmptyBucket() };
  const base = today || new Date();
  for (let i = 0; i < nDays; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const bucket = days[inkDayKey(d)];
    if (!bucket) continue;
    for (const site of ["claude", "chatgpt"]) {
      const b = bucket[site];
      if (!b) continue;
      out.msgs += b.msgs; out.in += b.in; out.out += b.out;
      out[site].msgs += b.msgs; out[site].in += b.in; out[site].out += b.out;
    }
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { inkDayKey, inkSum, inkEmptyBucket };
}

// --- self-check (node) ---------------------------------------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = require("assert");
  const today = new Date("2026-06-22T12:00:00");
  assert.strictEqual(inkDayKey(today), "2026-06-22");
  const days = {
    "2026-06-22": { claude: { msgs: 2, in: 10, out: 30 }, chatgpt: { msgs: 1, in: 5, out: 0 } },
    "2026-06-20": { claude: { msgs: 1, in: 4, out: 8 } },
    "2026-05-01": { claude: { msgs: 9, in: 99, out: 99 } }, // outside 7d/30d windows
  };
  const d1 = inkSum(days, 1, today);
  assert.strictEqual(d1.msgs, 3, "today msgs"); // 2+1
  assert.strictEqual(d1.out, 30, "today out");
  const d7 = inkSum(days, 7, today);
  assert.strictEqual(d7.msgs, 4, "7d msgs"); // includes 06-20
  assert.strictEqual(d7.claude.msgs, 3, "7d claude msgs");
  const d30 = inkSum(days, 30, today);
  assert.strictEqual(d30.msgs, 4, "30d excludes 05-01 (>30d back)");
  console.log("storage.js self-check: PASS");
}
