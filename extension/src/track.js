// Inkdex content script — counts messages + estimates tokens, writes to chrome.storage.local.
// estimate.js + storage.js are injected before this file (same isolated world → shared scope).
//
// ChatGPT uses the stable `data-message-author-role` attribute (solid). Claude regenerates class
// names, so assistant capture is layered: try specific selectors, else fall back to "the newest
// substantial text block that appeared after the user sent" — selector-independent, so a Claude DOM
// reshuffle degrades gracefully instead of silently counting zero.
// ponytail: the ultimate-robust path is intercepting Claude's SSE/fetch stream from a world:MAIN
// script; add that only if the heuristic below proves unreliable on the live site.

const SITE =
  (typeof window !== "undefined" && window.__INKDEX_SITE__) ||
  (location.hostname.includes("claude") ? "claude" : "chatgpt");

const ADAPTERS = {
  chatgpt: {
    assistantBlocks: () =>
      Array.from(document.querySelectorAll('[data-message-author-role="assistant"]')),
    userBlocks: () =>
      Array.from(document.querySelectorAll('[data-message-author-role="user"]')),
  },
  claude: {
    useSendHook: true,
    composer: () =>
      document.querySelector(
        'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]'
      ),
    conversationRoot: () =>
      document.querySelector('main, [role="main"]') || document.body,
    // specific (fast path); may go stale → generic fallback covers it
    assistantBlocks: () =>
      Array.from(
        document.querySelectorAll(
          '.font-claude-message, [data-testid="chat-message-content"], div[class*="font-claude"]'
        )
      ),
  },
};

const seen = new WeakSet();
let claudePending = null; // {text, at} set when the user sends on Claude

function record(role, text) {
  const t = (text || "").trim();
  if (!t) return;
  inkRecord(SITE, role, estimateTokens(t));
}
function recordEl(el, role) {
  if (!el || seen.has(el)) return false;
  const t = (el.innerText || "").trim();
  if (!t) return false;
  seen.add(el);
  record(role, t);
  return true;
}

// --- ChatGPT: selector-driven (both roles reliable via attribute) ---------------
function scanChatGPT() {
  for (const el of ADAPTERS.chatgpt.assistantBlocks()) recordEl(el, "assistant");
  for (const el of ADAPTERS.chatgpt.userBlocks()) recordEl(el, "user");
}

// --- Claude: resolve the assistant reply after a send ---------------------------
function resolveClaudeAssistant() {
  if (!claudePending) return;
  if (Date.now() - claudePending.at > 60000) { claudePending = null; return; } // gave up

  // 1) specific selectors (newest first)
  const specific = ADAPTERS.claude.assistantBlocks();
  for (let i = specific.length - 1; i >= 0; i--) {
    if (recordEl(specific[i], "assistant")) { claudePending = null; return; }
  }
  // 2) selector-independent fallback: newest substantial NEW block that isn't the user's echo.
  //    Keep only "leaves" (a candidate containing another candidate is a thread wrapper, not the
  //    message) — this drops the brittle nesting-count threshold and guarantees the message still
  //    counts even when Claude reshuffles its DOM.
  const root = ADAPTERS.claude.conversationRoot();
  const cands = Array.from(root.querySelectorAll("div, article, section")).filter((el) => {
    if (seen.has(el)) return false;
    const t = (el.innerText || "").trim();
    return t.length >= 20 && t !== claudePending.text;
  });
  const leaves = cands.filter((el) => !cands.some((o) => o !== el && el.contains(o)));
  const target = leaves[leaves.length - 1]; // newest leaf = the just-arrived reply
  if (target && recordEl(target, "assistant")) {
    claudePending = null;
  }
}

function scan() {
  if (SITE === "chatgpt") scanChatGPT();
  else resolveClaudeAssistant();
}

let settleTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(scan, 1500); // streaming finished when DOM is quiet ~1.5s
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// --- send-hook (reliable user counting where user DOM is fragile, e.g. Claude) --
if (ADAPTERS[SITE].useSendHook) {
  const a = ADAPTERS[SITE];
  let last = { text: "", at: 0 };
  const grab = () => {
    const c = a.composer && a.composer();
    if (!c) return;
    const t = (c.innerText || c.value || "").trim();
    if (!t) return;
    const now = Date.now();
    if (t === last.text && now - last.at < 1500) return; // dedup keydown+click
    last = { text: t, at: now };
    record("user", t);
    claudePending = { text: t, at: now };
  };
  document.addEventListener(
    "keydown",
    (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) grab(); },
    true
  );
  document.addEventListener(
    "click",
    (e) => { if (e.target.closest && e.target.closest('button[aria-label*="send" i]')) grab(); },
    true
  );
}

// --- overlay pill (Shadow DOM, isolated from site CSS) --------------------------
const host = document.createElement("div");
host.id = "inkdex-pill-host";
host.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;";
const root = host.attachShadow({ mode: "open" });
root.innerHTML = `
  <style>
    .pill{font:600 12px/1 ui-monospace,"JetBrains Mono",Menlo,monospace;
      background:#FAF7F0;color:#111;border:1.5px solid #111;border-radius:0;
      padding:8px 10px;display:flex;gap:8px;align-items:center;cursor:pointer;
      box-shadow:2px 2px 0 #FF3B12;user-select:none;letter-spacing:.02em;}
    .mark{color:#FF3B12;font-weight:800;}
    .dim{color:#6B6B6B;}
    .hidden{display:none;}
  </style>
  <div class="pill" title="Inkdex — today (estimate). Click to hide.">
    <span class="mark">✺</span><span id="n">0</span><span class="dim">msgs</span>
    <span class="dim">·</span><span id="t">0</span><span class="dim">tok</span>
  </div>`;
const pill = root.querySelector(".pill");
pill.addEventListener("click", () => pill.classList.toggle("hidden"));
(document.body || document.documentElement).appendChild(host);

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
async function refreshPill() {
  const days = await inkReadAll();
  const s = inkSum(days, 1);
  root.getElementById("n").textContent = String(s.msgs);
  root.getElementById("t").textContent = fmt(s.in + s.out);
}
chrome.storage.onChanged.addListener((c) => {
  if (c[INK_KEY]) refreshPill();
});
refreshPill();
scan(); // catch any messages already on screen at load
