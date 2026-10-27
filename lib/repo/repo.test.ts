import { describe, expect, it } from 'vitest';
import { memoryKV } from './kv';
import { migrate } from './migrations';
import { createRepo } from './repo';
import { SCHEMA_VERSION } from './schema';

const group = { jid: '120363000000000000@g.us', kind: 'group' as const, displayName: 'Cliente ACME' };

describe('migrate', () => {
  it('initializes empty storage at the current version', () => {
    const out = migrate({});
    expect(out.meta).toEqual({ schemaVersion: SCHEMA_VERSION, lastBackupAt: null });
    expect(out.chats).toEqual({});
  });

  it('refuses data from a newer extension version', () => {
    expect(() => migrate({ meta: { schemaVersion: SCHEMA_VERSION + 1 } })).toThrow(/Atualize/);
  });

  it('is a no-op when already current', () => {
    const current = migrate({});
    expect(migrate(current)).toBe(current);
  });
});

describe('repo', () => {
  it('tracks a chat once and keeps it across instances (same storage)', async () => {
    const kv = memoryKV();
    const repo = createRepo(kv, () => 1000);
    await repo.trackChat(group);
    await repo.trackChat({ ...group, displayName: 'ACME (novo nome)' });

    const reopened = createRepo(kv);
    const chats = await reopened.listChats();
    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({ jid: group.jid, displayName: 'ACME (novo nome)', status: 'none' });
  });

  it('marks and unmarks a group as cliente', async () => {
    const repo = createRepo(memoryKV());
    await repo.trackChat(group);
    expect((await repo.setStatus(group.jid, 'cliente')).status).toBe('cliente');
    expect((await repo.setStatus(group.jid, 'none')).status).toBe('none');
  });

  it('rejects status change for untracked chat', async () => {
    const repo = createRepo(memoryKV());
    await expect(repo.setStatus('x@g.us', 'cliente')).rejects.toThrow(/não rastreado/);
  });

  it('records message direction only for tracked chats and ignores older events', async () => {
    const kv = memoryKV();
    const repo = createRepo(kv);
    let writes = 0;
    await repo.init();
    kv.onChanged(() => writes++);

    await repo.recordMessage('stranger@c.us', 5000, false);
    expect(writes).toBe(0);
    expect(await repo.getChat('stranger@c.us')).toBeUndefined();

    await repo.trackChat(group);
    await repo.recordMessage(group.jid, 5000, false);
    await repo.recordMessage(group.jid, 4000, false);
    await repo.recordMessage(group.jid, 6000, true);
    expect(await repo.getChat(group.jid)).toMatchObject({ lastInboundAt: 5000, lastOutboundAt: 6000 });
  });

  it('does not lose writes when updates run concurrently', async () => {
    const repo = createRepo(memoryKV());
    const jids = Array.from({ length: 20 }, (_, i) => `${i}@c.us`);
    await Promise.all(jids.map((jid) => repo.trackChat({ jid, kind: 'contact', displayName: jid })));
    expect(await repo.listChats()).toHaveLength(20);
  });

  it('notifies listeners on change', async () => {
    const repo = createRepo(memoryKV());
    await repo.init();
    let calls = 0;
    repo.onChange(() => calls++);
    await repo.trackChat(group);
    expect(calls).toBe(1);
  });
});

describe('v2: pipeline + notes', () => {
  it('migrates v1 data keeping chats and putting clientes in the first stage', () => {
    const v1 = {
      meta: { schemaVersion: 1, lastBackupAt: null },
      chats: {
        [group.jid]: { ...group, status: 'cliente', stageId: null, position: 0, tags: [], lastInboundAt: null, lastOutboundAt: null, createdAt: 1, updatedAt: 1 },
        'x@c.us': { jid: 'x@c.us', kind: 'contact', displayName: 'X', status: 'none', stageId: null, position: 0, tags: [], lastInboundAt: null, lastOutboundAt: null, createdAt: 1, updatedAt: 1 },
      },
    };
    const out = migrate(v1) as any;
    expect(out.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.chats[group.jid].stageId).toBe('onboarding');
    expect(out.chats['x@c.us'].stageId).toBeNull();
    expect(Object.keys(out.stages)).toEqual(['onboarding', 'ativo', 'em-risco', 'renovacao', 'churn']);
    expect(out.notes).toEqual({});
  });

  it('new cliente goes to the end of the first stage', async () => {
    const repo = createRepo(memoryKV());
    for (const jid of ['a@g.us', 'b@g.us']) {
      await repo.trackChat({ jid, kind: 'group', displayName: jid });
      await repo.setStatus(jid, 'cliente');
    }
    expect(await repo.getChat('a@g.us')).toMatchObject({ stageId: 'onboarding', position: 0 });
    expect(await repo.getChat('b@g.us')).toMatchObject({ stageId: 'onboarding', position: 1 });
  });

  it('moves a card between columns and renumbers positions', async () => {
    const repo = createRepo(memoryKV());
    for (const jid of ['a@g.us', 'b@g.us', 'c@g.us']) {
      await repo.trackChat({ jid, kind: 'group', displayName: jid });
      await repo.setStatus(jid, 'cliente');
    }
    await repo.moveToStage('c@g.us', 'ativo', 0);
    await repo.moveToStage('a@g.us', 'ativo', 0);
    const chats = Object.fromEntries((await repo.listChats()).map((c) => [c.jid, c]));
    expect(chats['a@g.us']).toMatchObject({ stageId: 'ativo', position: 0 });
    expect(chats['c@g.us']).toMatchObject({ stageId: 'ativo', position: 1 });
    expect(chats['b@g.us']).toMatchObject({ stageId: 'onboarding', position: 0 });
    await expect(repo.moveToStage('a@g.us', 'nao-existe', 0)).rejects.toThrow(/Etapa/);
  });

  it('dedupes tags and manages notes per chat', async () => {
    const repo = createRepo(memoryKV(), () => 10);
    await repo.trackChat(group);
    await repo.setTags(group.jid, [' vip ', 'vip', '', 'saas']);
    expect((await repo.getChat(group.jid))?.tags).toEqual(['vip', 'saas']);

    const n1 = await repo.addNote(group.jid, '  Reunião de kickoff ok  ');
    await repo.addNote('outro@g.us', 'não aparece');
    expect((await repo.listNotes(group.jid)).map((n) => n.body)).toEqual(['Reunião de kickoff ok']);
    await repo.deleteNote(n1.id);
    expect(await repo.listNotes(group.jid)).toEqual([]);
  });
});
