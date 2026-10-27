import { DEFAULT_STAGES, KEYS, SCHEMA_VERSION } from './schema';

type Snapshot = Record<string, unknown>;

/**
 * migrations[n] upgrades data from version n-1 to n.
 * Rule: never edit a shipped migration; add a new one and bump SCHEMA_VERSION.
 */
export const migrations: Record<number, (data: Snapshot) => Snapshot> = {
  1: (data) => ({
    ...data,
    [KEYS.meta]: { schemaVersion: 1, lastBackupAt: null },
    [KEYS.chats]: data[KEYS.chats] ?? {},
  }),
  // v2: pipeline stages + notes. Existing clientes start in the first stage.
  2: (data) => {
    const first = DEFAULT_STAGES[0]!.id;
    const chats = { ...((data[KEYS.chats] as Record<string, { status: string; stageId: string | null }>) ?? {}) };
    for (const [jid, chat] of Object.entries(chats)) {
      if (chat.status === 'cliente' && chat.stageId == null) chats[jid] = { ...chat, stageId: first };
    }
    return {
      ...data,
      [KEYS.chats]: chats,
      [KEYS.stages]: Object.fromEntries(DEFAULT_STAGES.map((s) => [s.id, s])),
      [KEYS.notes]: {},
    };
  },
};

export function currentVersion(data: Snapshot): number {
  const meta = data[KEYS.meta] as { schemaVersion?: unknown } | undefined;
  return typeof meta?.schemaVersion === 'number' ? meta.schemaVersion : 0;
}

export function migrate(data: Snapshot, target = SCHEMA_VERSION): Snapshot {
  let version = currentVersion(data);
  if (version > target) {
    throw new Error(`Dados na versão ${version}, extensão entende até ${target}. Atualize a extensão.`);
  }
  let out = data;
  while (version < target) {
    version += 1;
    const step = migrations[version];
    if (!step) throw new Error(`Migração ${version} não existe`);
    out = step(out);
    out = { ...out, [KEYS.meta]: { ...(out[KEYS.meta] as object), schemaVersion: version } };
  }
  return out;
}
