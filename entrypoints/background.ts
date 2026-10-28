import { enabledItem } from '@/lib/settings';
import { injectIntoOpenTabs, syncMainWorldRegistration } from '@/lib/main-world';
import { UPDATE_CHECK_MESSAGE, checkForUpdate } from '@/lib/update';

export default defineBackground(() => {
  const sync = async () => {
    const enabled = await enabledItem.getValue();
    await syncMainWorldRegistration(enabled);
    return enabled;
  };

  // Covers install, update (registrations are dropped on update) and browser start.
  browser.runtime.onInstalled.addListener(async () => {
    void checkForUpdate();
    if (await sync()) await injectIntoOpenTabs();
  });
  browser.runtime.onStartup.addListener(() => {
    void sync();
    void checkForUpdate();
  });
  // The browser may stay open for days: the sidebar and the popup also ask (throttled in checkForUpdate).
  browser.runtime.onMessage.addListener((message) => {
    if (message === UPDATE_CHECK_MESSAGE) void checkForUpdate();
  });

  enabledItem.watch(async (enabled) => {
    await syncMainWorldRegistration(enabled);
    if (enabled) await injectIntoOpenTabs();
  });
});
