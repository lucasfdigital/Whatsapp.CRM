import { describe, expect, it } from 'vitest';
import { isAwaiting } from './chat-filters';

describe('isAwaiting', () => {
  it('is waiting while there are unread messages', () => {
    expect(isAwaiting({ unread: 3 })).toBe(true);
  });

  it('is waiting when the user marked it as unread', () => {
    expect(isAwaiting({ unread: 0, markedUnread: true })).toBe(true);
  });

  it('leaves once read, even if the other side spoke last', () => {
    expect(isAwaiting({ unread: 0 })).toBe(false);
    expect(isAwaiting({ unread: 0, markedUnread: false })).toBe(false);
  });
});
