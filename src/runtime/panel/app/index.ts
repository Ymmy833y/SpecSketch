import i18n from '@common/i18n';
import { ContentToPanel, MSG_TYPE } from '@common/messages';
import type { ScreenItem, ScreenState } from '@common/types';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { connectToTab } from '@panel/messaging/connection'
import { getState, handleSelected, setState } from '@panel/state/store';
import { getStatusMessage, STATUS, StatusKey } from '@panel/view/status';

const toggleBtn = document.getElementById('toggle-select') as HTMLButtonElement;
const toggleLabel = document.getElementById('toggle-label') as HTMLSpanElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;
const listEl = document.getElementById('list')!;

let currentTabId: number | null = null;
let currentPageKey = '';
let selectionEnabled = false;

main().catch(console.error);

async function main() {
  i18n.localize(document);

  const tab = await getActiveTab();
  if (!tab?.id || isRestricted(tab.url)) return setStatus(STATUS.RESTRICTED);
  currentTabId = tab.id!;
  currentPageKey = pageKey(tab.url!);
  setStatus(STATUS.CONNECTING);

  const conn = await connectToTab(currentTabId);
  conn.onDisconnect(() => {
    setStatus(STATUS.DISCONNECTED);
    selectionEnabled = false;
    toggleLabel.textContent = i18n.get('toggle_off');
  });

  // Content → Panel
  conn.port.onMessage.addListener(async (msg: ContentToPanel) => {
    if (!msg || !msg.type) return;

    if (msg.type === MSG_TYPE.SELECTED) {
      const newState = await handleSelected(currentPageKey, msg.payload.anchors);
      renderList(newState.items);
      await conn.api.render(newState.items);
    }
  });

  // Restore
  const st = await getState(currentPageKey);
  await conn.api.render(st.items);
  renderList(st.items);
  setStatus(STATUS.CONNECTED);

  // UI
  toggleBtn.onclick = async () => {
    selectionEnabled = !selectionEnabled;
    toggleLabel.textContent = i18n.get(selectionEnabled ? 'toggle_on' : 'toggle_off');
    await conn.api.toggleSelect(selectionEnabled);
  };

  clearBtn.onclick = async () => {
    const cleared: ScreenState = { items: [], nextId: 1, nextLabel: 1 };
    await setState(currentPageKey, cleared);
    renderList([]);
    await conn.api.clear();
  };
}

function renderList(items: ScreenItem[]) {
  listEl.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = `#${it.label}  ${it.anchor.value}`;
    listEl.appendChild(li);
  }
}

function setStatus(key: StatusKey) {
  statusEl.textContent = getStatusMessage(key);
}
