import i18n from '@common/i18n';
import { getIcon } from '@common/icons';
import {
  isItemColor,
  isItemPosition,
  isItemShape,
  isLabelFormat,
  type ItemColor,
  ItemPosition,
  type ItemShape,
  LabelFormat,
  type ScreenItem,
  ThemeMode,
  ToastMessage,
  UNGROUPED,
  UNGROUPED_VALUE,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import { getStatusMessage, STATUS, STATUS_CLASS_BY_KEY, type StatusKey } from '@panel/types/status';

import type { Model } from '../app/model';
import { type UIEventPayloadMap, UIEventType } from '../types/ui_event_types';

function byLabelThenId(a: { label: number; id: number }, b: { label: number; id: number }) {
  if (a.label !== b.label) return a.label - b.label;
  return a.id - b.id;
}

export class PanelView {
  private listeners: { [K in UIEventType]?: unknown[] } = {};

  private els!: {
    status: HTMLSpanElement;
    toggleBtn: HTMLButtonElement;
    toggleIcon: HTMLSpanElement;
    toggleLabel: HTMLSpanElement;
    clearBtn: HTMLButtonElement;
    captureBtn: HTMLButtonElement;

    list: HTMLDivElement;
    empty: HTMLDivElement;
    count: HTMLSpanElement;

    captureOptionsToggle: HTMLButtonElement;
    captureOptionsPanel: HTMLElement;
    captureFmtRadios: NodeListOf<HTMLInputElement>;
    captureAreaRadios: NodeListOf<HTMLInputElement>;
    jpegOnlyEls: NodeListOf<HTMLElement>;
    jpegQualityRange: HTMLInputElement;
    jpegQualityNumber: HTMLInputElement;
    captureScaleRange: HTMLInputElement;
    captureScaleNumber: HTMLInputElement;

    badgeSizeRange: HTMLInputElement;
    badgeSizeNumber: HTMLInputElement;
    badgeColorButtons: NodeListOf<HTMLButtonElement>;
    badgeColorLabel: HTMLSpanElement;
    badgeColorDot: HTMLSpanElement;
    badgeShapeSelect: HTMLSelectElement;
    badgeLabelFormatSelect: HTMLSelectElement;
    badgeVisibleSelect: HTMLSelectElement;
    badgeDeleteButton: HTMLButtonElement;
    badgePositionButtons: NodeListOf<HTMLButtonElement>;
    badgePositionLabel: HTMLSpanElement;
    badgeGroupSelect: HTMLSelectElement;

    groupNameModal: HTMLDivElement;
    groupNameInput: HTMLInputElement;
    groupNameCancelBtn: HTMLButtonElement;
    groupNameCreatelBtn: HTMLButtonElement;

    itemCommentModal: HTMLDivElement;
    itemCommentInput: HTMLTextAreaElement;
    itemCommentIdInput: HTMLInputElement;
    itemCommentCancelBtn: HTMLButtonElement;
    itemCommentApplyBtn: HTMLButtonElement;

    selectItemAllCheckbox: HTMLInputElement;

    settingModal: HTMLDivElement;
    settingButton: HTMLButtonElement;
    settingCloseButton: HTMLButtonElement;

    themeLightBtn: HTMLButtonElement;
    themeDarkBtn: HTMLButtonElement;
    themeDeviceBtn: HTMLButtonElement;

    importFileInput: HTMLInputElement;
    importBtn: HTMLButtonElement;

    storeCount: HTMLSpanElement;
    storeList: HTMLUListElement;
    storeEmpty: HTMLDivElement;

    toastParent: HTMLDivElement;
  };

  private readonly NEW_GROUP = '__newgroup__';
  private HOVER_OUT_DELAY = 1000;

  private dragEl: HTMLLIElement | null = null;
  private dragStartParent: Element | null = null;
  private dragStartIndex = -1;

  private hoverOutTimer: ReturnType<typeof setTimeout> | null = null;

  private collapsedGroups = new Set<string>();

  private TOAST_AUTO_DISMISS = 10000;

  constructor(private doc: Document) {
    i18n.localize(doc);

    this.els = {
      status: this.$('#status'),
      toggleBtn: this.$('#toggle-select'),
      toggleIcon: this.$('#toggle-select-icon'),
      toggleLabel: this.$('#toggle-select-label'),
      clearBtn: this.$('#clear'),
      captureBtn: this.$('#capture'),

      list: this.$('#select-list'),
      empty: this.$('#select-empty'),
      count: this.$('#select-count'),

      captureOptionsToggle: this.$('#capture-options-toggle'),
      captureOptionsPanel: this.$('#capture-options'),
      captureFmtRadios: this.$all<HTMLInputElement>('input[name="capture-format"]'),
      captureAreaRadios: this.$all<HTMLInputElement>('input[name="capture-area"]'),
      jpegOnlyEls: this.$all<HTMLElement>('.jpeg-only'),
      jpegQualityRange: this.$('#jpeg-quality-range'),
      jpegQualityNumber: this.$('#jpeg-quality-number'),
      captureScaleRange: this.$('#capture-scale-range'),
      captureScaleNumber: this.$('#capture-scale-number'),

      badgeSizeRange: this.$('#badge-size-range'),
      badgeSizeNumber: this.$('#badge-size-number'),
      badgeColorButtons: this.$all<HTMLButtonElement>('#badge-color-pop button'),
      badgeColorLabel: this.$('#badge-color-label'),
      badgeColorDot: this.$('#badge-color-dot'),
      badgeShapeSelect: this.$('#badge-shape-select'),
      badgeLabelFormatSelect: this.$('#badge-label-format-select'),
      badgeVisibleSelect: this.$('#badge-visible-select'),
      badgeDeleteButton: this.$('#badge-delete-button'),
      badgePositionButtons: this.$all<HTMLButtonElement>('#badge-position-pop button'),
      badgePositionLabel: this.$('#badge-position-label'),
      badgeGroupSelect: this.$('#badge-group-select'),
      groupNameModal: this.$('#group-name-modal'),
      groupNameInput: this.$('#group-name-input'),
      groupNameCancelBtn: this.$('#group-name-cancel-btn'),
      groupNameCreatelBtn: this.$('#group-name-create-btn'),

      itemCommentModal: this.$('#item-comment-modal'),
      itemCommentInput: this.$('#item-comment-input'),
      itemCommentIdInput: this.$('#item-comment-id-input'),
      itemCommentCancelBtn: this.$('#item-comment-cancel-btn'),
      itemCommentApplyBtn: this.$('#item-comment-apply-btn'),

      selectItemAllCheckbox: this.$('input[type="checkbox"][name="item-select"][value="all"]'),

      settingModal: this.$('#setting-modal'),
      settingButton: this.$('#setting-button'),
      settingCloseButton: this.$('#setting-close-btn'),

      themeLightBtn: this.$('#theme-light-btn'),
      themeDarkBtn: this.$('#theme-dark-btn'),
      themeDeviceBtn: this.$('#theme-device-btn'),

      importFileInput: this.$('#import-file-input'),
      importBtn: this.$('#import-btn'),

      storeCount: this.$('#store-count'),
      storeList: this.$('#store-list'),
      storeEmpty: this.$('#store-empty'),

      toastParent: this.$('#toast-parent'),
    };

    this.els.toggleBtn.addEventListener('click', () =>
      this.emit(UIEventType.TOGGLE_SELECT, undefined),
    );
    this.els.clearBtn.addEventListener('click', () => this.emit(UIEventType.CLEAR, undefined));
    this.els.captureBtn.addEventListener('click', () => this.emit(UIEventType.CAPTURE, undefined));

    // === Capture options ===
    this.els.captureOptionsToggle.addEventListener('click', () => {
      this.emit(UIEventType.TOGGLE_CAPTURE_PANEL, undefined);
    });

    this.els.captureFmtRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.updateQualityVisibility();
        this.emit(UIEventType.CAPTURE_FORMAT_CHANGE, { format: this.getSelectedCaptureFormat() });
      }),
    );
    this.els.captureAreaRadios.forEach((r) =>
      r.addEventListener('change', () => {
        this.emit(UIEventType.CAPTURE_AREA_CHANGE, { area: this.getSelectedCaptureArea() });
      }),
    );

    this.bindSync(this.els.jpegQualityRange, this.els.jpegQualityNumber, (v) =>
      this.emit(UIEventType.CAPTURE_QUALITY_CHANGE, { quality: v }),
    );
    this.bindSync(this.els.captureScaleRange, this.els.captureScaleNumber, (v) =>
      this.emit(UIEventType.CAPTURE_SCALE_CHANGE, { scale: v }),
    );

    // === Badge ===
    this.bindSync(this.els.badgeSizeRange, this.els.badgeSizeNumber);
    const fireSize = () => {
      const v = Number(this.els.badgeSizeNumber.value);
      if (Number.isFinite(v)) this.emit(UIEventType.BADGE_SIZE_CHANGE, { size: v });
    };
    this.els.badgeSizeRange.addEventListener('change', fireSize);
    this.els.badgeSizeNumber.addEventListener('change', fireSize);

    this.els.badgeColorButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.colorName ?? '';
        const color = isItemColor(raw) ? (raw as ItemColor) : 'Blue';
        this.emit(UIEventType.BADGE_COLOR_SELECT, { color });
      });
    });

    this.els.badgeShapeSelect.addEventListener('change', () => {
      const v = this.els.badgeShapeSelect.value ?? null;
      const shape = isItemShape(v) ? (v as ItemShape) : 'circle';
      this.emit(UIEventType.BADGE_SHAPE_CHANGE, { shape });
    });

    this.els.badgeLabelFormatSelect.addEventListener('change', () => {
      const v = this.els.badgeLabelFormatSelect.value ?? null;
      const labelFormat = isLabelFormat(v) ? (v as LabelFormat) : 'Numbers';
      this.emit(UIEventType.BADGE_LABEL_FORMAT_CHANGE, { labelFormat });
    });

    this.els.badgeVisibleSelect.addEventListener('change', () => {
      const visible = this.els.badgeVisibleSelect.value === 'true';
      this.emit(UIEventType.BADGE_VISIBLE_CHANGE, { visible });
    });

    this.els.badgeDeleteButton.addEventListener('click', () => {
      this.emit(UIEventType.BADGE_DELETE, undefined);
    });

    this.els.badgePositionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.positionName ?? '';
        const position = isItemPosition(raw) ? (raw as ItemPosition) : 'left-top-outside';
        this.emit(UIEventType.BADGE_POSITION_SELECT, { position });
      });
    });

    this.els.badgeGroupSelect.addEventListener('change', () => {
      const value = this.els.badgeGroupSelect.value ?? UNGROUPED;
      const group = value === UNGROUPED ? UNGROUPED_VALUE : value;
      if (group === this.NEW_GROUP) {
        this.els.groupNameModal.classList.remove('hidden');
      }
      this.emit(UIEventType.SET_GROUP, { group });
    });

    this.els.groupNameCancelBtn.addEventListener('click', () => {
      this.els.groupNameModal.classList.add('hidden');
    });

    this.els.groupNameCreatelBtn.addEventListener('click', () => {
      const value = this.els.groupNameInput.value ?? UNGROUPED;
      const group = value === UNGROUPED || value === this.NEW_GROUP ? UNGROUPED_VALUE : value;
      this.emit(UIEventType.SET_GROUP, { group });
      this.els.groupNameModal.classList.add('hidden');
      this.els.groupNameInput.value = '';
    });

    this.els.itemCommentCancelBtn.addEventListener('click', () => {
      this.els.itemCommentModal.classList.add('hidden');
    });

    this.els.itemCommentApplyBtn.addEventListener('click', () => {
      const comment = this.els.itemCommentInput.value;
      const id = Number(this.els.itemCommentIdInput.value);
      this.emit(UIEventType.ITEM_COMMENT_APPLY, { id, comment });
      this.els.itemCommentModal.classList.add('hidden');
    });

    this.els.settingButton.addEventListener('click', () => {
      this.els.settingModal.classList.remove('hidden');
      this.emit(UIEventType.SETTING_MODAL_SHOW, undefined);
    });
    this.els.settingCloseButton.addEventListener('click', () => {
      this.els.settingModal.classList.add('hidden');
    });

    this.els.themeLightBtn.addEventListener('click', () => {
      this.applyTheme('light');
      this.emit(UIEventType.UPDATE_THEME, { theme: 'light' });
    });
    this.els.themeDarkBtn.addEventListener('click', () => {
      this.applyTheme('dark');
      this.emit(UIEventType.UPDATE_THEME, { theme: 'dark' });
    });
    this.els.themeDeviceBtn.addEventListener('click', () => {
      this.applyTheme('device');
      this.emit(UIEventType.UPDATE_THEME, { theme: 'device' });
    });

    this.els.importBtn.addEventListener('click', () => {
      // If no file is selected, open the dialog
      if (!this.els.importFileInput.files || this.els.importFileInput.files.length === 0) {
        this.els.importFileInput.click();
        return;
      }
      const file = this.els.importFileInput.files[0]!;
      this.emit(UIEventType.IMPORT_SCREAN_STATE_FILE, { file });
    });

    this.updateQualityVisibility();

    this.els.selectItemAllCheckbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, { allCheck: selected });
    });

    this.els.list.addEventListener('pointerenter', () => this.cancelHoverOut());
    this.els.list.addEventListener('pointerleave', () => this.scheduleHoverOut());
    doc.addEventListener('pointerleave', () => {
      this.cancelHoverOut();
      this.emit(UIEventType.ITEM_HOVER_OUT, undefined);
    });
  }

  on<K extends UIEventType>(type: K, handler: (e: UIEventPayloadMap[K]) => void): void {
    const arr = (this.listeners[type] ??= []) as Array<(e: UIEventPayloadMap[K]) => void>;
    arr.push(handler);
  }

  private emit<K extends UIEventType>(type: K, e: UIEventPayloadMap[K]): void {
    const arr = this.listeners[type] as Array<(x: UIEventPayloadMap[K]) => void> | undefined;
    arr?.forEach((h) => h(e));
  }

  render(model: Model): void {
    this.applyToastMessages(model.toastMessages);
    this.applyTheme(model.theme);
    this.applyStore(model.pageKeys);
    this.renderStatus(model.status);
    this.renderToggle(model.selectionEnabled);
    this.renderList(model.items, model.selectItems, model.missingIds);

    this.selectRadioByValue(this.els.captureFmtRadios, model.capture.format);
    this.selectRadioByValue(this.els.captureAreaRadios, model.capture.area);
    this.els.jpegQualityNumber.value = String(model.capture.quality);
    this.els.jpegQualityRange.value = String(model.capture.quality);
    this.els.captureScaleNumber.value = String(model.capture.scale);
    this.els.captureScaleRange.value = String(model.capture.scale);
    this.updateQualityVisibility(model.capture.format);

    this.applyCaptureOptionsToggleUI(model.capture.panelExpanded);
    this.els.badgeSizeNumber.value = String(model.defaultSize);
    this.els.badgeSizeRange.value = String(model.defaultSize);
    this.applyBadgeColorUI(model.defaultColor);
    this.els.badgeShapeSelect.value = model.defaultShape;
    this.els.badgeLabelFormatSelect.value = model.defaultLabelFormat ?? 'Numbers';
    this.els.badgeVisibleSelect.value = String(model.defaultVisible ?? 'true');
    this.applyBadgePositonUI(model.defaultPosition);
    this.applyBadgeGroupSelectUI(this.getExistingGroups(model.items), model.defaultGroup);
  }

  private renderStatus(key: StatusKey): void {
    const style = STATUS_CLASS_BY_KEY[key];
    const el = this.els.status;
    el.className = '';
    el.className = `connect-status ${style}`;

    const dot = this.doc.createElement('span');
    dot.classList.add('connect-status-dot');

    const text = this.doc.createElement('span');
    text.textContent = getStatusMessage(key);
    el.replaceChildren(dot, text);

    this.disableFormControls(key);
  }

  private renderToggle(enabled: boolean): void {
    const icon = this.els.toggleIcon;
    icon.className = '';
    icon.classList.add('select-toggle-icon', enabled ? 'bg-indigo-500' : 'bg-slate-300');
    this.els.toggleLabel.textContent = i18n.get(enabled ? 'toggle_on' : 'toggle_off');
  }

  private renderList(items: ScreenItem[], selectItems: number[], missingIds: number[]): void {
    this.els.count.textContent = String(items.length);
    const allChecked =
      items.length === 0 ? false : items.every((it) => selectItems.includes(it.id));
    this.els.selectItemAllCheckbox.checked = allChecked;
    if (!items.length) {
      this.els.empty.classList.remove('hidden');
      this.els.list.replaceChildren();
      return;
    }
    this.els.empty.classList.add('hidden');

    const groups = this.groupByGroup(items);

    const groupKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === UNGROUPED) return -1;
      if (b === UNGROUPED) return 1;
      return a.localeCompare(b);
    });

    const frag = this.doc.createDocumentFragment();
    for (const gKey of groupKeys) {
      const section = this.renderGroupSection(gKey, groups.get(gKey)!, selectItems, missingIds);
      frag.appendChild(section);
    }
    this.els.list.replaceChildren(frag);
  }

  private renderGroupSection(
    gKey: string,
    gItems: ScreenItem[],
    selectItems: number[],
    missingIds: number[],
  ): HTMLElement {
    const isCollapsed = this.collapsedGroups.has(gKey);

    const section = this.el('section', 'select-item-section');

    // header
    const header = this.el('div', 'select-item-header');

    // checkbox
    const checkboxWrap = this.el('div', 'spsk-checkwrap');
    const checkbox = this.el('input', 'spsk-checkbox spsk-checkbox--normal') as HTMLInputElement;

    checkbox.type = 'checkbox';
    checkbox.name = 'item-select';
    checkbox.value = gKey === UNGROUPED ? i18n.get('group_ungrouped') : gKey;
    checkbox.checked = gItems.every((it) => selectItems.includes(it.id));
    checkbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, {
        group: gKey === UNGROUPED ? UNGROUPED_VALUE : gKey,
        isCheck: selected,
      });
    });
    checkboxWrap.append(checkbox);
    const title = this.el(
      'span',
      'select-item-gh-title',
      gKey === UNGROUPED ? i18n.get('group_ungrouped') : gKey,
    );
    const left = this.el('div', 'select-item-gh-left');
    left.append(checkboxWrap, title);
    const count = this.el('span', 'select-item-gh-count', String(gItems.length));

    const toggleBtn = this.el('button', 'select-item-gh-toggle') as HTMLButtonElement;
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    const { d, viewBox } = isCollapsed ? getIcon('caretRight') : getIcon('caretDown');
    const toggleIcon = this.createSvgIcon(d, { className: 'icon-sm', viewBox });
    const togglePath = toggleIcon.querySelector('path') as SVGPathElement;
    toggleBtn.append(toggleIcon);

    header.append(left, count, toggleBtn);

    // ul
    const ul = this.el('ul', 'select-item-list') as HTMLUListElement;
    if (isCollapsed) ul.classList.add('hidden');
    this.attachUlDnDHandlers(ul);

    for (const it of gItems.sort(byLabelThenId)) {
      const selectChecked = selectItems.includes(it.id);
      ul.appendChild(this.renderItem(it, selectChecked, missingIds));
    }

    toggleBtn.addEventListener('click', () => {
      const currentlyCollapsed = this.collapsedGroups.has(gKey);
      if (currentlyCollapsed) {
        this.collapsedGroups.delete(gKey);
        ul.classList.remove('hidden');
        togglePath.setAttribute('d', getIcon('caretDown').d);
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        this.collapsedGroups.add(gKey);
        ul.classList.add('hidden');
        togglePath.setAttribute('d', getIcon('caretRight').d);
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    section.append(header, ul);
    return section;
  }

  private renderItem(it: ScreenItem, selectChecked: boolean, missingIds: number[]): HTMLLIElement {
    const isMissing = missingIds.includes(it.id);

    const liBase = 'select-item';
    const li = this.el(
      'li',
      isMissing ? `group ${liBase} select-item--warn` : liBase,
    ) as HTMLLIElement;
    li.dataset.id = String(it.id);
    li.draggable = true;

    // Only sorting within the same UL is allowed
    li.addEventListener('dragstart', (e) => {
      this.dragEl = li;
      this.dragStartParent = li.parentElement;
      this.dragStartIndex = Array.prototype.indexOf.call(li.parentElement?.children ?? [], li);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      li.classList.add('opacity-60');
    });

    li.addEventListener('dragend', () => {
      if (!this.dragEl) return;
      const parent = this.dragEl.parentElement;
      const endIndex = parent ? Array.prototype.indexOf.call(parent.children, this.dragEl) : -1;

      this.dragEl.classList.remove('opacity-60');
      const fromId = this.dragEl.dataset.id ?? '';
      this.dragEl = null;

      if (fromId && this.dragStartIndex >= 0 && endIndex >= 0 && endIndex !== this.dragStartIndex) {
        this.emit(UIEventType.REORDER_ITEMS, {
          fromId: Number(fromId),
          fromIndex: this.dragStartIndex,
          toIndex: endIndex,
        });
      }
      this.dragStartIndex = -1;
      this.dragStartParent = null;
    });

    // checkbox
    const checkboxWrap = this.el('div', 'spsk-checkwrap');
    const checkboxStyle = isMissing
      ? 'spsk-checkbox spsk-checkbox--warn'
      : 'spsk-checkbox spsk-checkbox--normal';
    const checkbox = this.el('input', checkboxStyle) as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.name = 'item-select';
    checkbox.value = String(it.id);
    checkbox.checked = selectChecked;
    checkbox.addEventListener('change', (e) => {
      const selected = (e.target as HTMLInputElement).checked;
      this.emit(UIEventType.ITEM_SELECTION_CHANGED, { id: it.id, isCheck: selected });
    });
    checkboxWrap.append(checkbox);

    // badge
    const badgeStyle = isMissing ? 'spsk-badge spsk-badge--warn' : 'spsk-badge spsk-badge--norm';
    const badge = this.el('span', badgeStyle, String(it.label));

    // main (missingIcon, anchor)
    const main = this.el('div', 'min-w-0 flex-1');
    main.addEventListener('pointerenter', () => {
      if (this.dragStartParent || isMissing) return;
      this.cancelHoverOut();
      this.emit(UIEventType.ITEM_HOVER_IN, { id: it.id });
    });
    if (isMissing) {
      const chip = this.el('span', 'chip-warn');
      const { d, viewBox } = getIcon('warn');
      const icon = this.createSvgIcon(d, {
        className: 'h-3.5 w-3.5',
        viewBox,
      });
      const label = this.el('span', undefined, i18n.get('missing_item'));
      chip.append(icon, label);
      main.append(chip);
    }
    const anchor = this.el('div', 'anchor', it.anchor.value);
    main.append(anchor);

    const commentBtn = this.generateCommentBtn(it);
    li.append(checkboxWrap, badge, main, commentBtn);
    return li;
  }

  private generateCommentBtn(it: ScreenItem): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'btn-icon';
    const { d, viewBox } = getIcon('comment');
    const icon = this.createSvgIcon(d, {
      className: 'h-3.5 w-3.5',
      viewBox,
    });
    btn.appendChild(icon);

    btn.addEventListener('click', () => {
      this.els.itemCommentModal.classList.remove('hidden');
      this.els.itemCommentInput.value = it.comment ?? '';
      this.els.itemCommentIdInput.value = String(it.id);
    });
    return btn;
  }

  private scheduleHoverOut() {
    if (this.hoverOutTimer) clearTimeout(this.hoverOutTimer);
    if (this.dragStartParent) return;
    this.hoverOutTimer = setTimeout(() => {
      this.hoverOutTimer = null;
      this.emit(UIEventType.ITEM_HOVER_OUT, undefined);
    }, this.HOVER_OUT_DELAY);
  }

  private cancelHoverOut() {
    if (!this.hoverOutTimer) return;
    clearTimeout(this.hoverOutTimer);
    this.hoverOutTimer = null;
  }

  /**
   * UL D&D Handler
   * Only sorting within the same UL is allowed
   * @param ul
   */
  private attachUlDnDHandlers(ul: HTMLUListElement): void {
    ul.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.dragEl) return;

      if (this.dragStartParent && ul !== this.dragStartParent) return;

      const targetLi = (e.target as HTMLElement)?.closest('li') as HTMLLIElement | null;
      if (targetLi && targetLi !== this.dragEl) {
        const rect = targetLi.getBoundingClientRect();
        const isAfter = e.clientY - rect.top > rect.height / 2;
        ul.insertBefore(this.dragEl, isAfter ? targetLi.nextSibling : targetLi);
      } else if (!targetLi) {
        ul.appendChild(this.dragEl);
      }
    });
    ul.addEventListener('drop', (e) => e.preventDefault());
  }

  private getExistingGroups(items: ScreenItem[]): string[] {
    return Array.from(
      new Set(items.map((i) => (i.group ?? '').trim()).filter((g): g is string => g.length > 0)),
    ).sort((a, b) => a.localeCompare(b));
  }

  private groupByGroup(items: ScreenItem[]): Map<string, ScreenItem[]> {
    const m = new Map<string, ScreenItem[]>();
    for (const it of items) {
      const key = (it.group ?? UNGROUPED_VALUE).trim() || UNGROUPED;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return m;
  }

  private getSelectedCaptureFormat(): CaptureFormat {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-format"]:checked',
    )?.value;
    return val === 'jpeg' ? 'jpeg' : 'png';
  }
  private getSelectedCaptureArea(): CaptureArea {
    const val = this.doc.querySelector<HTMLInputElement>(
      'input[name="capture-area"]:checked',
    )?.value;
    return val === 'viewport' ? 'viewport' : 'full';
  }
  private updateQualityVisibility(format?: CaptureFormat): void {
    const f = format ?? this.getSelectedCaptureFormat();
    const isJpeg = f === 'jpeg';
    this.els.jpegOnlyEls.forEach((el) => el.classList.toggle('hidden', !isJpeg));
    this.els.jpegQualityRange.disabled = !isJpeg;
    this.els.jpegQualityNumber.disabled = !isJpeg;
  }
  private selectRadioByValue(radios: NodeListOf<HTMLInputElement>, value: string): void {
    radios.forEach((r) => (r.checked = r.value === value));
  }
  private bindSync(
    rangeEl: HTMLInputElement,
    numberEl: HTMLInputElement,
    onValue?: (val: number) => void,
  ): void {
    const readNum = (s: string | null | undefined, fallback: number): number => {
      const v = s != null && s !== '' ? Number(s) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

    const sync = (rawStr: string) => {
      const min = readNum(numberEl.min || rangeEl.min, Number.NEGATIVE_INFINITY);
      const max = readNum(numberEl.max || rangeEl.max, Number.POSITIVE_INFINITY);
      const step = readNum(numberEl.step || rangeEl.step, 1);
      const raw = Number(rawStr);
      const clamped = clamp(Number.isFinite(raw) ? raw : 0, min, max);
      const rounded = Math.round(clamped / step) * step;
      const fixed = Number(rounded.toFixed(6));
      numberEl.value = String(fixed);
      rangeEl.value = String(fixed);
      onValue?.(fixed);
    };

    rangeEl.addEventListener('input', () => sync(rangeEl.value));
    numberEl.addEventListener('input', () => sync(numberEl.value));
  }
  private disableFormControls(status: StatusKey): void {
    const controls = this.doc.querySelectorAll<
      HTMLButtonElement | HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement
    >('button, select, input, textarea');

    // Determine enablement policy per status
    const enableAll = status === STATUS.CONNECTED;
    const enableIgnoreOnly = status === STATUS.CONNECTING || status === STATUS.DISCONNECTED;
    const enableNone = status === STATUS.RESTRICTED;

    controls.forEach((el) => {
      const shouldEnable =
        (enableAll && true) ||
        (enableIgnoreOnly && el.hasAttribute('data-ignore-disable')) ||
        (enableNone && false);
      el.disabled = !shouldEnable;
    });
  }
  private applyCaptureOptionsToggleUI(expanded: boolean) {
    this.els.captureOptionsToggle.setAttribute('aria-expanded', String(expanded));
    const { d, viewBox } = expanded ? getIcon('caretDownFill') : getIcon('caretRightFill');
    this.els.captureOptionsToggle.innerHTML = '';
    this.els.captureOptionsToggle.appendChild(
      this.createSvgIcon(d, { viewBox, className: 'h-4 w-4' }),
    );
    this.els.captureOptionsPanel.classList.toggle('hidden', !expanded);
  }
  private getBadgeColorStyleName(color: ItemColor): string {
    const colorName = color === 'Gray' ? 'slate' : color;
    return `bg-${colorName.toLowerCase()}-500`;
  }
  private applyBadgeColorUI(color: ItemColor): void {
    this.els.badgeColorButtons.forEach((button) => {
      const selected = button.dataset.colorName === color;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    this.els.badgeColorLabel.textContent = color;
    this.els.badgeColorDot.className = 'inline-block w-4 h-4 rounded-full';
    this.els.badgeColorDot.classList.add(this.getBadgeColorStyleName(color));
  }
  private applyBadgePositonUI(position: ItemPosition): void {
    this.els.badgePositionButtons.forEach((button) => {
      const selected = button.dataset.positionName === position;
      button.setAttribute('data-selected', selected ? 'true' : 'false');
    });
    this.els.badgePositionLabel.textContent = position.replaceAll('-', ' ');
  }
  private applyBadgeGroupSelectUI(existingGroups: string[], defautGroup: string): void {
    this.els.badgeGroupSelect.innerHTML = '';
    this.els.badgeGroupSelect.append(
      this.makeOpt(UNGROUPED, i18n.get('group_ungrouped'), defautGroup === UNGROUPED),
    );
    for (const group of existingGroups) {
      const normalize = (g?: string) => (g ?? '').trim();
      const value = normalize(group);
      this.els.badgeGroupSelect.append(this.makeOpt(value, group, defautGroup === group));
    }
    const createOpt = this.makeOpt(this.NEW_GROUP, i18n.get('common_create'));
    this.els.badgeGroupSelect.append(createOpt);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = document.documentElement;
    const isDark =
      theme === 'device'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : theme === 'dark';
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    this.els.themeLightBtn.setAttribute('data-active', String(theme === 'light'));
    this.els.themeDarkBtn.setAttribute('data-active', String(theme === 'dark'));
    this.els.themeDeviceBtn.setAttribute('data-active', String(theme === 'device'));
  }

  private applyStore(pageKeys: string[]): void {
    this.els.storeCount.textContent = String(pageKeys.length);
    this.els.storeList.innerHTML = '';

    if (pageKeys.length <= 0) {
      this.els.storeList.classList.add('hidden');
      this.els.storeEmpty.classList.remove('hidden');
      return;
    }

    for (const pageKey of pageKeys) {
      const liElem = this.el('li', 'select-item');
      const aWrapElem = this.el('div', 'min-w-0 flex-1');
      const aElem = this.el('a', 'anchor whitespace-normal break-words', pageKey);
      aElem.href = pageKey;
      aElem.target = '_blank';
      aWrapElem.appendChild(aElem);
      const exportBtnElem = this.el('button', 'btn-icon');
      exportBtnElem.setAttribute('data-ignore-disable', 'true');
      const exportIconDef = getIcon('export');
      const exportIcon = this.createSvgIcon(exportIconDef.d, {
        className: 'icon-sm',
        viewBox: exportIconDef.viewBox,
      });
      exportBtnElem.appendChild(exportIcon);
      const removeBtnElem = this.el('button', 'btn-icon btn-icon--danger');
      removeBtnElem.setAttribute('data-ignore-disable', 'true');
      const removeIconDef = getIcon('remove');
      const removeIcon = this.createSvgIcon(removeIconDef.d, {
        className: 'icon-sm',
        viewBox: removeIconDef.viewBox,
      });
      removeBtnElem.appendChild(removeIcon);
      liElem.appendChild(aWrapElem);
      liElem.appendChild(exportBtnElem);
      liElem.appendChild(removeBtnElem);
      this.els.storeList.appendChild(liElem);

      exportBtnElem.addEventListener('click', () => {
        this.emit(UIEventType.EXPORT_PAGE_CLICK, { pageKey });
      });
      removeBtnElem.addEventListener('click', () => {
        this.emit(UIEventType.REMOVE_PAGE_CLICK, { pageKey });
      });
    }
    this.els.storeList.classList.remove('hidden');
    this.els.storeEmpty.classList.add('hidden');
  }

  private applyToastMessages(toastMessages: ToastMessage[]): void {
    for (const toastMessage of toastMessages) {
      const toastElem = this.generateToastMessage(toastMessage);
      this.els.toastParent.appendChild(toastElem);
      this.emit(UIEventType.TOAST_DISMISS_REQUESTED, { uuid: toastMessage.uuid });
    }
  }

  private generateToastMessage(toastMessage: ToastMessage): HTMLDivElement {
    const toastElem = this.el('div', `toast toast--${toastMessage.kind}`);
    const toastIconDef = getIcon(toastMessage.kind);
    const toastIcon = this.createSvgIcon(toastIconDef.d, {
      className: 'toast-icon',
      viewBox: toastIconDef.viewBox,
      variant: 'solid',
    });
    const toastBody = this.el('div', 'toast-body');
    const desc = this.el('p', 'toast-desc', toastMessage.message);
    toastBody.appendChild(desc);
    const closeBtn = this.el('button', `toast-close toast-close--${toastMessage.kind}`);
    const closeIconDef = getIcon('close');
    const closeIcon = this.createSvgIcon(closeIconDef.d, {
      className: 'h-3.5 w-3.5',
      viewBox: closeIconDef.viewBox,
    });
    closeBtn.appendChild(closeIcon);
    toastElem.appendChild(toastIcon);
    toastElem.appendChild(toastBody);
    toastElem.appendChild(closeBtn);

    const timerId = window.setTimeout(() => {
      if (toastElem.isConnected) toastElem.remove();
    }, this.TOAST_AUTO_DISMISS);

    closeBtn.addEventListener('click', () => {
      clearTimeout(timerId);
      if (toastElem.isConnected) toastElem.remove();
    });
    return toastElem;
  }

  private $<T extends Element>(selector: string): T {
    const el = this.doc.querySelector(selector);
    if (!el) throw new Error(`[PanelView] Missing element: ${selector}`);
    return el as T;
  }
  private $all<T extends Element>(selector: string): NodeListOf<T> {
    return this.doc.querySelectorAll<T>(selector);
  }
  private el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = this.doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  private makeOpt(value: string, label: string, selected = false): HTMLOptionElement {
    const o = this.doc.createElement('option');
    o.value = value;
    o.textContent = label;
    if (selected) o.selected = true;
    return o;
  }

  private createSvgIcon(
    d: string,
    opts: { className?: string; viewBox?: string; variant?: 'solid' | 'outline' } = {},
  ): SVGSVGElement {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', opts.viewBox ?? '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    if (opts.className) svg.setAttribute('class', opts.className);

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);

    if (opts.variant === 'outline') {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    } else {
      path.setAttribute('fill', 'currentColor');
    }

    svg.appendChild(path);
    return svg;
  }
}
