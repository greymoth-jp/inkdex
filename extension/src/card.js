// Inkdex — Wrapped card renderer. Risograph editorial "AI usage receipt/almanac".
// renderInkdexCard(canvas, data) draws a 1080x1350 share card. Fonts must be loaded first
// (popup.js awaits document.fonts.ready). Degrades to fallback fonts if Space Grotesk missing.

const INK = "#111111";
const PAPER = "#FAF7F0";
const ACCENT = "#FF3B12";
const DIM = "#6B6B6B";
const W = 1080, H = 1350, M = 90;

const DISP = '"Space Grotesk", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function commas(n) { return Math.round(n).toLocaleString("en-US"); }
function kfmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";
  return commas(n);
}
function money(n) { return "$" + n.toFixed(2); }

function fitFont(ctx, text, weight, maxWidth, startPx) {
  let size = startPx;
  do {
    ctx.font = `${weight} ${size}px ${DISP}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 24);
  return size;
}

function dottedLeader(ctx, x1, x2, y) {
  ctx.save();
  ctx.fillStyle = DIM;
  for (let x = x1; x < x2; x += 10) { ctx.fillRect(x, y, 2, 2); }
  ctx.restore();
}

function paperNoise(ctx) {
  // cheap grain: sparse faint ink specks. ponytail: good enough; a real riso texture would tile a PNG.
  ctx.save();
  ctx.fillStyle = "rgba(17,17,17,0.04)";
  let s = 1234567; // deterministic pseudo-random (no Math.random needed)
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
  ctx.restore();
}

function ledgerRow(ctx, y, label, value, accentValue) {
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 26px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(label, M, y);
  const lw = ctx.measureText(label).width;
  ctx.font = `500 30px ${DISP}`;
  ctx.textAlign = "right";
  const vw = ctx.measureText(value).width;
  dottedLeader(ctx, M + lw + 16, W - M - vw - 16, y - 8);
  if (accentValue) {
    ctx.fillStyle = ACCENT;
    ctx.fillText(value, W - M + 3, y - 3); // misregistration ghost
    ctx.fillStyle = INK;
  }
  ctx.fillStyle = INK;
  ctx.fillText(value, W - M, y);
}

// data: { periodLabel, dateStr, msgs, inTok, outTok, cost, claudeMsgs, chatgptMsgs, topSite }
function renderInkdexCard(canvas, d) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // paper
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `700 38px ${MONO}`;
  ctx.fillText("INKDEX", M, 120);
  ctx.textAlign = "right";
  ctx.fillStyle = ACCENT;
  ctx.font = `700 38px ${DISP}`;
  ctx.fillText("✺", W - M, 122);
  // top rule (thick)
  ctx.fillStyle = INK;
  ctx.fillRect(M, 150, W - 2 * M, 5);
  // sub labels
  ctx.font = `400 22px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.fillText(`AI USAGE · ${d.periodLabel.toUpperCase()}`, M, 196);
  ctx.textAlign = "right";
  ctx.fillText(d.dateStr, W - M, 196);

  // hero number (misregistration). Cap size so tall digits never collide with the sublabels.
  const hero = commas(d.msgs);
  const size = fitFont(ctx, hero, 700, W - 2 * M, 250);
  ctx.font = `700 ${size}px ${DISP}`;
  ctx.textAlign = "left";
  const heroY = 470;
  ctx.fillStyle = ACCENT;
  ctx.fillText(hero, M + 6, heroY + 6);           // riso ghost
  ctx.fillStyle = INK;
  ctx.fillText(hero, M, heroY);                    // ink on top
  // hero label
  ctx.font = `700 30px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText("M E S S A G E S", M, heroY + 58);
  ctx.font = `400 24px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText("to ChatGPT & Claude", M, heroY + 94);

  // kicker — emotional narrative (fills space; the line competitors don't have)
  const words = Math.round((d.inTok + d.outTok) * 0.75);
  const perDay = d.periodDays ? Math.round(d.msgs / d.periodDays) : null;
  ctx.fillStyle = INK; ctx.fillRect(M, heroY + 134, W - 2 * M, 2);
  ctx.font = `400 25px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(perDay != null ? `≈ ${perDay} / DAY` : `${hero} TOTAL`, M, heroY + 180);
  ctx.textAlign = "right";
  ctx.fillStyle = DIM;
  ctx.fillText(`~${kfmt(words)} words read & written`, W - M, heroY + 180);

  // ledger
  let y = 740;
  ledgerRow(ctx, y, "CLAUDE", commas(d.claudeMsgs) + " msgs"); y += 60;
  ledgerRow(ctx, y, "CHATGPT", commas(d.chatgptMsgs) + " msgs"); y += 60;
  // thin divider
  ctx.fillStyle = INK; ctx.fillRect(M, y - 20, W - 2 * M, 2); y += 26;
  ledgerRow(ctx, y, "EST. TOKENS IN", kfmt(d.inTok)); y += 60;
  ledgerRow(ctx, y, "EST. TOKENS OUT", kfmt(d.outTok)); y += 60;
  ledgerRow(ctx, y, "EST. COST", money(d.cost), true);

  // perforation (tear line)
  const perfY = 1055;
  ctx.fillStyle = INK;
  for (let x = M; x < W - M; x += 22) { ctx.beginPath(); ctx.arc(x, perfY, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.font = `400 18px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "center";
  ctx.fillText("— — — — — — — — —   tear & share   — — — — — — — — —", W / 2, perfY - 24);

  // stub: disclaimer (cold-honest: estimate, not billing) + footer brand + growth link
  ctx.textAlign = "left";
  ctx.font = `400 21px ${MONO}`;
  ctx.fillStyle = DIM;
  ctx.fillText("✺ ESTIMATE — client-side approximation, not billing data.", M, 1118);
  ctx.fillText("nothing left your browser to make this.", M, 1149);

  // footer brand / growth mark
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${MONO}`;
  ctx.fillText("INKDEX", M, 1258);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(M, 1276, 190, 5);
  ctx.fillStyle = INK;
  ctx.font = `400 24px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText("print your AI month →", W - M, 1250);
  ctx.fillStyle = DIM;
  ctx.font = `400 20px ${MONO}`;
  ctx.fillText("inkdex extension · chrome", W - M, 1280);

  // grain overlay last
  paperNoise(ctx);
  return canvas;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { kfmt, commas, money };
}
if (typeof require !== "undefined" && require.main === module) {
  const assert = require("assert");
  assert.strictEqual(commas(2847), "2,847");
  assert.strictEqual(kfmt(1200000), "1.2M");
  assert.strictEqual(kfmt(12300), "12k");
  assert.strictEqual(kfmt(950), "950");
  assert.strictEqual(money(4.2), "$4.20");
  console.log("card.js self-check: PASS");
}
