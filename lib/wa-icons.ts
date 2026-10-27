import {
  RiArchiveLine,
  RiChat3Line,
  RiCheckDoubleLine,
  RiCheckLine,
  RiCloseLine,
  RiEmotionLine,
  RiGroupLine,
  RiMegaphoneLine,
  RiMicLine,
  RiMore2Line,
  RiPhoneLine,
  RiAddLine,
  RiSearchLine,
  RiSendPlane2Line,
  RiSettings3Line,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiAttachment2,
  RiDonutChartLine,
  RiChatNewLine,
  RiLockLine,
  RiVolumeMuteLine,
  RiPushpinLine,
  type RemixiconComponentType,
} from '@remixicon/react';

/**
 * WhatsApp `data-icon` name → Remix Icon (BoardUI's icon set).
 * Names come from the live WhatsApp DOM; unknown names are simply left native.
 */
export const ICON_MAP: Record<string, RemixiconComponentType> = {
  // Left rail
  'chats-filled': RiChat3Line,
  'chats-outline': RiChat3Line,
  'chat-filled-refreshed': RiChat3Line,
  'chat-outline-refreshed': RiChat3Line,
  'calls-filled': RiPhoneLine,
  'calls-outline': RiPhoneLine,
  'status-refreshed': RiDonutChartLine,
  'status-outline': RiDonutChartLine,
  'newsletter-outline': RiMegaphoneLine,
  'newsletter-tab-outline-v2': RiMegaphoneLine,
  'community-refreshed-32': RiGroupLine,
  'community-tab-outline': RiGroupLine,
  'settings-refreshed': RiSettings3Line,
  'settings-outline': RiSettings3Line,
  // Headers and lists
  'new-chat-outline': RiChatNewLine,
  'menu': RiMore2Line,
  'more-refreshed': RiMore2Line,
  'search': RiSearchLine,
  'search-refreshed': RiSearchLine,
  'archived': RiArchiveLine,
  'archive-refreshed': RiArchiveLine,
  'down': RiArrowDownSLine,
  'chevron-down': RiArrowDownSLine,
  'back': RiArrowLeftLine,
  'back-refreshed': RiArrowLeftLine,
  'x': RiCloseLine,
  'close-refreshed': RiCloseLine,
  'pinned': RiPushpinLine,
  'pinned2': RiPushpinLine,
  'muted': RiVolumeMuteLine,
  'lock-small': RiLockLine,
  // Composer
  'plus-rounded': RiAddLine,
  'plus': RiAddLine,
  'clip': RiAttachment2,
  'emoji-panel': RiEmotionLine,
  'smiley': RiEmotionLine,
  'ptt': RiMicLine,
  'mic-outlined': RiMicLine,
  'send': RiSendPlane2Line,
  'wds-ic-send-filled': RiSendPlane2Line,
  // Message status
  'msg-check': RiCheckLine,
  'msg-dblcheck': RiCheckDoubleLine,
};

/** CSS that paints each mapped icon with its Remix glyph (currentColor), hiding WhatsApp's SVG. */
export function buildIconCss(svgByName: Record<string, string>): string {
  return Object.entries(svgByName)
    .filter(([name]) => /^[\w-]+$/.test(name))
    .map(([name, svg]) => {
      const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      const sel = `[data-icon="${name}"]`;
      return (
        `${sel}{position:relative !important;}` +
        `${sel}>svg{visibility:hidden !important;}` +
        `${sel}::after{content:"";position:absolute;inset:0;background:currentColor;` +
        `-webkit-mask:${url} center/contain no-repeat;mask:${url} center/contain no-repeat;pointer-events:none;}`
      );
    })
    .join('\n');
}
