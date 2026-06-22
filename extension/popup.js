// Inkdex popup — reads local storage, renders stats + the Wrapped card.

let period = 1;
const PERIOD_LABEL = { 1: "Today", 7: "Last 7 days", 30: "Last 30 days" };

function kfmtUI(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";
  return Math.round(n).toLocaleString("en-US");
}

async function stats() {
  const days = await inkReadAll();
  const s = inkSum(days, period);
  const cost =
    estimateCost(s.claude.in, s.claude.out, "claude") +
    estimateCost(s.chatgpt.in, s.chatgpt.out, "chatgpt");
  return { s, cost };
}

async function render() {
  const { s, cost } = await stats();
  document.getElementById("heroN").textContent = s.msgs.toLocaleString("en-US");
  document.getElementById("cClaude").textContent = s.claude.msgs.toLocaleString("en-US");
  document.getElementById("cGpt").textContent = s.chatgpt.msgs.toLocaleString("en-US");
  document.getElementById("cTok").textContent = kfmtUI(s.in + s.out);
  document.getElementById("cCost").textContent = "$" + cost.toFixed(2);
}

function buildCardData(s, cost) {
  const now = new Date();
  const dateStr =
    period === 1
      ? now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : `${period} DAYS → ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return {
    periodLabel: PERIOD_LABEL[period],
    dateStr,
    msgs: s.msgs,
    inTok: s.in,
    outTok: s.out,
    cost,
    claudeMsgs: s.claude.msgs,
    chatgptMsgs: s.chatgpt.msgs,
  };
}

let lastBlob = null;
function setStatus(t) { document.getElementById("status").textContent = t || ""; }

async function makeCard() {
  setStatus("rendering…");
  const { s, cost } = await stats();
  try { await document.fonts.ready; } catch (_) {}
  const canvas = document.getElementById("preview");
  renderInkdexCard(canvas, buildCardData(s, cost));
  canvas.style.display = "block";
  document.getElementById("cardRow").classList.remove("hidden");
  canvas.toBlob((b) => { lastBlob = b; setStatus(s.msgs ? "" : "no usage yet — chat first, then print."); }, "image/png");
}

function filename() {
  const d = new Date().toISOString().slice(0, 10);
  return `inkdex-${period}d-${d}.png`;
}

function download() {
  if (!lastBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(lastBlob);
  a.download = filename();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  setStatus("saved.");
}

async function copy() {
  if (!lastBlob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": lastBlob })]);
    setStatus("copied to clipboard.");
  } catch (e) {
    setStatus("copy blocked — use Download instead.");
  }
}

document.getElementById("toggle").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-d]");
  if (!b) return;
  period = +b.dataset.d;
  for (const x of document.querySelectorAll("#toggle button")) x.classList.toggle("on", x === b);
  render();
});
document.getElementById("make").addEventListener("click", makeCard);
document.getElementById("dl").addEventListener("click", download);
document.getElementById("copy").addEventListener("click", copy);

render();
