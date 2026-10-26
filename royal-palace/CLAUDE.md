# Royal Palace (القصر الملكي) – digital menu + cashier

Demo project for مجمع القصر الملكي in Mosul (Instagram: roy_alpalace). Owner of this repo: 3bod (عبدالله).
Reply to him in Iraqi Arabic, short and direct.

## Files
| Path | What it is |
|---|---|
| `src/template.html` | **Edit this.** Whole app (menu + cashier) in one file. Images are placeholders `%%IMG:logo%%`, `%%IMG:hero%%`, `%%IMGMAP%%`. |
| `src/images.json` | All photos as base64 data URIs (logo, hero, 23 dishes). Keys = item ids in `ITEMS`. |
| `src/build.py` | `python3 royal-palace/src/build.py` → writes `docs/royal-palace/index.html`. |
| `src/qr.py` | `python3 royal-palace/src/qr.py [--png]` → writes `docs/royal-palace/qr/index.html` (needs `pip install segno pillow`). |
| `../docs/royal-palace/index.html` | Built output – the live menu. Never hand-edit; rebuild. |
| `../docs/royal-palace/qr/index.html` | Built QR cards page (1 general code + 24 table codes). |

Live (GitHub Pages serves the repo's **`/docs` folder** on `main` – outputs must go to `docs/`):
- Menu: https://qwdfegthikkcom-create.github.io/swalf-menu/royal-palace/
- Table link: `…/royal-palace/?table=7` (also `#t7`) opens straight to that table.
- QR page: https://qwdfegthikkcom-create.github.io/swalf-menu/royal-palace/qr/

## Workflow
1. Edit `src/template.html` (menu items are the `ITEMS` array; categories `CATS`; `TABLES=24`).
2. New dish photo → add a base64 JPEG (≈460×460, q≈82) to `src/images.json` under the item id.
3. Run `src/build.py` (and `src/qr.py` only if the URL or table count changed), then commit + push to `main`.
4. Test in a headless browser before pushing (Playwright is fine): open with `?table=7`, add items, send order, switch to الكاشير, check it arrived; check no console errors.

## Features (done)
- Table gate on open (hall 1–15, terrace 16–24), table pill in top bar, `?table=` deep link.
- Menu: 7 categories, sticky category bar with scroll-spy, search, featured row, item sheet (remove ingredients, note, qty), cart, send order, order tracker.
- Table service: نداء النادل (reasons + note) and طلب الفاتورة (bill view, cash/card) with floating bell button.
- Cashier: stats, kanban (new → prep → ready → awaiting payment), sound alerts, call/bill cards, table map, menu availability toggles, archive, receipt print, demo order/call buttons.

## Known limits / next steps
- **Sync is localStorage only** – orders/calls reach the cashier only on the same device/browser. Customer phones (QR) need real cross-device sync → planned: Firebase (Firestore). Do this before real use.
- Netlify sites `royal-palace-menu` / `royal-palace-qr` are broken (they hold a redirect to a private claude.ai page). Use GitHub Pages links above.
- Prices are sample IQD values; dishes are sample items (photos: Canva AI + Adobe Stock free, licensed).

## His standing preferences
- Real photos, not drawn/code graphics. Luxurious black + gold look for this brand.
- Messages he sends to restaurants: Iraqi dialect.
- Don't publish anything unless he asks; when he asks, give a real public link and verify it opens.
