// LaTeX Support Extension (API v2)
api.settings.register({
  renderOnInput: {
    type: 'boolean',
    label: 'Render on Input',
    default: true,
    description: 'Automatically render LaTeX while typing.'
  },
  macros: {
    type: 'text',
    label: 'Custom Macros (JSON)',
    default: '{}',
    description: 'JSON object defining custom KaTeX macros.'
  }
});

async function triggerMathRender() {
  let macros = {};
  try {
    const raw = await api.settings.get('macros');
    if (raw) macros = JSON.parse(raw);
  } catch (e) {}

  await api.editor.renderMath({ pane: 'primary', macros });
  await api.editor.renderMath({ pane: 'secondary', macros });
}

api.on('noteOpened', () => {
  setTimeout(triggerMathRender, 100);
});

api.on('editorInput', async () => {
  const auto = await api.settings.get('renderOnInput');
  if (auto) {
    triggerMathRender();
  }
});

api.settings.onChanged(() => {
  triggerMathRender();
});

api.registerToolbarButton({
  title: 'Render LaTeX',
  label: 'LaTeX',
  icon: 'math',
  onClick: async () => {
    await triggerMathRender();
    api.ui.showNotification('LaTeX rendered.', 'success');
  }
});
