import { useLayoutEffect, useRef } from 'react';
import { ICON_MAP, buildIconCss } from '@/lib/wa-icons';
import { findRuleSelectors } from '@/lib/wa-dom';
import { applyTheme, buildThemeCss, removeTheme, type NativeSelectors } from '@/lib/wa-theme';
import { Surface } from './shared';

const ICONS = Object.entries(ICON_MAP);

/**
 * Invisible: reads BoardUI's resolved dark tokens and Remix icon glyphs from
 * inside our shadow root and re-skins WhatsApp's native UI with them.
 * Unmounting (extension off) restores WhatsApp's own look.
 */
export function ThemeBridge() {
  const tokensRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tokens = tokensRef.current;
    const icons = iconsRef.current;
    if (!tokens || !icons) return;
    const cs = getComputedStyle(tokens);
    const svgByName: Record<string, string> = {};
    icons.querySelectorAll<HTMLElement>('[data-name]').forEach((el) => {
      const svg = el.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgByName[el.dataset.name!] = svg.outerHTML;
    });
    const iconCss = buildIconCss(svgByName);
    let applied = '';
    const apply = () => {
      // WhatsApp loads CSS chunks lazily (the conversation's on first open): look again until both are found.
      const native: NativeSelectors = {
        bubble: findRuleSelectors('--WAWeb-minimal-msg-bubble-shadow'),
        composer: findRuleSelectors('--chat-composer-background-color'),
      };
      // ~30ms over WhatsApp's ~24k rules: stop looking once both are there.
      if (native.bubble.length && native.composer.length) window.clearInterval(timer);
      const key = native.bubble.join() + '|' + native.composer.join();
      if (key === applied) return;
      applied = key;
      applyTheme(buildThemeCss((token) => cs.getPropertyValue(`--color-${token}`), native) + '\n' + iconCss);
    };
    const timer = window.setInterval(apply, 3000);
    apply();
    return () => {
      window.clearInterval(timer);
      removeTheme();
    };
  }, []);

  return (
    <Surface>
      <div ref={tokensRef} hidden />
      <div ref={iconsRef} hidden>
        {ICONS.map(([name, Icon]) => (
          <span key={name} data-name={name}>
            <Icon />
          </span>
        ))}
      </div>
    </Surface>
  );
}
