import { ContentSize } from '@common/types';

/**
 * @summary Type guard to ensure the provided element is an HTMLElement.
 * @param el The element to check.
 * @returns True if the element is an HTMLElement; otherwise, false.
 */
function isHTMLElement(el: Element): el is HTMLElement {
  return el instanceof HTMLElement;
}

/**
 * @summary Gets the horizontal page offset in CSS pixels, preferring visualViewport when available.
 * @returns The horizontal page offset (CSS pixels).
 */
function pageOffsetX(): number {
  // Prefer visualViewport for pinch-zoom scenarios; often equals window.scrollX on desktop.
  return (window.visualViewport?.pageLeft ?? window.scrollX) || 0;
}

/**
 * @summary Gets the vertical page offset in CSS pixels, preferring visualViewport when available.
 * @returns The vertical page offset (CSS pixels).
 */
function pageOffsetY(): number {
  // Prefer visualViewport for pinch-zoom scenarios; often equals window.scrollY on desktop.
  return (window.visualViewport?.pageTop ?? window.scrollY) || 0;
}

/**
 * @summary Measures the maximum rendered content area of the page in CSS pixels, considering
 * scroll containers (e.g., overflowed <main>), fixed/absolute/transform layouts, and negative overflow.
 * Also returns rough selectors for the elements contributing to width/height.
 * @returns A ContentSize object containing width, height, and selector hints (widestBy, tallestBy).
 */
export function measureContentSize(): ContentSize {
  const docEl = document.documentElement;
  const body = document.body ?? null;
  const se = (document.scrollingElement as HTMLElement | null) ?? null;

  // Baseline sizes from document/body/scrollingElement (size metrics only).
  const baseW = Math.max(
    docEl.scrollWidth,
    docEl.offsetWidth,
    docEl.clientWidth,
    body?.scrollWidth ?? 0,
    body?.offsetWidth ?? 0,
    body?.clientWidth ?? 0,
    se?.scrollWidth ?? 0,
    se?.offsetWidth ?? 0,
    se?.clientWidth ?? 0,
  );
  const baseH = Math.max(
    docEl.scrollHeight,
    docEl.offsetHeight,
    docEl.clientHeight,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0,
    se?.scrollHeight ?? 0,
    se?.offsetHeight ?? 0,
    se?.clientHeight ?? 0,
  );

  // Aggregate element positions (visual bounding box) and sizes (scroll totals) separately.
  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  let maxScrollW = 0;
  let maxScrollH = 0;

  const offX = pageOffsetX();
  const offY = pageOffsetY();

  const elements = Array.from(document.querySelectorAll('*')).filter(isHTMLElement);
  for (const el of elements) {
    // Size metrics (total scrollable size of containers).
    if (el.scrollWidth > maxScrollW) {
      maxScrollW = el.scrollWidth;
    }
    if (el.scrollHeight > maxScrollH) {
      maxScrollH = el.scrollHeight;
    }

    // Position metrics (visual bounds) normalized to page coordinates.
    const r = el.getBoundingClientRect();
    const left = r.left + offX;
    const right = r.right + offX;
    const top = r.top + offY;
    const bottom = r.bottom + offY;

    if (left < minLeft) minLeft = left;
    if (top < minTop) minTop = top;
    if (right > maxRight) {
      maxRight = right;
    }
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  // Guards for pages with no elements.
  if (!isFinite(minLeft)) minLeft = 0;
  if (!isFinite(minTop)) minTop = 0;
  if (!isFinite(maxRight)) maxRight = baseW;
  if (!isFinite(maxBottom)) maxBottom = baseH;

  // Visual bounding-box size (position-based).
  const bboxWidth = Math.max(0, Math.ceil(maxRight - minLeft));
  const bboxHeight = Math.max(0, Math.ceil(maxBottom - minTop));

  // Final size: the maximum of document baseline, scroll totals, and visual bounds.
  const width = Math.max(baseW, maxScrollW, bboxWidth);
  const height = Math.max(baseH, maxScrollH, bboxHeight);

  return {
    width,
    height,
  };
}
