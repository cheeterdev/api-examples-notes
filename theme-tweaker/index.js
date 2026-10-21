// Theme Tweaker Extension (API v2)
api.settings.register({
  accentColor: {
    type: 'text',
    label: 'Accent Color',
    default: '#ff9500',
    description: 'Hex or CSS color for the primary UI accent.'
  },
  editorFontSize: {
    type: 'number',
    label: 'Editor Font Size',
    default: 15,
    description: 'Base font size in pixels.'
  }
});

async function applySettings() {
  const color = await api.settings.get('accentColor');
  const size = await api.settings.get('editorFontSize');

  if (color) {
    await api.theme.setAccentColor(color);
  }
  if (size) {
    await api.theme.setFontSize(size);
  }
}

applySettings();

api.settings.onChanged(() => {
  applySettings();
});

api.on('noteOpened', () => {
  setTimeout(applySettings, 50);
});

api.registerToolbarButton({
  title: 'Tweak Theme',
  label: 'Theme',
  icon: 'palette',
  onClick: () => {
    api.ui.showNotification('Use the Extension Manager to change theme settings!', 'info');
  }
});
