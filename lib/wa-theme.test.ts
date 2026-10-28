import { describe, expect, it } from 'vitest';
import { LIST_WIDTH, TOKEN_MAP, buildThemeCss } from './wa-theme';

describe('buildThemeCss', () => {
  it('maps every WhatsApp variable to its BoardUI token value', () => {
    const css = buildThemeCss((token) => `val(${token})`);
    for (const [token, vars] of Object.entries(TOKEN_MAP)) {
      for (const v of vars) expect(css).toContain(`${v}:val(${token}) !important;`);
    }
    expect(css).toContain('font-family:');
  });

  it('skips tokens that could not be resolved', () => {
    const css = buildThemeCss((token) => (token === 'accent-500' ? 'blue' : ''));
    expect(css).toContain('--WDS-accent:blue !important;');
    expect(css).not.toContain('--WDS-surface-default');
    expect(css).not.toContain('data-wacrm-pane');
  });

  it('gives each WhatsApp variable a single token', () => {
    const vars = Object.values(TOKEN_MAP).flat();
    expect(new Set(vars).size).toBe(vars.length);
  });

  it('draws the tagged native panes as cards on the ground color', () => {
    const css = buildThemeCss((token) => `val(${token})`);
    expect(css).toContain('border: 0 solid val(background-full)');
    expect(css).toContain('[data-wacrm-pane="left"]');
    expect(css).toContain('[data-wacrm-pane="right"]');
    expect(css).toContain(
      '[data-wacrm-pane="right"], [data-wacrm-layercard] > [data-wacrm-layerpanel][data-wacrm-layerfull] { border-width: 8px 8px 8px 4px !important;',
    );
    // Ligações, Arquivadas…: the layer's list and details are the same cards.
    expect(css).toContain(
      '[data-wacrm-pane="left"], [data-wacrm-layercard] > [data-wacrm-spacer] { border-width: 8px 4px 8px 0 !important;',
    );
    expect(css).toContain('[data-wacrm-layercard] > [data-wacrm-spacer]::after');
    expect(css).toContain(`width: ${LIST_WIDTH}px !important`);
    // The sidebar card's 1px line, drawn over WhatsApp's content.
    expect(css).toContain('[data-wacrm-pane]::after');
    expect(css).toContain('border: 1px solid val(border-button-white)');
  });

  it('gives WhatsApp tooltips the BoardUI tooltip look, only inside tooltips', () => {
    const css = buildThemeCss((token) => `val(${token})`);
    expect(css).toContain(
      '[role="tooltip"], [role="tooltip"] * { --WDS-surface-inverse: val(background-primary-default) !important; --WDS-content-inverse: val(text-primary) !important; }',
    );
    expect(css).toContain('[role="tooltip"] { border-radius: 8px !important; border: 1px solid val(border-button-default) !important; }');
    // Inverse colors elsewhere stay WhatsApp's.
    expect(css).not.toMatch(/:root, :root \* \{[^}]*--WDS-surface-inverse/);
  });
});

describe('buildIconCss', () => {
  it('hides the native svg and paints the remix glyph with currentColor', async () => {
    const { buildIconCss } = await import('./wa-icons');
    const css = buildIconCss({ 'chats-filled': '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>' });
    expect(css).toContain('[data-icon="chats-filled"]>svg{visibility:hidden !important;}');
    expect(css).toContain('background:currentColor');
    expect(css).toContain('data:image/svg+xml,');
  });
});

describe('chat look', () => {
  it('scopes native bubble/composer rules to the conversation, only when found', () => {
    const read = (token: string) => `val(${token})`;
    const css = buildThemeCss(read, { bubble: ['.xa', '.xb'], composer: ['.xc'] });
    expect(css).toContain('#main .xa, #main .xb { border-radius: 16px !important; }');
    expect(css).toContain('#main footer .xc {');
    const none = buildThemeCss(read);
    expect(none).not.toContain('border-radius: 16px');
    expect(none).toContain('span[data-icon="tail-in"]');
  });
});
