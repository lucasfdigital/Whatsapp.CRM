import { enabledItem } from '@/lib/settings';
import { injectIntoOpenTabs, syncMainWorldRegistration } from '@/lib/main-world';

export default defineBackground(() => {
  const sync = async () => {
    const enabled = await enabledItem.getValue();
    await syncMainWorldRegistration(enabled);
    return enabled;
  };

  // Covers install, update (registrations are dropped on update) and browser start.
  browser.runtime.onInstalled.addListener(async () => {
    if (await sync()) await injectIntoOpenTabs();
  });
  browser.runtime.onStartup.addListener(() => void sync());

  enabledItem.watch(async (enabled) => {
    await syncMainWorldRegistration(enabled);
    if (enabled) await injectIntoOpenTabs();
  });
});
