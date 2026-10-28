import { z } from 'zod';
import type { ChatSummary, MessageSeen, PageMessage } from './protocol';

// The MAIN world is the page's context: validate everything it sends.

export const chatKindSchema = z.enum(['contact', 'group', 'other']);

/** Photo URLs from the page end up in <img src>: https only. */
export const profilePicSchema = z
  .string()
  .refine((url) => url.startsWith('https://'))
  .nullable();

export const chatSummarySchema = z.object({
  jid: z.string().min(1),
  kind: chatKindSchema,
  name: z.string(),
  lastAt: z.number().nullable(),
  unread: z.number().int().nonnegative(),
  archived: z.boolean(),
  lastFromMe: z.boolean().nullable(),
  markedUnread: z.boolean().optional(),
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  pic: profilePicSchema.optional(),
  preview: z.string().max(200).nullable().optional(),
}) satisfies z.ZodType<ChatSummary>;

export const chatListsSchema = z.array(z.object({ id: z.string().min(1), name: z.string() }));

export const messageSeenSchema = z.object({
  jid: z.string().min(1),
  at: z.number(),
  fromMe: z.boolean(),
}) satisfies z.ZodType<MessageSeen>;

export const pageMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('chatsChanged') }),
  z.object({ type: z.literal('message'), message: messageSeenSchema }),
  z.object({ type: z.literal('activeChat'), chat: chatSummarySchema.nullable() }),
  z.object({
    type: z.literal('response'),
    id: z.string(),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional(),
  }),
]) satisfies z.ZodType<PageMessage>;
