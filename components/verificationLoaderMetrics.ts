/**
 * Responsive metrics for the journey loader.
 * Pure function (no React / RN imports) so it can be unit-tested in Node.
 *
 * Design reference (Stitch, 390 x 844): ring 96, gaps 24, five visible rows.
 * On shorter / narrower screens we step down through profiles until the
 * whole screen fits WITHOUT overflowing, instead of clipping the footer.
 */

export const ROW_H = 48; // completed / pending row
export const ROW_H_ACTIVE = 57; // active / failed row
export const ROW_GAP = 2;

export interface LoaderMetrics {
    ringSize: number;
    ringBlockHeight: number; // ring + space for the % badge
    gap: number; // gap between the main blocks
    headingPadBottom: number;
    visibleRows: number;
    windowHeight: number;
    showPill: boolean;
    topPad: number; // extra padding above the ring (on top of the safe-area inset)
    bottomPad: number; // extra padding under the footer (on top of the safe-area inset)
    extraTop: number; // spare space pushed above the ring on tall screens
    sidePad: number;
    cardWidth: number;
    requiredHeight: number;
    availableHeight: number;
    fits: boolean;
}

interface Profile {
    ring: number;
    rows: number;
    gap: number;
    headPad: number;
    pill: boolean;
    top: number;
    bottom: number;
}

// Ordered from the exact design down to the most compact layout.
const PROFILES: Profile[] = [
    { ring: 96, rows: 5, gap: 24, headPad: 24, pill: true, top: 16, bottom: 24 },
    { ring: 96, rows: 4, gap: 24, headPad: 24, pill: true, top: 16, bottom: 24 },
    { ring: 88, rows: 4, gap: 20, headPad: 20, pill: true, top: 12, bottom: 20 },
    { ring: 80, rows: 4, gap: 16, headPad: 16, pill: true, top: 12, bottom: 16 },
    { ring: 80, rows: 4, gap: 16, headPad: 16, pill: false, top: 12, bottom: 16 },
    { ring: 72, rows: 3, gap: 12, headPad: 12, pill: false, top: 8, bottom: 12 },
    { ring: 64, rows: 3, gap: 8, headPad: 8, pill: false, top: 8, bottom: 8 },
];

// Fixed heights taken from the design
const HEADING_H = 28 + 5 + 42; // title + gap + two body lines
const CARD_PAD = 16 + 14; // card top + bottom padding
const PILL_H = 31; // 30.5 rounded up
const FOOTER_H = 1 + 12 + 16 + 2 + 15 + 4; // border, pad, line, gap, sub-line, pad
const BADGE_SPACE = 20; // room under the ring for the % badge
const FOOTER_MIN_GAP = 12; // min space between content and footer

export function windowHeightForRows(rows: number): number {
    // 5 rows -> 256 (matches the design), 4 -> 206, 3 -> 156
    return (ROW_H + ROW_GAP) * rows + 6;
}

function requiredFor(p: Profile): number {
    const ringBlock = p.ring + BADGE_SPACE;
    const card = CARD_PAD + windowHeightForRows(p.rows);
    let total = p.top + ringBlock + p.gap + HEADING_H + p.headPad + p.gap + card;
    if (p.pill) total += 16 + PILL_H;
    total += FOOTER_MIN_GAP + FOOTER_H + p.bottom;
    return total;
}

export function getLoaderMetrics(
    width: number,
    height: number,
    insetTop: number,
    insetBottom: number
): LoaderMetrics {
    const available = Math.max(0, height - insetTop - insetBottom);

    let chosen = PROFILES[PROFILES.length - 1];
    let fits = false;
    for (const p of PROFILES) {
        if (requiredFor(p) <= available) {
            chosen = p;
            fits = true;
            break;
        }
    }

    const required = requiredFor(chosen);
    const spare = Math.max(0, available - required);

    const sidePad = width < 340 ? 16 : 24;
    // Never wider than the screen minus padding (old code forced min 300px,
    // which overflowed on 320px phones).
    const cardWidth = Math.max(0, Math.min(400, width - sidePad * 2));

    return {
        ringSize: chosen.ring,
        ringBlockHeight: chosen.ring + BADGE_SPACE,
        gap: chosen.gap,
        headingPadBottom: chosen.headPad,
        visibleRows: chosen.rows,
        windowHeight: windowHeightForRows(chosen.rows),
        showPill: chosen.pill,
        topPad: chosen.top,
        bottomPad: chosen.bottom,
        // On tall screens give a little of the spare space to the top so the
        // layout is not top-heavy (capped so it still matches the design).
        extraTop: fits ? Math.min(Math.round(spare * 0.25), 32) : 0,
        sidePad,
        cardWidth,
        requiredHeight: required,
        availableHeight: available,
        fits,
    };
}