import { measureContentSize } from '@content/measure';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Rect = { left: number; top: number; right: number; bottom: number };

function setDocMetrics(opts: {
  doc?: Partial<
    Record<
      | 'scrollWidth'
      | 'scrollHeight'
      | 'offsetWidth'
      | 'offsetHeight'
      | 'clientWidth'
      | 'clientHeight',
      number
    >
  >;
  body?: Partial<
    Record<
      | 'scrollWidth'
      | 'scrollHeight'
      | 'offsetWidth'
      | 'offsetHeight'
      | 'clientWidth'
      | 'clientHeight',
      number
    >
  >;
  se?: Partial<
    Record<
      | 'scrollWidth'
      | 'scrollHeight'
      | 'offsetWidth'
      | 'offsetHeight'
      | 'clientWidth'
      | 'clientHeight',
      number
    >
  >;
}) {
  const se = (document.scrollingElement as HTMLElement | null) ?? document.documentElement;

  const apply = (el: Element, map?: Record<string, number>) => {
    if (!map) return;
    Object.entries(map).forEach(([k, v]) => {
      Object.defineProperty(el, k, { configurable: true, value: v });
    });
  };

  apply(document.documentElement, opts.doc as Record<string, number> | undefined);
  apply(document.body!, opts.body as Record<string, number> | undefined);
  if (se !== document.documentElement) {
    apply(se, opts.se as Record<string, number> | undefined);
  }
}

function makeEl(rect: Rect, scroll: { w?: number; h?: number } = {}): HTMLElement {
  const el = document.createElement('div');
  if (!document.body) document.appendChild(document.createElement('body'));
  document.body!.appendChild(el);

  // instance-level override of getBoundingClientRect for this element
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value(): DOMRect {
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        x: rect.left,
        y: rect.top,
        toJSON() {},
      } as unknown as DOMRect;
    },
  });

  // scroll metrics
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scroll.w ?? 0 });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scroll.h ?? 0 });

  return el;
}

function mockVisualViewport(pageLeft: number | undefined, pageTop: number | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: pageLeft == null && pageTop == null ? undefined : { pageLeft, pageTop },
  });
}

function mockScrollOffsets(scrollX: number, scrollY: number) {
  // jsdom's scrollX/scrollY are almost read-only, so replace them with defineProperty
  Object.defineProperty(window, 'scrollX', { configurable: true, value: scrollX });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(window, 'pageXOffset', { configurable: true, value: scrollX });
  Object.defineProperty(window, 'pageYOffset', { configurable: true, value: scrollY });
}

describe('content/measure', () => {
  beforeEach(() => {
    // reset DOM
    document.body?.remove();
    document.documentElement.innerHTML = '<head></head><body></body>';

    // clear offsets/visualViewport
    mockVisualViewport(undefined, undefined);
    mockScrollOffsets(0, 0);

    // clear any spy/mocks
    vi.restoreAllMocks();
  });

  describe('measureContentSize', () => {
    it('returns baseline size when no elements exist (guards normalize infinities)', () => {
      // Arrange: mock querySelectorAll to empty and set baseline metrics
      const spy = vi
        .spyOn(document, 'querySelectorAll')
        .mockReturnValue([] as unknown as NodeListOf<Element>);
      setDocMetrics({
        doc: {
          scrollWidth: 400,
          scrollHeight: 300,
          offsetWidth: 380,
          offsetHeight: 280,
          clientWidth: 360,
          clientHeight: 260,
        },
        body: {
          scrollWidth: 350,
          scrollHeight: 250,
          offsetWidth: 340,
          offsetHeight: 240,
          clientWidth: 330,
          clientHeight: 230,
        },
        se: {
          scrollWidth: 370,
          scrollHeight: 270,
          offsetWidth: 365,
          offsetHeight: 265,
          clientWidth: 355,
          clientHeight: 255,
        },
      });

      // Act
      const res = measureContentSize();

      // Assert: max of baseline widths/heights: width=400, height=300
      expect(res).toEqual({ width: 400, height: 300 });

      // Cleanup
      spy.mockRestore();
    });

    it('uses max of scroll totals when scrollable element dominates', () => {
      // Arrange baseline small
      setDocMetrics({
        doc: {
          scrollWidth: 500,
          scrollHeight: 400,
          offsetWidth: 480,
          offsetHeight: 380,
          clientWidth: 460,
          clientHeight: 360,
        },
      });
      // Element with huge scroll area (dominates)
      makeEl({ left: 0, top: 0, right: 200, bottom: 100 }, { w: 1800, h: 1600 });

      // Act
      const res = measureContentSize();

      // Assert: width=1800, height=1600 (from maxScrollW/H)
      expect(res).toEqual({ width: 1800, height: 1600 });
    });

    it('includes visualViewport offsets in bbox computation when available', () => {
      // Arrange: small baseline, one element whose bbox is shifted by visualViewport
      setDocMetrics({
        doc: {
          scrollWidth: 300,
          scrollHeight: 200,
          offsetWidth: 300,
          offsetHeight: 200,
          clientWidth: 300,
          clientHeight: 200,
        },
      });
      // element rect (10,20)-(210,120) → width=200, height=100
      makeEl({ left: 10, top: 20, right: 210, bottom: 120 });
      // visual viewport offsets
      mockVisualViewport(50, 100);

      // Act
      const res = measureContentSize();

      // Assert:
      // bbox width = (210+50) - (10+50) = 200
      // bbox height = (120+100) - (20+100) = 100
      // max(base 300x200, scroll 0x0, bbox 200x100) → 300x200
      expect(res).toEqual({ width: 300, height: 200 });
    });

    it('falls back to window.scrollX/scrollY when visualViewport is not available', () => {
      // Arrange: remove visualViewport and set scroll fallback
      mockVisualViewport(undefined, undefined);
      mockScrollOffsets(30, 40);

      setDocMetrics({
        doc: {
          scrollWidth: 100,
          scrollHeight: 90,
          offsetWidth: 100,
          offsetHeight: 90,
          clientWidth: 100,
          clientHeight: 90,
        },
      });
      // Two elements spanning visually with offsets included
      makeEl({ left: 0, top: 0, right: 150, bottom: 50 }); // width 150, height 50
      makeEl({ left: 200, top: 120, right: 260, bottom: 200 }); // expands right/bottom further

      // Act
      const res = measureContentSize();

      // Assert:
      // With offset (30,40), minLeft = 0+30=30, maxRight = 260+30=290 → bboxW = 260
      // minTop = 0+40=40, maxBottom = 200+40=240 → bboxH = 200
      // max(base 100x90, scroll 0x0, bbox 260x200) → 260x200
      expect(res).toEqual({ width: 260, height: 200 });
    });
  });
});
