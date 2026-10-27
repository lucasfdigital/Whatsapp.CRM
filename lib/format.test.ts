import { describe, expect, it } from 'vitest';
import { formatChatTime, initials, matchesQuery, phoneOf } from './format';

describe('formatChatTime', () => {
  const now = new Date(2026, 9, 27, 15, 0); // terça, 27/10/2026 15:00

  it('shows hour for today', () => {
    expect(formatChatTime(new Date(2026, 9, 27, 10, 14).getTime(), now)).toBe('10:14');
  });
  it('shows Ontem for yesterday', () => {
    expect(formatChatTime(new Date(2026, 9, 26, 23, 59).getTime(), now)).toBe('Ontem');
  });
  it('shows weekday within the last week', () => {
    expect(formatChatTime(new Date(2026, 9, 23, 9, 0).getTime(), now)).toBe('Sexta-feira');
  });
  it('shows date when older', () => {
    expect(formatChatTime(new Date(2026, 8, 1, 9, 0).getTime(), now)).toBe('01/09/2026');
  });
  it('handles missing time', () => {
    expect(formatChatTime(null, now)).toBe('');
  });
});

describe('initials', () => {
  it('takes first and last word', () => {
    expect(initials('Gabriel Nobrega')).toBe('GN');
    expect(initials('NETWORKING DIGITAL 🚀🔥')).toBe('ND');
    expect(initials('Paulo')).toBe('P');
    expect(initials('🚀')).toBe('?');
  });
});

describe('matchesQuery', () => {
  it('ignores case and accents', () => {
    expect(matchesQuery('Eventos Eletrônicos', 'eletronicos')).toBe(true);
    expect(matchesQuery('Sócrates Sampaio', 'SOCRATES')).toBe(true);
    expect(matchesQuery('Paulo', 'maria')).toBe(false);
    expect(matchesQuery('Paulo', '  ')).toBe(true);
  });
});

describe('phoneOf', () => {
  it('shows the number only for phone ids', () => {
    expect(phoneOf('5511999990000@c.us')).toBe('+5511999990000');
    expect(phoneOf('15114359066826@lid')).toBeNull();
    expect(phoneOf('123-456@g.us')).toBeNull();
  });
});
