import './style.css';
import ReactDOM from 'react-dom/client';
import { useEffect, useState } from 'react';
import { enabledItem } from '@/lib/settings';
import { Switch } from '@/components/base/switch/switch';
import { UpdateNotice } from '../content/ui/UpdateNotice';

function Popup() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    enabledItem.getValue().then(setEnabled);
    return enabledItem.watch((v) => setEnabled(v));
  }, []);

  return (
    <main className="dark w-72 bg-background-primary-default p-4 font-sans text-text-primary">
      <h1 className="text-headline-medium">WhatsApp CRM</h1>
      <p className="mt-1 text-body-2-regular text-text-tertiary">
        {enabled
          ? 'Abas e CRM ativos no WhatsApp Web.'
          : 'WhatsApp Web no modo normal. Recarregue a aba do WhatsApp para descarregar a extensão por completo.'}
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-3">
        <span className="text-body-medium">{enabled ? 'Ligado' : 'Desligado'}</span>
        <Switch
          aria-label="Ligar ou desligar o CRM no WhatsApp"
          isSelected={!!enabled}
          isDisabled={enabled === null}
          onChange={(v) => enabledItem.setValue(v)}
        />
      </div>
      <div className="mt-3 empty:hidden">
        {/* Same box as the switch card above. */}
        <UpdateNotice className="rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2.5 ring-0" />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
