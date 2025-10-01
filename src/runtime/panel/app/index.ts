import { PanelController } from '@panel/controller/panel_controller';

import { PanelView } from '../view/panel_view';

/**
 * Orchestrates UI initialization and connection lifecycle.
 * - Apply i18n
 * - Detect and connect to the active tab
 * - Restore state and perform initial render
 * - Bind UI events
 */
async function start(): Promise<void> {
  const view = new PanelView(document);
  const controller = new PanelController(view);
  await controller.start();
}

(function init() {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    void start().catch((err) => {
      console.error('Panel bootstrap failed:', err);
    });
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () =>
        void start().catch((err) => {
          console.error('Panel bootstrap failed:', err);
        }),
      {
        once: true,
      },
    );
  }
})();
