import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIVACY,
  NATIVE_SELECTORS,
  buildPrivacyCss,
  normalizePrivacy,
  privacyVars,
  type PrivacySettings,
} from './privacy';

const withBlur = (patch: Partial<PrivacySettings['blur']>, rest: Partial<PrivacySettings> = {}): PrivacySettings => ({
  ...DEFAULT_PRIVACY,
  ...rest,
  blur: { ...DEFAULT_PRIVACY.blur, ...patch },
});

describe('privacy', () => {
  it('adds no rules when everything is off', () => {
    expect(buildPrivacyCss(DEFAULT_PRIVACY)).toBe('');
  });

  it('gates each option on its own selectors, with hover to reveal', () => {
    const css = buildPrivacyCss(withBlur({ names: true }));
    expect(css).toContain(`${NATIVE_SELECTORS.names[0]}, `);
    expect(css).toContain(`${NATIVE_SELECTORS.names[0]}:hover`);
    expect(css).not.toContain(NATIVE_SELECTORS.messages[0]);
    expect(css).toContain('transition: filter 150ms ease');
  });

  it('adds selectors found at runtime (hashed bubble/composer classes)', () => {
    const css = buildPrivacyCss(withBlur({ messages: true }), { messages: ['#main .x1abc'] });
    expect(css).toContain('#main .x1abc');
    expect(css).toContain('#main .x1abc:hover');
  });

  it('reveals instantly without transition', () => {
    const settings = withBlur({ photos: true }, { noTransition: true });
    expect(buildPrivacyCss(settings)).toContain('transition: none');
    expect(privacyVars(settings)['--wacrm-blur-transition']).toBe('0s');
  });

  it('exposes one variable per option for our surfaces', () => {
    const vars = privacyVars(withBlur({ previews: true }));
    expect(vars['--wacrm-blur-previews']).toBe('blur(5px)');
    expect(vars['--wacrm-blur-names']).toBe('none');
  });

  it('fills missing stored keys as off', () => {
    expect(normalizePrivacy({ blur: { names: true } } as Partial<PrivacySettings>).blur).toMatchObject({
      names: true,
      messages: false,
    });
    expect(normalizePrivacy(undefined)).toEqual(DEFAULT_PRIVACY);
  });
});
