import { RiCloseLine, RiContactsBook2Line, RiDeleteBinLine, RiPriceTag3Line, RiStickyNoteLine } from '@remixicon/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Chip } from '@/components/base/badges/chip';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Textarea } from '@/components/base/textarea/textarea';
import type { ChatSummary } from '@/lib/bridge/protocol';
import type { Note } from '@/lib/repo/schema';
import { isContactInfoOpen, openContactInfo } from '@/lib/wa-dom';
import { cx } from '@/utils/cx';
import { useCrm, type CrmStore } from '../store';
import { STAGE_CHIP, Surface } from './shared';

/** Button injected into the open conversation's header: opens WhatsApp's info drawer at our CRM section. */
export function HeaderButton({ store }: { store: CrmStore }) {
  const active = useCrm(store, (s) => s.activeChat);
  const record = useCrm(store, (s) => (active ? s.tracked[active.jid] : undefined));
  const stage = useCrm(store, (s) => s.stages.find((st) => st.id === record?.stageId));
  const isCliente = record?.status === 'cliente';

  const [missing, setMissing] = useState<string | null>(null);
  const openCrm = () => {
    if (!active) return;
    setMissing(null);
    const opened = openContactInfo(active.name);
    // The drawer (and our section in it) mounts a moment later.
    let tries = 0;
    const scroll = () => {
      const section = document.querySelector<HTMLElement>('wacrm-info');
      if (section) scrollDrawerTo(section);
      else if (tries++ < 20) window.setTimeout(scroll, 100);
      else setMissing(opened);
    };
    scroll();
  };

  return (
    <Surface className="flex items-center gap-2 ps-2">
      <Button
        size="small"
        variant="secondary"
        leadingIcon={RiContactsBook2Line}
        title="Abrir CRM nos dados do contato"
        onClick={openCrm}
      >
        CRM
      </Button>
      {missing && (
        <span className="text-caption-1-regular text-text-error-primary">
          {isContactInfoOpen() ? 'Seção do CRM não montou' : `Dados do contato não encontrados (${missing})`}
        </span>
      )}
      {isCliente && stage && (
        <Chip variant="subtle" color={STAGE_CHIP[stage.color]}>
          {stage.name}
        </Chip>
      )}
    </Surface>
  );
}

/**
 * Scrolls only the drawer's own scroll area to the section. scrollIntoView
 * would also scroll WhatsApp's overflow-hidden page and shift the whole app up.
 */
function scrollDrawerTo(section: HTMLElement) {
  for (let el = section.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue;
    const top = section.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTo({ top, behavior: 'smooth' });
    return;
  }
}

/** CRM section inside WhatsApp's "Dados do contato/grupo" drawer, under the photo and name. */
export function InfoCrm({ store }: { store: CrmStore }) {
  const chat = useCrm(store, (s) => s.activeChat);
  if (!chat) return null;
  return (
    <Surface>
      <section aria-label="CRM" className="flex flex-col gap-4 border-y border-separator-border px-6 py-5">
        <h2 className="flex items-center gap-1.5 text-headline-medium">
          <RiContactsBook2Line className="size-5 text-foreground-icon-secondary" aria-hidden />
          <span className="min-w-0 truncate">
            CRM · <span className="wacrm-blur-names">{chat.name}</span>
          </span>
        </h2>
        <PanelBody key={chat.jid} store={store} chat={chat} />
      </section>
    </Surface>
  );
}

function PanelBody({ store, chat }: { store: CrmStore; chat: ChatSummary }) {
  const record = useCrm(store, (s) => s.tracked[chat.jid]);
  const stages = useCrm(store, (s) => s.stages);
  const isCliente = record?.status === 'cliente';
  const tags = record?.tags ?? [];
  return (
    <>
      <div className="flex flex-col gap-6">
        <Button
          variant={isCliente ? 'secondary' : 'primary'}
          size="small"
          onClick={() => store.setCliente(chat, !isCliente)}
        >
          {isCliente ? 'Remover dos clientes' : 'Marcar como cliente'}
        </Button>

        {isCliente && (
          <Section title="Etapa do pipeline">
            <div className="flex flex-wrap gap-2">
              {stages.map((stage, i) => {
                const current = record?.stageId === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={current}
                    onClick={() => !current && store.moveToStage(chat.jid, stage.id, Number.MAX_SAFE_INTEGER)}
                    className={cx(
                      'cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                      current ? 'ring-2 ring-accent-500' : 'opacity-60 hover:opacity-100',
                    )}
                    title={`Mover para ${stage.name}`}
                  >
                    <Chip variant="subtle" color={STAGE_CHIP[stage.color]}>
                      {i + 1}. {stage.name}
                    </Chip>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Tags" icon={RiPriceTag3Line}>
          <TagEditor tags={tags} onChange={(next) => store.setTags(chat, next)} />
        </Section>

        <Section title="Notas" icon={RiStickyNoteLine}>
          <Notes store={store} jid={chat.jid} />
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof RiPriceTag3Line;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-caption-1-semibold text-text-tertiary uppercase">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...tags, draft]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              title="Remover tag"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="group cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <Chip variant="subtle" color="blue" className="gap-1">
                {tag}
                <RiCloseLine className="size-3 opacity-60 group-hover:opacity-100" aria-hidden />
              </Chip>
            </button>
          ))}
        </div>
      )}
      <Input
        size="small"
        placeholder="Nova tag e Enter"
        aria-label="Nova tag"
        value={draft}
        onChange={setDraft}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
    </div>
  );
}

function Notes({ store, jid }: { store: CrmStore; jid: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const reload = useCallback(() => store.listNotes(jid).then(setNotes), [store, jid]);
  useEffect(() => {
    reload();
  }, [reload]);

  const save = async () => {
    if (!draft.trim()) return;
    await store.addNote(jid, draft);
    setDraft('');
    reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        size="small"
        placeholder="Anotação de reunião, combinado, próximo passo…"
        aria-label="Nova nota"
        rows={3}
        autoResize
        maxRows={8}
        value={draft}
        onChange={setDraft}
      />
      <Button size="small" variant="secondary" onClick={save} disabled={!draft.trim()}>
        Salvar nota
      </Button>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="group rounded-xl border border-border-button-default bg-background-secondary-default p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-caption-1-medium text-text-tertiary">
                  {new Date(note.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <button
                  type="button"
                  aria-label="Apagar nota"
                  onClick={async () => {
                    await store.deleteNote(note.id);
                    reload();
                  }}
                  className="cursor-pointer rounded-md p-0.5 text-foreground-icon-tertiary opacity-0 outline-none group-hover:opacity-100 hover:text-text-error-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  <RiDeleteBinLine className="size-4" />
                </button>
              </div>
              <p className="text-body-2-regular whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
