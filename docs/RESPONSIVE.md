# Step 6 — Responsive behavior

Layout rules live in `src/responsive.css`, after the base and motion styles. They size and wrap content rather than hiding document overflow.

| Surface | Phone | Tablet / desktop |
|---|---|---|
| Public QR menu | Single column | Two-column cards from 640 px, grouped under category headings |
| Waiter | Tables and order are separate phone panes | From 768 px, tables stay on the left and the selected order stays on the right; draft/cart joins the menu as a third inner column from 1280 px |
| Cook | One column below 768 px | Two columns from 768 px; three from 1280 px; four from 1440 px |
| Admin | Drawer below 1024 px; staff/report rows become cards below 640 px | Persistent sidebar from 1024 px |

The drawer uses a modal dialog with focus containment, Escape/backdrop/close controls, navigation that closes the drawer, and focus restoration to the opener. It closes automatically when resizing to the desktop sidebar. Its entrance class is removed at the 250 ms deadline so a stalled CSS animation cannot leave navigation permanently invisible.

Waiter table selection retains each table's in-memory unsent draft while moving between panes or tables. Send controls account for safe-area insets and remain separate from bottom navigation. Category chips may scroll horizontally; board filters and navigation wrap instead. Names, descriptions, totals, and form errors can wrap. The phone report tabs use their own full-width row.

## Safari verification

The review page rendered each of these 14 screen states at **360, 390, 768, 1024, and 1440 px**:

- Cook board
- Waiter tables, order, statistics
- Admin reports, menu, staff, QR sheet, settings
- Public QR menu
- Cafe code and staff credentials
- Component gallery and style guide

All **70 screen/width combinations passed** the document-width and element-boundary checks. No horizontal scroll container was detected outside category chips. Follow-up checks also verified the expected cook/QR column counts, visible non-overlapping waiter panes at tablet widths, the admin sidebar breakpoint, and send-bar/bottom-navigation separation.

Visual checks covered the 768 px waiter split, 360 px phone order controls at a short 520 px viewport height, 390 px admin drawer opening and navigation, phone report tab labels, and 768 px QR cards. The visual pass caught and fixed a stalled drawer entrance in Safari's iframe preview. The 14-state width sweep used default demo content in Russian; it is not exhaustive coverage of arbitrary uploaded images, long staff datasets, every modal, other browser engines, or physical mobile keyboards.

## Repeat the review

Start `npm run dev`, then open `/review.html?page=waiter%3Ftab%3Dmenu`. With no width parameter it renders all five widths and prints the audit summary. Other screen links are provided in the review header.

Use `&width=768&interactive=1` to interact with one frame. Optional `&focus=1&height=520` hides the review header and gives a short viewport for inspecting sticky controls. Preview scaling changes presentation only; each iframe retains its actual CSS viewport width. The review page is developer tooling, not customer navigation.
