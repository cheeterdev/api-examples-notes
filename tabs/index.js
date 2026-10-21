const PANES = ['primary', 'secondary'];
const SESSION_KEY = 'tab-session-v1';
const EMPTY_TAB_PREFIX = 'empty-';
const SETTINGS = {
  width: 'compact',
  height: 'small',
  color: 'theme',
  closeBehavior: 'neighbor',
  maxTabs: 40
};

const SETTINGS_SCHEMA = {
  width: { type: 'select', label: 'Tab width', description: 'Controls the width of the tab bar.', default: 'compact', options: [{ value: 'compact', label: 'Compact' }, { value: 'medium', label: 'Medium' }, { value: 'wide', label: 'Wide' }] },
  height: { type: 'select', label: 'Tab height', description: 'Controls tab vertical spacing.', default: 'small', options: [{ value: 'tiny', label: 'Small' }, { value: 'small', label: 'Medium' }, { value: 'tall', label: 'Tall' }] },
  color: { type: 'select', label: 'Tab color', description: 'Controls the tab surface color.', default: 'theme', options: [{ value: 'theme', label: 'Theme' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] },
  closeBehavior: { type: 'select', label: 'Close behavior', description: 'Choose what replaces the active tab.', default: 'neighbor', options: [{ value: 'neighbor', label: 'Open neighboring tab' }, { value: 'empty', label: 'Open an empty tab' }] },
  maxTabs: { type: 'number', label: 'Maximum tabs', description: 'Maximum tabs kept per pane.', default: 40, min: 1, max: 100 }
};

const OVERLAY_STYLES = `
[data-extension-id][data-overlay-id] {
  top: 9px;
  right: 9px;
  left: 9px;
  width: auto;
  max-width: none;
  padding: 9px;
  border-radius: 10px;
  background: var(--sb);
  box-shadow: 0 8px 22px rgba(0, 0, 0, .18);
  transform: none;
}
[data-extension-id][data-overlay-id] .tabs-shell {
  display: flex;
  flex-wrap: wrap;
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  align-items: center;
  gap: 4px;
}
[data-extension-id][data-overlay-id] .tabs-scroll {
  display: flex;
  min-width: 0;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
}
[data-extension-id][data-overlay-id] .tabs-scroll::-webkit-scrollbar { display: none; }
[data-extension-id][data-overlay-id] .tabs-item { display: flex; min-width: 0; align-items: center; gap: 0; }
[data-extension-id][data-overlay-id] button.tabs-tab,
[data-extension-id][data-overlay-id] button.tabs-close,
[data-extension-id][data-overlay-id] button.tabs-add {
  border: 0;
  color: var(--ts);
  background: transparent;
  font: inherit;
  font-size: 13px;
}
[data-extension-id][data-overlay-id] button.tabs-tab {
  min-width: 78px;
  max-width: 170px;
  overflow: hidden;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, var(--ts) 42%, transparent);
  border-radius: 9px 0 0 9px;
  white-space: nowrap;
  text-align: left;
  text-overflow: ellipsis;
}
[data-extension-id][data-overlay-id] button.tabs-tab[aria-selected="true"] {
  color: var(--tp);
  background: var(--btn-active);
  border-color: var(--ts);
}
[data-extension-id][data-overlay-id] button.tabs-close {
  margin-left: -1px;
  padding: 6px 7px;
  border: 1px solid color-mix(in srgb, var(--ts) 42%, transparent);
  border-radius: 0 9px 9px 0;
  border-left: 0;
}
[data-extension-id][data-overlay-id] .tabs-item:has(button.tabs-tab[aria-selected="true"]) button.tabs-close {
  color: var(--tp);
  background: var(--btn-active);
  border-color: var(--ts);
}
[data-extension-id][data-overlay-id] button.tabs-close:hover,
[data-extension-id][data-overlay-id] button.tabs-add:hover {
  color: var(--tp);
  background: var(--btn-active);
}
[data-extension-id][data-overlay-id] button.tabs-add {
  flex: 0 0 auto;
  padding: 4px 9px;
  border-radius: 9px;
  font-size: 16px;
  line-height: 16px;
}
[data-extension-id][data-overlay-id] .tabs-shell.tabs-width-wide { width: 80%; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-width-medium { width: 55%; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-height-tiny button.tabs-tab,
[data-extension-id][data-overlay-id] .tabs-shell.tabs-height-tiny button.tabs-close { padding-top: 2px; padding-bottom: 2px; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-height-tall button.tabs-tab,
[data-extension-id][data-overlay-id] .tabs-shell.tabs-height-tall button.tabs-close { padding-top: 7px; padding-bottom: 7px; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-color-dark { background: #202124; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-color-light { background: #f2f2f2; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-color-light button { color: #555; }
[data-extension-id][data-overlay-id] .tabs-shell.tabs-color-dark button { color: #ddd; }
[data-extension-id][data-overlay-id] button:focus-visible {
  outline: 2px solid var(--ts);
  outline-offset: 1px;
}
`;

let notes = [];
let notesById = new Map();
let workspace = null;
let visible = true;
let mounts = new Map();
let refreshQueue = Promise.resolve();

const tabsByPane = {
  primary: { tabs: [], activeId: null },
  secondary: { tabs: [], activeId: null }
};

function notify(text, type = 'info') {
  api.ui.showNotification(text, type).catch(() => {});
}

function paneState(pane) {
  return tabsByPane[pane];
}

function noteTitle(note) {
  return note?.title?.trim() || 'Untitled note';
}

function isEmptyTab(tabId) {
  return typeof tabId === 'string' && tabId.startsWith(EMPTY_TAB_PREFIX);
}

function createEmptyTab() {
  return `${EMPTY_TAB_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSession(value) {
  if (!value || typeof value !== 'object') return;
  PANES.forEach(pane => {
    const saved = value[pane];
    if (!saved || !Array.isArray(saved.tabs)) return;
    const uniqueIds = [...new Set(saved.tabs.filter(id => typeof id === 'string'))].slice(0, SETTINGS.maxTabs);
    paneState(pane).tabs = uniqueIds;
    paneState(pane).activeId = typeof saved.activeId === 'string' ? saved.activeId : null;
  });
}

function overlayClassName() {
  return `tabs-width-${SETTINGS.width} tabs-height-${SETTINGS.height} tabs-color-${SETTINGS.color}`;
}

async function loadSettings() {
  SETTINGS.width = await api.settings.get('width');
  SETTINGS.height = await api.settings.get('height');
  SETTINGS.color = await api.settings.get('color');
  SETTINGS.closeBehavior = await api.settings.get('closeBehavior');
  SETTINGS.maxTabs = await api.settings.get('maxTabs');
}

function saveSession() {
  const serialized = {};
  PANES.forEach(pane => {
    const state = paneState(pane);
    serialized[pane] = { tabs: state.tabs, activeId: state.activeId };
  });
  api.storage.set(SESSION_KEY, serialized).catch(() => {});
}

function setNotes(nextNotes) {
  notes = Array.isArray(nextNotes) ? nextNotes : [];
  notesById = new Map(notes.map(note => [note.id, note]));

  PANES.forEach(pane => {
    const state = paneState(pane);
    state.tabs = state.tabs.filter(id => isEmptyTab(id) || notesById.has(id));
    if (!state.tabs.includes(state.activeId)) state.activeId = null;
  });
}

function addTab(pane, tabId, activate = true) {
  if (!isEmptyTab(tabId) && !notesById.has(tabId)) return;
  const state = paneState(pane);
  if (!state.tabs.includes(tabId)) {
    state.tabs.push(tabId);
    if (state.tabs.length > SETTINGS.maxTabs) state.tabs.shift();
  }
  if (activate) state.activeId = tabId;
}

function syncTabsWithWorkspace() {
  if (!workspace) return;
  PANES.forEach(pane => {
    const noteId = workspace.panes?.[pane]?.noteId;
    if (!noteId || !notesById.has(noteId)) return;

    const state = paneState(pane);
    if (state.activeId === noteId) return;
    if (state.tabs.includes(noteId)) {
      state.activeId = noteId;
      return;
    }

    const activeIndex = state.tabs.indexOf(state.activeId);
    if (activeIndex >= 0) {
      state.tabs[activeIndex] = noteId;
      state.activeId = noteId;
    } else {
      addTab(pane, noteId, true);
    }
  });
  saveSession();
}

function tabTree(pane, noteId) {
  const note = notesById.get(noteId);
  const selected = paneState(pane).activeId === noteId;
  const title = isEmptyTab(noteId) ? 'Empty tab' : noteTitle(note);
  return {
    type: 'div',
    className: 'tabs-item',
    role: 'presentation',
    children: [
      {
        type: 'button',
        className: 'tabs-tab',
        role: 'tab',
        selected,
        title,
        ariaLabel: `Open note: ${title}`,
        text: title,
        action: `open:${pane}:${noteId}`
      },
      {
        type: 'button',
        className: 'tabs-close',
        title: `Close tab: ${title}`,
        ariaLabel: `Close tab: ${title}`,
        text: '×',
        action: `close:${pane}:${noteId}`
      }
    ]
  };
}

function renderTree(pane) {
  const state = paneState(pane);
  return {
    type: 'div',
    className: `tabs-shell ${overlayClassName()}`,
    role: 'tablist',
    ariaLabel: pane === 'primary' ? 'Tabs in main editor' : 'Tabs in secondary editor',
    children: [
      {
        type: 'div',
        className: 'tabs-scroll',
        children: state.tabs.map(noteId => tabTree(pane, noteId))
      },
      {
        type: 'button',
        className: 'tabs-add',
        text: '+',
        title: 'Add empty tab',
        ariaLabel: 'Add empty tab',
        action: `add:${pane}`
      }
    ]
  };
}

function bindActions(pane, mount) {
  mount.onAction(`add:${pane}`, () => createNewTab(pane));

  paneState(pane).tabs.forEach(noteId => {
    mount.onAction(`open:${pane}:${noteId}`, () => openTab(pane, noteId));
    mount.onAction(`close:${pane}:${noteId}`, () => closeTab(pane, noteId));
  });
}

async function renderAll() {
  if (!visible) return;
  const work = [];
  mounts.forEach((mount, pane) => {
    bindActions(pane, mount);
    work.push(mount.update(renderTree(pane)));
  });
  await Promise.all(work);
}

async function createMounts() {
  const created = PANES.map(pane => {
    const mount = api.ui.mountEditorOverlay({
      id: `tabs-${pane}`,
      anchor: 'editor-header',
      placement: 'header-floating-center',
      pane
    });
    mounts.set(pane, mount);
    return mount;
  });

  await Promise.all(created.map(async mount => {
    await mount.ready;
    await mount.registerStyles(OVERLAY_STYLES);
  }));
}

async function destroyMounts() {
  const activeMounts = [...mounts.values()];
  mounts.clear();
  await Promise.allSettled(activeMounts.map(mount => mount.destroy()));
}

async function toggleTabs() {
  visible = !visible;
  if (visible) {
    await createMounts();
    await refreshFromHost();
  } else {
    await destroyMounts();
  }
}

async function refreshFromHost() {
  const [nextNotes, nextWorkspace] = await Promise.all([
    api.notes.list({ includeArchived: false }),
    api.workspace.getState()
  ]);
  setNotes(nextNotes);
  workspace = nextWorkspace;
  syncTabsWithWorkspace();
  await renderAll();
}

function scheduleRefresh() {
  refreshQueue = refreshQueue
    .catch(() => {})
    .then(() => refreshFromHost())
    .catch(error =>     notify(`Could not refresh tabs: ${error.message}`, 'warning'));
  return refreshQueue;
}

async function openTab(pane, noteId) {
  try {
    if (isEmptyTab(noteId)) {
      await api.workspace.clearPane({ pane });
      paneState(pane).activeId = noteId;
      saveSession();
      await scheduleRefresh();
      return;
    }

    const result = await api.workspace.openNote(noteId, { pane });
    addTab(result.pane, noteId, true);
    if (result.alreadyOpenIn) {
      notify('This note is already open in the other editor.', 'info');
    }
    saveSession();
    await scheduleRefresh();
  } catch (error) {
    notify(`Could not open tab: ${error.message}`, 'error');
  }
}

async function closeTab(pane, noteId) {
  const state = paneState(pane);
  const index = state.tabs.indexOf(noteId);
  if (index < 0) return;

  const wasActive = state.activeId === noteId;
  state.tabs.splice(index, 1);
  const replacementId = wasActive ? (state.tabs[index] || state.tabs[index - 1] || null) : state.activeId;
  state.activeId = replacementId;
  saveSession();

  try {
    if (wasActive && SETTINGS.closeBehavior === 'empty') {
      const emptyTabId = createEmptyTab();
      state.tabs.splice(index, 0, emptyTabId);
      state.activeId = emptyTabId;
      await api.workspace.clearPane({ pane });
    } else if (wasActive && replacementId && isEmptyTab(replacementId)) {
      await api.workspace.clearPane({ pane });
    } else if (wasActive && replacementId) {
      await api.workspace.openNote(replacementId, { pane });
    } else if (wasActive) {
      await api.workspace.clearPane({ pane });
    }
    await scheduleRefresh();
  } catch (error) {
    notify(`Could not close tab: ${error.message}`, 'error');
    await scheduleRefresh();
  }
}

async function createNewTab(pane) {
  const emptyTabId = createEmptyTab();
  addTab(pane, emptyTabId, true);
  saveSession();
  try {
    await api.workspace.clearPane({ pane });
    await scheduleRefresh();
  } catch (error) {
    notify(`Could not open empty tab: ${error.message}`, 'error');
    await renderAll();
  }
}

api.settings.register(SETTINGS_SCHEMA).then(loadSettings).catch(error => notify(`Could not load tab settings: ${error.message}`, 'warning'));
api.settings.onChanged(({ key, value }) => {
  if (Object.prototype.hasOwnProperty.call(SETTINGS, key)) {
    SETTINGS[key] = value;
    renderAll().catch(() => {});
  }
});

api.registerToolbarButton({
  title: 'Show or hide tabs',
  icon: 'tabs',
  onClick: () => toggleTabs().catch(error => notify(`Could not toggle tabs: ${error.message}`, 'error'))
});

['noteOpened', 'noteChanged', 'noteArchived', 'noteRestored', 'noteRemoved', 'notesChanged', 'workspaceChanged']
  .forEach(event => api.on(event, scheduleRefresh));

(async () => {
  try {
    normalizeSession(await api.storage.get(SESSION_KEY));
    await createMounts();
    await refreshFromHost();
  } catch (error) {
    notify(`Could not initialize tabs: ${error.message}`, 'warning');
  }
})();
