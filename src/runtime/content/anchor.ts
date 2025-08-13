import type { Anchor } from '@common/types';
import { finder } from '@medv/finder';

export function buildCssAnchor(el: Element): Anchor {
  const value = finder(el, {
    timeoutMs: 500,
  });
  return { kind: 'css', value, version: 1 };
}
