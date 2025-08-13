import type { Anchor } from '@common/types';
import { finder } from '@medv/finder';

/**
 * Generates a re-locatable CSS selector (anchor) for the given element.
 * Uses @medv/finder to infer a stable selector.
 *
 * @param el - Target DOM element
 * @returns Generated CSS anchor
 * @remarks Selector generation is time-limited via `timeoutMs`.
 */
export function buildCssAnchor(el: Element): Anchor {
  const value = finder(el, {
    timeoutMs: 500,
  });
  return { kind: 'css', value, version: 1 };
}
