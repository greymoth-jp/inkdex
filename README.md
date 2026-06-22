# Inkdex ✺

**Track your ChatGPT & Claude usage locally, then print a beautiful shareable "Wrapped" card.**
No account. No servers. Nothing leaves your browser.

<p align="center"><img src="media/hero.png" width="640" alt="Inkdex — AI usage Wrapped card"></p>

A monochrome, risograph-editorial Chrome extension (Manifest V3). It counts your messages on
`claude.ai` and `chatgpt.com`, estimates tokens & cost client-side, shows a tiny live overlay, and
one-click generates a print-style usage card you can download or copy.

> **Estimates, not billing.** Token & cost figures are client-side approximations (browsers expose
> no billing API). They are labeled as estimates everywhere.

## Install (load unpacked — dev)
1. `chrome://extensions` → toggle **Developer mode** (top right).
2. **Load unpacked** → select the `extension/` folder.
3. Open `claude.ai` or `chatgpt.com`, chat as usual. A small **✺ pill** shows today's count.
4. Click the toolbar icon → see stats → **PRINT WRAPPED CARD** → Download / Copy.

## What it stores
Everything lives in `chrome.storage.local` under one key (`inkdex:days`), as per-day buckets:
`{ "YYYY-MM-DD": { claude:{msgs,in,out}, chatgpt:{msgs,in,out} } }`. There is no network code in
this extension (verified: zero `fetch`/`XHR`/`sendBeacon`).

## Permissions (minimal)
- `storage` — save your counts locally.
- `clipboardWrite` — "Copy image" of the card (Download works without it).
- host access to `claude.ai`, `chatgpt.com`, `chat.openai.com` only — to read message text for counting.

## Layout
```
extension/
  manifest.json
  popup.html / popup.css / popup.js     ← stats + card generator
  src/estimate.js                       ← token/cost estimation (heuristic)
  src/storage.js                        ← local day-bucket storage
  src/track.js                          ← content script: count + overlay pill
  src/card.js                           ← canvas Wrapped-card renderer
  fonts/  (Space Grotesk, JetBrains Mono — OFL)
  icons/  (16/48/128)
_docs/  ← requirements, distribution plan, design proofs
```

## Known limitation (honest)
Claude's assistant-message DOM uses regenerated class names; assistant counting on `claude.ai` is
best-effort (specific selectors, then a selector-independent fallback) and may need a tweak when
their DOM shifts. ChatGPT uses the stable `data-message-author-role` attribute and is solid. User
counting on Claude uses the send action, so it degrades gracefully.

## License
Code: MIT. Fonts: SIL Open Font License (Space Grotesk, JetBrains Mono).
