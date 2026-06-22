// Inkdex — client-side token + cost ESTIMATION (no billing API exists in-browser).
// ponytail: char-ratio heuristic, not a real tokenizer. A bundled tokenizer (tiktoken wasm
// ~1MB) would be more accurate; upgrade only if users report the estimate feels wrong.

// Per-model rough $/1M tokens (input, output). ESTIMATES — update as pricing moves.
const RATES = {
  "claude":  { in: 3.0,  out: 15.0 }, // Claude (Sonnet-class) ballpark
  "chatgpt": { in: 2.5,  out: 10.0 }, // GPT-4o-class ballpark
  "default": { in: 3.0,  out: 12.0 },
};

// Estimate tokens for a chunk of text.
// Prose ≈ 4 chars/token; code/symbol-dense text packs more tokens ≈ 3 chars/token.
function estimateTokens(text) {
  if (!text) return 0;
  const chars = text.length;
  if (chars === 0) return 0;
  // symbol density: fraction of non-alphanumeric, non-space chars
  const symbols = (text.match(/[^\w\s]/g) || []).length;
  const density = symbols / chars;
  const codey = density > 0.18 || text.includes("```");
  const ratio = codey ? 3 : 4;
  return Math.max(1, Math.ceil(chars / ratio));
}

// Estimate USD cost. site = "claude" | "chatgpt".
function estimateCost(inTokens, outTokens, site) {
  const r = RATES[site] || RATES.default;
  return (inTokens / 1e6) * r.in + (outTokens / 1e6) * r.out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { estimateTokens, estimateCost, RATES };
}

// --- self-check (node: `node estimate.js`) -------------------------------------
if (typeof require !== "undefined" && require.main === module) {
  const assert = require("assert");
  assert.strictEqual(estimateTokens(""), 0, "empty = 0");
  assert.strictEqual(estimateTokens(null), 0, "null = 0");
  // ~40 chars of prose -> ~10 tokens (chars/4)
  const prose = "The quick brown fox jumps over a lazy dog";
  assert.strictEqual(estimateTokens(prose), Math.ceil(prose.length / 4), "prose ratio 4");
  // code block -> denser ratio 3
  const code = "for(let i=0;i<n;i++){arr[i]=i*2;} // {}[]<>";
  assert.strictEqual(estimateTokens(code), Math.ceil(code.length / 3), "code ratio 3");
  // triple-backtick forces code ratio
  assert.ok(estimateTokens("```\nhi\n```") >= Math.ceil(9 / 3) - 1);
  // cost is positive and output costs more than input for same tokens
  assert.ok(estimateCost(1e6, 0, "claude") === 3.0, "claude input rate");
  assert.ok(estimateCost(0, 1e6, "claude") === 15.0, "claude output rate");
  assert.ok(estimateCost(0, 1e6, "unknownsite") > 0, "unknown site falls back");
  console.log("estimate.js self-check: PASS");
}
