import { z } from 'zod';
import { chatKindSchema } from '@/lib/bridge/schemas';

export const SCHEMA_VERSION = 2;

export const chatStatusSchema = z.enum(['none', 'lead', 'cliente', 'parceiro', 'arquivado']);
export type ChatStatus = z.infer<typeof chatStatusSchema>;

/**
 * A chat the user chose to track. Only metadata: no message content is stored.
 * Keyed by WhatsApp JID (`...@c.us` contact, `...@g.us` group), which survives renames.
 */
export const chatRecordSchema = z.object({
  jid: z.string().min(1),
  kind: chatKindSchema,
  displayName: z.string(),
  status: chatStatusSchema,
  stageId: z.string().nullable(),
  position: z.number(),
  tags: z.array(z.string()),
  lastInboundAt: z.number().nullable(),
  lastOutboundAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ChatRecord = z.infer<typeof chatRecordSchema>;

export const metaSchema = z.object({
  schemaVersion: z.number().int(),
  lastBackupAt: z.number().nullable(),
});
export type Meta = z.infer<typeof metaSchema>;

export const chatsSchema = z.record(z.string(), chatRecordSchema);
export type Chats = z.infer<typeof chatsSchema>;

/** Pipeline column (Kanban de clientes). `order` sorts columns left to right. */
export const stageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number(),
  color: z.enum(['blue', 'green', 'orange', 'red', 'purple', 'gray']),
});
export type Stage = z.infer<typeof stageSchema>;
export const stagesSchema = z.record(z.string(), stageSchema);
export type Stages = z.infer<typeof stagesSchema>;

/** Free-text note the user writes about a chat (never message content). */
export const noteSchema = z.object({
  id: z.string().min(1),
  jid: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.number(),
});
export type Note = z.infer<typeof noteSchema>;
export const notesSchema = z.record(z.string(), noteSchema);
export type Notes = z.infer<typeof notesSchema>;

export const DEFAULT_STAGES: Stage[] = [
  { id: 'onboarding', name: 'Onboarding', order: 0, color: 'blue' },
  { id: 'ativo', name: 'Ativo', order: 1, color: 'green' },
  { id: 'em-risco', name: 'Em risco', order: 2, color: 'orange' },
  { id: 'renovacao', name: 'Renovação', order: 3, color: 'purple' },
  { id: 'churn', name: 'Churn', order: 4, color: 'red' },
];

/** Top-level storage keys. Each new collection gets its own key + a migration. */
export const KEYS = { meta: 'meta', chats: 'chats', stages: 'stages', notes: 'notes' } as const;
