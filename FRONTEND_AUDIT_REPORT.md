# Frontend Audit Report - ReservationInsiderPro
**Date:** November 24, 2024
**Status:** Post-Backend Migration Testing

## Executive Summary
The application is **functionally operational** with the new backend architecture. However, several bugs and UX issues need to be addressed before it reaches production quality.

---

## Critical Issues (Fix Immediately)

### 1. **Strategy Panel Not Visible**
- **Location:** Market Intelligence view, right column
- **Problem:** When clicking a restaurant (e.g., "Rao's"), the Strategy Panel and Trend Chart should appear on the right side of the screen. Currently not visible in the viewport.
- **Root Cause:** Likely a layout issue with the grid or the panel is rendering below the fold/off-screen.
- **Impact:** Users cannot see the countdown timer, "Direct Breach" button, or tactical analysis - these are the core "Sniper" features.

### 2. **Recharts Rendering Error**
- **Console Error:** "The width(-1) and height(-1) of chart should be greater than 0"
- **Location:** TrendChart component
- **Problem:** The chart container doesn't have a defined height/width, causing Recharts to fail.
- **Impact:** The 7-day volatility chart (critical for timing exits) doesn't display.

### 3. **Portfolio Data Lost After Migration**
- **Location:** Command Center tab
- **Problem:** Shows "No assets tracked" even though we had seed data (Carbone, Don Angie, etc.).
- **Root Cause:** LocalStorage keys might have changed during the file move, or the data wasn't migrated to the database yet.
- **Impact:** Users lose all their tracked reservations/watchlist.

---

## High-Priority Bugs (Fix Before Phase 3)

### 4. **Countdown Timer Not Tested with New Logic**
- **Problem:** I updated the countdown code to handle `nextDropDate/nextDropTime/dropTimezone`, but Gemini hasn't returned those fields yet (because the backend server was just restarted and hasn't cached results).
- **Test Needed:** Click Hayato (or another restaurant) and verify the countdown now shows "7d 14:XX:XX" instead of "14:XX:XX".

### 5. **Sniper Ticker Not Visible**
- **Problem:** Should appear at the bottom of the screen when there are "WATCHING" items.
- **Likely Cause:** Portfolio is empty (see Issue #3), so no ticker items to display.

### 6. **Missing Database Sync**
- **Problem:** We created `portfolio_items` table in Neon, but we haven't written the API endpoint to:
  - **GET** `/api/portfolio` (Load from DB instead of LocalStorage)
  - **POST** `/api/portfolio` (Save to DB)
- **Impact:** Portfolio data still lives in the browser. Refreshing = data loss.

---

## Medium-Priority Issues (Polish & UX)

### 7. **Tailwind CDN Warning**
- **Console:** "cdn.tailwindcss.com should not be used in production"
- **Fix:** Install Tailwind as a PostCSS plugin in the client.
- **Impact:** Slower load times and potential CDN outages in production.

### 8. **City Selector - "Remove City" Buttons**
- **Problem:** Every city chip has a tiny "X" button, but visually it's not clear if you're supposed to remove cities.
- **UX Question:** Is removing cities a common action? If not, maybe hide the "X" until hover.

### 9. **"24h VOL: $342,850" in Header**
- **Problem:** This stat appears static/hardcoded.
- **Question:** Should this be dynamically calculated from the portfolio or market data?

### 10. **Drop Time Input in Portfolio Manager**
- **Location:** Portfolio table, "Asset" column shows "DROP: __:__" input field.
- **Problem:** Users can manually edit `dropTime`, but the new fields (`nextDropDate`, `nextDropTime`, `dropTimezone`) aren't editable yet.
- **Decision Needed:** Should users be able to override AI-calculated drop dates, or should it be read-only?

---

## Visual/Cosmetic Issues (Low Priority)

### 11. **Text Encoding Issues in Restaurant Descriptions**
- **Example:** "Ea t Harlem in titution" (should be "East Harlem institution"), "tyle Italian" (should be "style").
- **Root Cause:** Accessibility snapshot returns garbled text - this is a browser tool artifact, not an actual bug. The real page likely shows correct text.

### 12. **"COPY CC" and "COPY TEL" Placeholder Data**
- **Location:** Strategy Panel, "Acquisition Protocol" section.
- **Problem:** Currently copies hardcoded values ("1234 5678..." and "555-0199").
- **Decision Needed:** Should these be user-configurable in settings, or remain as quick-copy templates?

---

## Feature Gaps (Not Bugs, But Worth Discussing)

### 13. **No Database Persistence Yet**
- We built the `portfolio_items` table but haven't connected the frontend to it.
- Recommendation: Create API endpoints and migrate LocalStorage data before Phase 3.

### 14. **No Tavily/Firecrawl/Apify Integration Yet**
- These were planned for Phase 2 but we haven't implemented them yet.
- Current: Using Gemini's Google Search grounding (which works well).
- Question: Do we integrate these now, or wait until after Phase 3 (Sniper)?

### 15. **No "Listing Generator" Tool**
- You mentioned wanting a tool to auto-generate AppointmentTrader listing descriptions.
- This wasn't in the original 3-phase plan but could be valuable.

---

## Recommended Immediate Actions (In Order)

1. **Fix Strategy Panel Visibility** (Critical - users can't see the sniper countdown).
2. **Fix Recharts Rendering** (Critical - volatility chart is core UX).
3. **Sync Portfolio to Database** (High - prevents data loss).
4. **Test New Countdown Logic** (High - verify the calendar-aware timer works).
5. **Install Tailwind Properly** (Medium - remove CDN dependency).

---

**Total Issues Found:** 15
**Critical:** 3
**High:** 3
**Medium:** 4
**Low/Cosmetic:** 2
**Feature Gaps:** 3

Would you like me to tackle the Critical issues first, or do you want to discuss/reprioritize this list?











