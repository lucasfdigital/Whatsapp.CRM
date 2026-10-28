import './content/style.css';
import ReactDOM from 'react-dom/client';
import { enabledItem } from '@/lib/settings';
import { Splash } from './content/ui/Splash';

/**
 * Loading screen, separate from the main script so it runs at document_start
 * and covers WhatsApp's own from the first paint. Only while the extension is on.
 */
export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    if (!(await enabledItem.getValue())) return;
    const ui = await createShadowRootUi<ReactDOM.Root>(ctx, {
      name: 'wacrm-splash',
      position: 'inline',
      // <body> does not exist yet at document_start.
      anchor: 'html',
      append: 'last',
      onMount(container, _shadow, host) {
        host.style.setProperty('display', 'block', 'important');
        const root = ReactDOM.createRoot(container);
        root.render(<Splash onDone={() => ui.remove()} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    // Turned off while loading: WhatsApp as it is, right away.
    const unwatch = enabledItem.watch((on) => on || ui.remove());
    ctx.onInvalidated(() => {
      unwatch();
      ui.remove();
    });
  },
});
