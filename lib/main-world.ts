import { browser, type PublicPath } from 'wxt/browser';

/**
 * wa-js + bridge run in WhatsApp's MAIN world only while the extension is on.
 * They are registered dynamically (not in the manifest) so "Desligado" really
 * stops injecting code into WhatsApp.
 */
export const WHATSAPP_MATCH = 'https://web.whatsapp.com/*';
export const MAIN_WORLD_SCRIPT_ID = 'wacrm-main-world';
export const MAIN_WORLD_FILES = ['/wppconnect-wa.js', '/wa-bridge.js'] satisfies PublicPath[];

/** Makes the registered scripts match the switch. Idempotent. */
export async function syncMainWorldRegistration(enabled: boolean): Promise<void> {
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [MAIN_WORLD_SCRIPT_ID] });
  if (enabled && existing.length === 0) {
    await browser.scripting.registerContentScripts([
      {
        id: MAIN_WORLD_SCRIPT_ID,
        matches: [WHATSAPP_MATCH],
        js: MAIN_WORLD_FILES,
        world: 'MAIN',
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  } else if (!enabled && existing.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [MAIN_WORLD_SCRIPT_ID] });
  }
}

/**
 * Turning on: inject into WhatsApp tabs already open so the user doesn't need a reload.
 * Skips tabs where the bridge is already running (wa-js must not load twice).
 */
export async function injectIntoOpenTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ url: WHATSAPP_MATCH });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        const [probe] = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => Boolean((window as unknown as { __wacrmBridge?: boolean }).__wacrmBridge),
        });
        if (probe?.result) return;
        await browser.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: MAIN_WORLD_FILES });
      } catch (err) {
        console.warn('[WhatsApp CRM] inject', tab.url, err);
      }
    }),
  );
}
