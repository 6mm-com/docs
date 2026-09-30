# Prediction documentation review (local draft)

This file is an editorial checklist and is not included in the public navigation.

## Evidence

- Local total-admin: `/home/rog/6mm-console-project/6mm-admin-console`.
- `prediction-list-schema.js`: three games, seven canonical query pages, fields and display states.
- `app.js`: gameplay configuration around 1856 and 5935; odds around 6143; grid guide around 6315; funding-account definitions around 225–250; risk controls around 6933.
- `BACKEND-INTEGRATION.md`: reporting conventions around 137–141; service-fee category around 72.
- Total-admin uses demo mode and has pre-existing uncommitted edits. It was read only; no production settlement implementation has been verified.

## Resolve before publication

1. Equal opening/settlement prices in Up/Down and Custom: outcome, stake treatment and fee treatment.
2. Up/Down odds locking point, funding pool timing, and whether the documented formula exactly matches production.
3. Grid: exact price/time boundary inclusion, crossing/interpolation rules across samples, gaps and finality after a hit.
4. Grid: internal guide gives 10 × 10, 2 seconds per cell, 97%, 1.02x–20x. Public examples deliberately do not promise these production settings.
5. Stored odds precision, display rounding, settlement rounding and currency precision. Corrected the illustrative 100 × 4.85 payout to 485, not 490.
6. Cancellation/amendment policy, refund amount, fee reversals and processing deadlines.
7. Actual service-fee schedule, billing basis and whether amounts shown to users are before/after fees.
8. Partner-specific funding paths and prediction API/Widget availability. No new endpoints or SDK methods are invented.
9. Grid mock history still includes result-cell/final-price terminology; the detailed gameplay guide defines a time-window touch result. Confirm the production contract.
10. Mark-price evidence and the probability estimator implementation need backend review. Public copy describes the model concept, not unverified numerical implementation details.

## Translation review

English and Simplified Chinese are authored together. Traditional Chinese is converted from the authored Chinese draft with OpenCC; the other 17 enabled locales are machine-translated with protected links, code, and business terms, then structurally validated. The broken Edge auth endpoint was replaced by a public Google translation adapter. Native-language editorial review remains required, especially for odds, payout, stake, and outcome terminology. Existing approved navigation and entry-page copy is retained outside the new prediction additions.

## Scope

17 new pages, a separate Prediction tab, home/trading entry cards, and perpetual-specific scope notes. Keep all changes local until user testing and business review are complete.
