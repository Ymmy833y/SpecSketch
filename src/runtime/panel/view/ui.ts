import i18n from '@common/i18n';
import type { ScreenItem } from '@common/types';
import { getStatusMessage, STATUS_LABEL_STYLE, type StatusKey } from '@panel/view/status';

const statusEl = document.getElementById('status') as HTMLSpanElement;
const toggleIconEl = document.getElementById('toggle-select-icon') as HTMLSpanElement;
const toggleLabelEl = document.getElementById('toggle-select-label') as HTMLSpanElement;
const selectCountEl = document.getElementById('select-count') as HTMLSpanElement;
const selectEmptyEl = document.getElementById('select-empty') as HTMLDivElement;
const selectListEl = document.getElementById('select-list') as HTMLUListElement;

const STATUS_BASE_BODY = [
  'inline-flex','items-center','gap-1',
  'rounded-full','border','px-2','py-1','text-xs',
  'transition-colors',
] as const;

const TOGGLE_ICON_BASE = [
  'inline-block', 'w-3', 'h-3', 'rounded-full',
] as const;

const TOGGLE_ICON_ON  = ['bg-emerald-500'] as const;
const TOGGLE_ICON_OFF = ['bg-slate-300'] as const;

/**
 * Updates the connection status indicator's style and text.
 *
 * @param key - Current status key
 */
export function updateStatusUI(key: StatusKey) {
  const style = STATUS_LABEL_STYLE[key];

  statusEl.className = '';
  statusEl.classList.add(...STATUS_BASE_BODY, ...style.body);

  const dot = document.createElement('span');
  dot.classList.add('h-1.5', 'w-1.5', 'rounded-full', ...style.dot);

  const text = document.createElement('span');
  text.textContent = getStatusMessage(key);

  statusEl.replaceChildren(dot, text);
}

/**
 * Updates the selection toggle's icon and label.
 *
 * @param enabled - True if selection is enabled
 */
export function updateToggleIconUI(enabled: boolean) {
  toggleIconEl.className = '';
  toggleIconEl.classList.add(...TOGGLE_ICON_BASE, ...(enabled ? TOGGLE_ICON_ON : TOGGLE_ICON_OFF));
  toggleLabelEl.textContent = i18n.get(enabled ? 'toggle_on' : 'toggle_off');
}

/**
 * Rebuilds the selection list UI. Shows an empty state when no items exist.
 *
 * @param items - Items to display
 */
export function renderList(items: ScreenItem[]) {
  const isEmpty = items.length === 0;
  selectCountEl.textContent = String(items.length);

  if (isEmpty) {
    selectEmptyEl.classList.remove('hidden');
    selectListEl.replaceChildren();
    return;
  }

  selectEmptyEl.classList.add('hidden');
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'group flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60';
    li.dataset.id = String(it.id);

    const badge = document.createElement('span');
    badge.className = 'inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold';
    badge.textContent = String(it.label);

    const main = document.createElement('div');
    main.className = 'min-w-0 flex-1';

    const line1 = document.createElement('div');
    line1.className = 'text-sm font-medium truncate';
    line1.textContent = it.anchor.value;
    main.append(line1);

    li.append(badge, main);
    frag.appendChild(li);
  }
  selectListEl.replaceChildren(frag);
}
