import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Visible folder (Finder hides dot-folders like the default .output).
  outDir: 'build',
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'WhatsApp CRM',
    description: 'CRM para WhatsApp Web: clientes, pipeline, tarefas e follow-ups.',
    permissions: ['storage', 'unlimitedStorage', 'scripting'],
    host_permissions: ['https://web.whatsapp.com/*'],
  },
});
