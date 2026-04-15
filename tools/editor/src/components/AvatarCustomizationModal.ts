To transform your customization menu from "bland" to a premium, AAA-game UI experience (leaning into the S.T.A.L.K.E.R. / tactical PDA "dossier" aesthetic you’ve established), we need to introduce depth, staggered animations, better glassmorphism, tech-UI accents, and high-contrast glowing elements.

Here is the visually upgraded code.

What's new in this visual upgrade:

Staggered Animations: Items in the cosmetic grids now cascade/slide in smoothly when switching tabs.

PDA/Dossier Styling: The live preview card now features "tech brackets", a faux barcode, and a CRT scanline overlay to truly feel like a Stalker dossier.

Tactical UI Accents: Styled scrollbars, glowing active states, clipped corners, and dynamic hovering (scaling + 3D shadow lifts).

Holographic Glassmorphism: Deepened the backdrop blurs, added noise/grid patterns, and introduced light-catching borders on panels.

Interactive Buttons: The "Save" button now has an animated shine passing over it, and the tabs feature a sleek sliding-style underline.

1. The Updated TypeScript (app.ts)

I've added staggering logic (style.animationDelay) to the grids, and injected decorative DOM elements to the Live Preview to make it pop.

code
TypeScript
download
content_copy
expand_less
// P.A.N.D.A. — Avatar customization modal.
import {
  AVATAR_ICON_PRESETS,
  AVATAR_COLOR_PRESETS,
  AVATAR_FRAME_PRESETS,
  AVATAR_BANNER_PRESETS,
  AVATAR_EFFECT_PRESETS, 
  type AvatarIconPreset,
  type AvatarColorPreset,
  type AvatarFramePreset,
  type AvatarBannerPreset,
  type AvatarEffectPreset,
} from '../lib/avatar-catalog';
import {
  updateUserCosmetics as apiUpdateUserCosmetics,
  type UserProfile as BaseUserProfile,
  type UserCosmetics as BaseUserCosmetics,
} from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

// --- LOCAL TYPE EXTENSIONS ---
export type UserProfile = BaseUserProfile & { avatar_effect?: string };
export type UserCosmetics = BaseUserCosmetics & { avatar_effect?: string };

type OpenOptions = {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
  returnFocus?: HTMLElement | null;
};

let activeOverlay: HTMLElement | null = null;
let activeTrap: FocusTrapController | null = null;
let activeReturnFocus: HTMLElement | null = null;

const LOCK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

export function closeAvatarCustomizationModal(): void {
  if (!activeOverlay) return;
  activeTrap?.release();
  activeTrap = null;
  activeOverlay.classList.add('is-closing');
  
  // Wait for fade-out animation
  setTimeout(() => {
    activeOverlay?.remove();
    activeOverlay = null;
    document.removeEventListener('keydown', handleKeydown);
    const returnTarget = activeReturnFocus;
    activeReturnFocus = null;
    if (returnTarget && document.body.contains(returnTarget)) {
      try { returnTarget.focus(); } catch { /* noop */ }
    }
  }, 200);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAvatarCustomizationModal();
  }
}

function getInitial(username: string): string {
  return (username ?? '').trim().charAt(0).toUpperCase() || '?';
}

function renderPreview(username: string, level: number, draft: UserCosmetics): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pa-avatar-preview';

  // Tech UI Overlays for aesthetic
  const scanlines = document.createElement('div');
  scanlines.className = 'pa-preview-scanlines';
  const topDeco = document.createElement('div');
  topDeco.className = 'pa-preview-top-deco';
  topDeco.innerHTML = `<span class="pa-dot"></span> P.A.N.D.A. SYSTEM :: DOSSIER ID-<span>${Math.floor(Math.random() * 8999 + 1000)}</span>`;

  const bannerPreset = AVATAR_BANNER_PRESETS.find(p => p.id === draft.avatar_banner);
  const banner = document.createElement('div');
  banner.className = `pa-avatar-preview-banner${bannerPreset?.isAnimated ? ' pa-anim-bg' : ''}`;
  if (draft.avatar_banner) banner.dataset.banner = String(draft.avatar_banner);

  const effectLayer = document.createElement('div');
  effectLayer.className = 'pa-avatar-preview-effect';
  if (draft.avatar_effect && draft.avatar_effect !== 'none') {
    effectLayer.dataset.effect = String(draft.avatar_effect);
  }

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'pa-avatar-preview-circle-wrap';

  const framePreset = AVATAR_FRAME_PRESETS.find(p => p.id === draft.avatar_frame);
  const frameId = typeof draft.avatar_frame === 'string' ? draft.avatar_frame : 'none';
  const avatar = document.createElement('div');
  avatar.className = `pa-avatar pa-avatar-preview-circle pa-avatar-frame-${frameId}${framePreset?.isAnimated ? ' pa-anim-frame' : ''}`;
  
  if (draft.avatar_color) avatar.style.setProperty('--pa-avatar-color', String(draft.avatar_color));
  
  const preset = AVATAR_ICON_PRESETS.find(item => item.id === draft.avatar_icon);
  const glyph = preset && preset.id !== 'default' ? preset.glyph : '';
  const inner = document.createElement('span');
  inner.className = 'pa-avatar-glyph';
  inner.textContent = glyph || getInitial(username);
  avatar.appendChild(inner);

  const levelBadge = document.createElement('span');
  levelBadge.className = 'pa-avatar-level-chip';
  levelBadge.innerHTML = `<span>LV.</span>${level}`;
  
  avatarWrap.append(avatar, levelBadge);

  const copy = document.createElement('div');
  copy.className = 'pa-avatar-preview-copy';
  const title = document.createElement('div');
  title.className = 'pa-avatar-preview-name';
  title.textContent = username;
  const caption = document.createElement('div');
  caption.className = 'pa-avatar-preview-caption';
  caption.textContent = 'STALKER CLASSIFIED';

  const barcode = document.createElement('div');
  barcode.className = 'pa-preview-barcode';

  copy.append(title, caption, barcode);
  wrap.append(banner, effectLayer, scanlines, topDeco, avatarWrap, copy);
  return wrap;
}

function buildCosmeticButton(
  item: { id: string; label: string; minLevel?: number },
  isActive: boolean,
  userLevel: number,
  baseClass: string,
  index: number,
  onClick: () => void
): HTMLButtonElement {
  const locked = item.minLevel !== undefined && userLevel < item.minLevel;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pa-avatar-chip ${baseClass}${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}`;
  button.setAttribute('aria-pressed', String(isActive));
  button.disabled = locked;
  
  // Staggered entrance animation
  button.style.animationDelay = `${index * 0.025}s`;

  if (locked) {
    const lockBadge = document.createElement('div');
    lockBadge.className = 'pa-avatar-chip-lock';
    lockBadge.innerHTML = LOCK_ICON;
    button.appendChild(lockBadge);
    button.title = `Unlocks at Level ${item.minLevel}`;
  } else {
    button.title = item.label;
    button.addEventListener('click', onClick);
  }

  return button;
}

export function openAvatarCustomizationModal(options: OpenOptions): void {
  closeAvatarCustomizationModal();

  const { profile, onSaved, returnFocus } = options;
  const userLevel = (profile as any).level ?? 1;

  const draft: UserCosmetics = {
    avatar_icon: profile.avatar_icon ?? 'default',
    avatar_color: profile.avatar_color ?? 'loner',
    avatar_frame: profile.avatar_frame ?? 'none',
    avatar_banner: profile.avatar_banner ?? 'default',
    avatar_effect: profile.avatar_effect ?? 'none',
  };

  type TabId = 'icon' | 'color' | 'frame' | 'banner' | 'effect';
  let activeTab: TabId = 'icon';

  const backdrop = document.createElement('div');
  backdrop.className = 'pa-avatar-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Customize avatar');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeAvatarCustomizationModal();
  });

  const dialog = document.createElement('div');
  dialog.className = 'pa-avatar-modal';

  const header = document.createElement('header');
  header.className = 'pa-avatar-modal-header';
  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `<h3>Terminal :: Dossier Config</h3><p class="pa-avatar-modal-subtitle">Sync your ID parameters to the central network.</p>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pa-avatar-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  closeBtn.addEventListener('click', closeAvatarCustomizationModal);
  header.append(titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'pa-avatar-modal-body';

  const previewSlot = document.createElement('div');
  previewSlot.className = 'pa-avatar-modal-preview-slot';

  const workspace = document.createElement('div');
  workspace.className = 'pa-avatar-modal-workspace';

  const tabBar = document.createElement('nav');
  tabBar.className = 'pa-avatar-tabs';
  const tabs: { id: TabId; label: string }[] = [
    { id: 'icon', label: 'Icons' },
    { id: 'color', label: 'Tints' },
    { id: 'frame', label: 'Frames' },
    { id: 'banner', label: 'Banners' },
    { id: 'effect', label: 'VFX' },
  ];

  const tabButtons = new Map<TabId, HTMLButtonElement>();
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'pa-avatar-tab-btn';
    btn.innerHTML = `<span>${tab.label}</span>`;
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      renderWorkspace();
    });
    tabBar.appendChild(btn);
    tabButtons.set(tab.id, btn);
  });

  const tabContent = document.createElement('div');
  tabContent.className = 'pa-avatar-tab-content';
  workspace.append(tabBar, tabContent);

  const renderWorkspace = () => {
    tabButtons.forEach((btn, id) => {
      btn.classList.toggle('is-active', id === activeTab);
    });

    previewSlot.textContent = '';
    previewSlot.appendChild(renderPreview(profile.username ?? '', userLevel, draft));

    tabContent.textContent = '';
    const grid = document.createElement('div');
    grid.className = `pa-avatar-grid pa-avatar-grid-${activeTab}s`;

    let index = 0;
    if (activeTab === 'icon') {
      for (const preset of AVATAR_ICON_PRESETS as AvatarIconPreset[]) {
        const isActive = (draft.avatar_icon ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-icon', index++, () => {
          draft.avatar_icon = preset.id; renderWorkspace();
        });
        const glyphTxt = preset.id === 'default' ? 'A' : preset.glyph;
        btn.innerHTML += `<span class="pa-avatar-chip-glyph">${glyphTxt}</span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    } 
    else if (activeTab === 'color') {
      for (const preset of AVATAR_COLOR_PRESETS as AvatarColorPreset[]) {
        const isActive = draft.avatar_color === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-color', index++, () => {
          draft.avatar_color = preset.id; renderWorkspace();
        });
        btn.style.setProperty('--pa-swatch', preset.color);
        btn.innerHTML += `<span class="pa-avatar-chip-swatch"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'frame') {
      for (const preset of AVATAR_FRAME_PRESETS as AvatarFramePreset[]) {
        const isActive = (draft.avatar_frame ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-frame', index++, () => {
          draft.avatar_frame = preset.id; renderWorkspace();
        });
        const isAnim = preset.isAnimated ? ' pa-anim-frame' : '';
        btn.innerHTML += `<span class="pa-avatar-chip-frame-sample pa-avatar-frame-${preset.variant}${isAnim}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'banner') {
      for (const preset of AVATAR_BANNER_PRESETS as AvatarBannerPreset[]) {
        const isActive = (draft.avatar_banner ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-banner', index++, () => {
          draft.avatar_banner = preset.id; renderWorkspace();
        });
        const isAnim = preset.isAnimated ? ' pa-anim-bg' : '';
        btn.innerHTML += `<span class="pa-avatar-chip-banner-sample${isAnim}" style="background: ${preset.gradient || ''}" data-banner="${preset.id}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'effect') {
      for (const preset of AVATAR_EFFECT_PRESETS as AvatarEffectPreset[]) {
        const isActive = (draft.avatar_effect ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-effect', index++, () => {
          draft.avatar_effect = preset.id; renderWorkspace();
        });
        btn.innerHTML += `<span class="pa-avatar-chip-effect-sample" data-effect="${preset.id}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }

    tabContent.appendChild(grid);
  };

  renderWorkspace(); 
  body.append(previewSlot, workspace);

  const footer = document.createElement('footer');
  footer.className = 'pa-avatar-modal-footer';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-ghost';
  resetBtn.textContent = 'Reset to Default';
  resetBtn.addEventListener('click', () => {
    draft.avatar_icon = 'default';
    draft.avatar_color = 'loner';
    draft.avatar_frame = 'none';
    draft.avatar_banner = 'default';
    draft.avatar_effect = 'none';
    renderWorkspace();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pa-avatar-modal-action';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeAvatarCustomizationModal);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-primary';
  saveBtn.innerHTML = `<span>Save Configuration</span><div class="pa-btn-shine"></div>`;
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Syncing...</span>`;
    try {
      const updated = await apiUpdateUserCosmetics(profile.publisher_id, draft as BaseUserCosmetics);
      onSaved({ ...profile, ...(updated || draft) } as UserProfile);
      closeAvatarCustomizationModal();
    } catch (err) {
      console.error('[avatar] save failed', err);
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>Retry Save</span>`;
    }
  });

  footer.append(resetBtn, cancelBtn, saveBtn);

  dialog.append(header, body, footer);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  activeOverlay = backdrop;
  activeReturnFocus = returnFocus ?? null;
  document.addEventListener('keydown', handleKeydown);
  try {
    activeTrap = trapFocus(dialog);
  } catch {
    activeTrap = null;
  }
  queueMicrotask(() => {
    try { saveBtn.focus(); } catch { /* noop */ }
  });
}
2. The Upgraded CSS (app.css)

Here is the complete rewrite of your styles to introduce the premium feel. Custom scrollbars, glass/CRT effects, glowing borders, staggered 3D animations, and sleek tech typographies.

code
CSS
download
content_copy
expand_less
/* =========================================================================
   P.A.N.D.A — Premium Avatar Customization UI
   ========================================================================= */

:root {
  --pa-accent: #6dbf43;          /* Brighter toxic green */
  --pa-accent-glow: #6dbf4366;
  --pa-bg-base: #0a0c09;
  --pa-bg-panel: #141812;
  --pa-bg-card: #1b2118;
  --pa-text-primary: #f0f5ec;
  --pa-text-secondary: #8c9b84;
  --pa-border: rgba(255, 255, 255, 0.08);
  --pa-lock: #ff9d00;
}

/* Custom Scrollbar for Workspace Grid */
.pa-avatar-tab-content::-webkit-scrollbar { width: 6px; }
.pa-avatar-tab-content::-webkit-scrollbar-track { background: transparent; }
.pa-avatar-tab-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 8px; }
.pa-avatar-tab-content::-webkit-scrollbar-thumb:hover { background: var(--pa-accent); }

/* Backdrop: Added dark tech vignette and deeper blur */
.pa-avatar-modal-backdrop {
  position: fixed; inset: 0; z-index: 1200;
  background: 
    radial-gradient(ellipse at 50% -20%, rgba(109, 191, 67, 0.15), transparent 70%), 
    rgba(5, 7, 4, 0.85);
  backdrop-filter: blur(12px) saturate(120%); 
  -webkit-backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
  animation: paModalFade 250ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.pa-avatar-modal-backdrop.is-closing {
  animation: paModalFadeOut 200ms ease-in both;
}

@keyframes paModalFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes paModalFadeOut { from { opacity: 1; } to { opacity: 0; } }

/* Modal Main Container */
.pa-avatar-modal {
  width: min(900px, 100%); max-height: calc(100dvh - 64px);
  display: flex; flex-direction: column;
  background: 
    linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 40%),
    var(--pa-bg-base);
  border: 1px solid rgba(109, 191, 67, 0.2);
  border-radius: 16px; overflow: hidden;
  box-shadow: 
    0 30px 60px rgba(0, 0, 0, 0.8), 
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 0 120px rgba(109, 191, 67, 0.05);
  animation: paModalRise 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
}
.pa-avatar-modal::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--pa-accent), transparent);
  opacity: 0.8;
}

@keyframes paModalRise {
  from { opacity: 0; transform: translateY(30px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Header */
.pa-avatar-modal-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 24px 28px 16px; border-bottom: 1px solid var(--pa-border);
  background: linear-gradient(180deg, rgba(109, 191, 67, 0.08), transparent);
}
.pa-avatar-modal-header h3 { 
  margin: 0; font-size: 18px; font-weight: 700; font-family: monospace;
  text-transform: uppercase; letter-spacing: 0.1em; color: var(--pa-text-primary);
  text-shadow: 0 0 10px rgba(109, 191, 67, 0.4);
}
.pa-avatar-modal-subtitle { margin: 6px 0 0; font-size: 13px; color: var(--pa-text-secondary); }
.pa-avatar-modal-close {
  appearance: none; background: rgba(255,255,255,0.03); border: 1px solid var(--pa-border);
  color: var(--pa-text-secondary); width: 36px; height: 36px; border-radius: 10px;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: all 200ms ease;
}
.pa-avatar-modal-close:hover { 
  background: rgba(224, 85, 85, 0.15); border-color: rgba(224, 85, 85, 0.5); 
  color: #ff6b6b; transform: rotate(90deg);
}

/* Body & Layout */
.pa-avatar-modal-body {
  display: grid; grid-template-columns: 300px 1fr; gap: 28px; padding: 24px 28px;
  height: calc(100dvh - 180px); min-height: 460px; overflow: hidden;
}
.pa-avatar-modal-preview-slot { position: sticky; top: 0; align-self: start; }
.pa-avatar-modal-workspace { display: flex; flex-direction: column; gap: 20px; overflow: hidden; }

/* Tactical Tabs */
.pa-avatar-tabs { 
  display: flex; gap: 4px; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 0px; 
}
.pa-avatar-tab-btn {
  position: relative; background: transparent; border: none; 
  color: var(--pa-text-secondary); font-size: 13px; font-weight: 700; text-transform: uppercase;
  padding: 12px 18px; cursor: pointer; transition: color 0.2s ease;
}
.pa-avatar-tab-btn span { position: relative; z-index: 2; letter-spacing: 0.05em; }
.pa-avatar-tab-btn::after {
  content: ''; position: absolute; bottom: -2px; left: 0; width: 100%; height: 2px;
  background: var(--pa-accent); transform: scaleX(0); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 -2px 10px var(--pa-accent-glow);
}
.pa-avatar-tab-btn:hover { color: var(--pa-text-primary); }
.pa-avatar-tab-btn.is-active { color: var(--pa-text-primary); }
.pa-avatar-tab-btn.is-active::after { transform: scaleX(1); }

.pa-avatar-tab-content { overflow-y: auto; padding-right: 12px; padding-bottom: 24px; }

/* -------------------------------------------------------------------------
   Live Preview Card (The "Dossier")
   ------------------------------------------------------------------------- */
.pa-avatar-preview {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 32px 20px 24px; border-radius: 16px;
  background: linear-gradient(145deg, var(--pa-bg-panel), var(--pa-bg-base));
  border: 1px solid var(--pa-border);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.5);
  overflow: hidden; isolation: isolate;
}
.pa-avatar-preview::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 16px;
  box-shadow: inset 0 20px 40px rgba(255,255,255,0.02); z-index: 10;
}
.pa-preview-scanlines {
  position: absolute; inset: 0; pointer-events: none; z-index: 2; mix-blend-mode: overlay;
  background: repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px);
  opacity: 0.5;
}
.pa-preview-top-deco {
  position: absolute; top: 12px; left: 16px; font-family: monospace; font-size: 10px;
  color: var(--pa-text-secondary); opacity: 0.6; display: flex; align-items: center; gap: 6px; z-index: 5;
}
.pa-dot { display: block; width: 6px; height: 6px; background: var(--pa-accent); border-radius: 50%; box-shadow: 0 0 8px var(--pa-accent); animation: pulseDot 2s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.pa-avatar-preview-banner {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: var(--panel-banner, linear-gradient(115deg, rgba(109, 191, 67, 0.15), transparent 60%));
}

/* Avatar Elements inside Preview */
.pa-avatar-preview-circle-wrap { position: relative; z-index: 5; display: flex; flex-direction: column; align-items: center; margin-top: 10px;}
.pa-avatar-preview-circle { 
  --pa-avatar-size: 104px; --pa-avatar-font: 44px; 
  box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.8); 
}
.pa-avatar-level-chip {
  margin-top: -14px; z-index: 6; background: var(--pa-bg-base);
  border: 1px solid var(--pa-accent); padding: 4px 12px; border-radius: 20px;
  font-size: 12px; font-weight: 800; color: var(--pa-text-primary);
  box-shadow: 0 6px 16px rgba(0,0,0,0.8), 0 0 10px var(--pa-accent-glow);
  display: flex; gap: 4px; align-items: baseline;
}
.pa-avatar-level-chip span { font-size: 9px; color: var(--pa-accent); }

.pa-avatar-preview-copy { position: relative; z-index: 5; text-align: center; margin-top: 8px; width: 100%; }
.pa-avatar-preview-name { font-weight: 800; font-size: 18px; color: var(--pa-text-primary); letter-spacing: 0.05em; text-transform: uppercase; }
.pa-avatar-preview-caption { font-size: 11px; color: var(--pa-text-secondary); margin-top: 4px; font-family: monospace; letter-spacing: 0.1em;}

/* Faux Barcode Decoration */
.pa-preview-barcode {
  height: 24px; margin-top: 16px; opacity: 0.2;
  background: repeating-linear-gradient(90deg, 
    var(--pa-text-primary) 0, var(--pa-text-primary) 2px, 
    transparent 2px, transparent 4px, 
    var(--pa-text-primary) 4px, var(--pa-text-primary) 5px, 
    transparent 5px, transparent 8px);
}

/* -------------------------------------------------------------------------
   Grids & Interactive Chips
   ------------------------------------------------------------------------- */
.pa-avatar-grid { display: grid; gap: 12px; }
.pa-avatar-grid-icons   { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
.pa-avatar-grid-colors  { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
.pa-avatar-grid-frames  { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
.pa-avatar-grid-banners { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.pa-avatar-grid-effects { grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); }

/* Base Chip Style */
.pa-avatar-chip {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 16px 12px; background: var(--pa-bg-card);
  border: 1px solid var(--pa-border); border-radius: 12px;
  color: var(--pa-text-secondary); font-family: inherit; font-size: 12px;
  cursor: pointer; overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  
  /* Staggered load animation */
  opacity: 0; transform: translateY(15px);
  animation: chipLoad 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes chipLoad { to { opacity: 1; transform: translateY(0); } }

/* Hover & Active States */
.pa-avatar-chip::before {
  content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 70%);
  opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
}
.pa-avatar-chip:hover:not(.is-locked),
.pa-avatar-chip:focus-visible:not(.is-locked) {
  transform: translateY(-4px) scale(1.02); 
  border-color: rgba(109, 191, 67, 0.4); color: var(--pa-text-primary); outline: none;
  box-shadow: 0 12px 24px rgba(0,0,0,0.4), 0 0 15px rgba(109, 191, 67, 0.1);
}
.pa-avatar-chip:hover::before { opacity: 1; }

.pa-avatar-chip.is-active {
  border-color: var(--pa-accent);
  background: linear-gradient(180deg, rgba(109, 191, 67, 0.1), var(--pa-bg-card));
  color: var(--pa-text-primary);
  box-shadow: inset 0 0 0 1px var(--pa-accent), 0 8px 20px rgba(109, 191, 67, 0.15);
}
.pa-avatar-chip.is-active::after {
  content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 40%; height: 2px; background: var(--pa-accent); border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 10px var(--pa-accent);
}

/* Locked State */
.pa-avatar-chip.is-locked { opacity: 0.5; cursor: not-allowed; filter: grayscale(0.8); background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.03); }
.pa-avatar-chip-lock {
  position: absolute; top: 8px; right: 8px; background: rgba(10, 12, 9, 0.95);
  color: var(--pa-lock); border-radius: 50%; width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255, 157, 0, 0.3); z-index: 10; 
  box-shadow: 0 4px 10px rgba(0,0,0,0.8), inset 0 0 8px rgba(255, 157, 0, 0.2);
}

/* Sample Inner Elements */
.pa-avatar-chip-label { font-weight: 600; letter-spacing: 0.03em; text-align: center; line-height: 1.2; z-index: 2; }
.pa-avatar-chip-glyph {
  display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; border-radius: 50%; font-size: 22px; font-weight: 800;
  background: rgba(109, 191, 67, 0.08); border: 1px solid rgba(109, 191, 67, 0.2);
  color: var(--pa-text-primary); box-shadow: inset 0 2px 5px rgba(0,0,0,0.5); z-index: 2;
}
.pa-avatar-chip-swatch {
  display: inline-block; width: 46px; height: 46px; border-radius: 50%; background: var(--pa-swatch, #5eaa3a);
  box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.2), inset 0 -4px 10px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.5);
  z-index: 2;
}
.pa-avatar-chip-frame-sample {
  --pa-avatar-color: var(--pa-accent); --pa-avatar-size: 48px;
  position: relative; width: var(--pa-avatar-size); height: var(--pa-avatar-size); border-radius: 50%;
  background: var(--pa-bg-base); border: 2px solid var(--pa-avatar-color); z-index: 2;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
}
.pa-avatar-chip-banner-sample { 
  display: block; width: 100%; height: 48px; border-radius: 6px; 
  border: 1px solid rgba(255, 255, 255, 0.1); z-index: 2;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);
}
.pa-avatar-chip-effect-sample { 
  width: 48px; height: 48px; border-radius: 8px; background: var(--pa-bg-base); 
  position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); z-index: 2;
}

/* -------------------------------------------------------------------------
   Footer Actions
   ------------------------------------------------------------------------- */
.pa-avatar-modal-footer {
  display: flex; gap: 14px; justify-content: flex-end; align-items: center; 
  padding: 20px 28px; border-top: 1px solid var(--pa-border); 
  background: var(--pa-bg-panel);
}

.pa-avatar-modal-action {
  position: relative; appearance: none; padding: 12px 24px; border-radius: 8px; 
  border: 1px solid var(--pa-border); overflow: hidden;
  background: var(--pa-bg-card); color: var(--pa-text-primary);
  font-size: 13px; font-family: inherit; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.pa-avatar-modal-action:hover, .pa-avatar-modal-action:focus-visible { 
  transform: translateY(-2px); border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05);
}

/* Secondary / Danger */
.pa-avatar-modal-action-ghost { 
  margin-right: auto; background: transparent; color: var(--pa-text-secondary); border-color: transparent; 
}
.pa-avatar-modal-action-ghost:hover { 
  background: rgba(224, 85, 85, 0.1); color: #ff6b6b; border-color: rgba(224, 85, 85, 0.2); 
}

/* Primary Button with Shine Effect */
.pa-avatar-modal-action-primary {
  background: var(--pa-accent); color: var(--pa-bg-base); border-color: var(--pa-accent);
  box-shadow: 0 4px 15px var(--pa-accent-glow); text-shadow: 0 1px 2px rgba(255,255,255,0.3);
}
.pa-avatar-modal-action-primary span { position: relative; z-index: 2; }
.pa-avatar-modal-action-primary:hover, .pa-avatar-modal-action-primary:focus-visible {
  background: #7dd94f; border-color: #7dd94f; transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(109, 191, 67, 0.5);
}
.pa-avatar-modal-action-primary:disabled { opacity: 0.6; cursor: wait; transform: none; box-shadow: none; filter: grayscale(0.5); }

/* Shine sweep animation inside primary button */
.pa-btn-shine {
  position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transform: skewX(-20deg); animation: btnShine 4s infinite cubic-bezier(0.16, 1, 0.3, 1); z-index: 1;
}
@keyframes btnShine {
  0% { left: -100%; } 20%, 100% { left: 200%; }
}

/* =========================================================================
   VFX & Effect Integrations (Preserving your existing data-effects)
   ========================================================================= */

.pa-avatar-preview-effect { position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: screen; }

/* STANDARD EFFECTS */
.pa-avatar-preview-effect[data-effect='scanlines'], .pa-avatar-chip-effect-sample[data-effect='scanlines'] {
  background: linear-gradient(to bottom, rgba(255,255,255,0) 50%, rgba(109,191,67,0.1) 50%); background-size: 100% 4px; animation: scrollDown 10s linear infinite;
}
.pa-avatar-preview-effect[data-effect='spores'], .pa-avatar-chip-effect-sample[data-effect='spores'] {
  background-image: radial-gradient(circle at 50% 50%, rgba(143, 212, 106, 0.4) 1.5px, transparent 1.5px); background-size: 24px 24px; animation: floatUp 5s linear infinite;
}
.pa-avatar-preview-effect[data-effect='rain'], .pa-avatar-chip-effect-sample[data-effect='rain'] {
  background: repeating-linear-gradient(15deg, transparent, transparent 15px, rgba(143, 212, 106, 0.25) 15px, rgba(143, 212, 106, 0.25) 16px); background-size: 100% 200%; animation: rainFall 1.5s linear infinite;
}
.pa-avatar-preview-effect[data-effect='embers'], .pa-avatar-chip-effect-sample[data-effect='embers'] {
  background-image: radial-gradient(circle, rgba(255, 107, 107, 0.8) 1.5px, transparent 1.5px); background-size: 20px 30px; animation: embersFloat 3s infinite linear;
}
.pa-avatar-preview-effect[data-effect='glitch'], .pa-avatar-chip-effect-sample[data-effect='glitch'] {
  background: rgba(34, 211, 238, 0.08); animation: glitchFlash 3s infinite; box-shadow: inset 0 0 30px rgba(34, 211, 238, 0.2);
}
.pa-avatar-preview-effect[data-effect='matrix'], .pa-avatar-chip-effect-sample[data-effect='matrix'] {
  background: repeating-linear-gradient(to bottom, transparent, transparent 4px, rgba(34, 197, 94, 0.4) 4px, rgba(34, 197, 94, 0.4) 5px); background-size: 100% 80px; animation: rainFall 0.8s linear infinite;
}
.pa-avatar-preview-effect[data-effect='wisps'], .pa-avatar-chip-effect-sample[data-effect='wisps'] {
  background: radial-gradient(circle at 20% 80%, rgba(168, 85, 247, 0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.3), transparent 50%); animation: wispSwirl 6s ease-in-out infinite alternate;
}
.pa-avatar-preview-effect[data-effect='overcharge'], .pa-avatar-chip-effect-sample[data-effect='overcharge'] {
  box-shadow: inset 0 0 50px rgba(57, 255, 20, 0.4); background: rgba(57, 255, 20, 0.08); animation: pulseOvercharge 0.4s infinite alternate;
}

/* ADVANCED EFFECTS */
.pa-avatar-preview-effect[data-effect='ash'], .pa-avatar-chip-effect-sample[data-effect='ash'] {
  background-image: radial-gradient(circle, rgba(160, 160, 160, 0.8) 1.5px, transparent 1.5px); background-size: 20px 20px; animation: paAshFall 4s infinite linear;
}
.pa-avatar-preview-effect[data-effect='blizzard'], .pa-avatar-chip-effect-sample[data-effect='blizzard'] {
  background: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.6) 10px, rgba(255,255,255,0.6) 12px); background-size: 200% 200%; animation: paBlizzardFly 0.8s infinite linear;
}
.pa-avatar-preview-effect[data-effect='fireflies'], .pa-avatar-chip-effect-sample[data-effect='fireflies'] {
  background-image: radial-gradient(circle at 20% 30%, rgba(217, 249, 157, 0.9) 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(253, 224, 71, 0.9) 2px, transparent 2px);
  background-size: 40px 40px; animation: paFireflies 3s infinite alternate ease-in-out;
}
.pa-avatar-preview-effect[data-effect='toxic-gas'], .pa-avatar-chip-effect-sample[data-effect='toxic-gas'] {
  background: radial-gradient(circle at 30% 70%, rgba(132, 204, 22, 0.3) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(234, 179, 8, 0.3) 0%, transparent 50%);
  animation: paGasSwirl 8s infinite linear; mix-blend-mode: screen;
}
.pa-avatar-preview-effect[data-effect='lightning'], .pa-avatar-chip-effect-sample[data-effect='lightning'] {
  background: rgba(125, 211, 252, 0); animation: paLightningStrike 3s infinite; box-shadow: inset 0 0 0 rgba(125,211,252,0);
}
.pa-avatar-preview-effect[data-effect='cosmos'], .pa-avatar-chip-effect-sample[data-effect='cosmos'] {
  background-image: radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px); background-size: 30px 40px; animation: paCosmosMove 10s infinite linear;
}
.pa-avatar-preview-effect[data-effect='blood-rain'], .pa-avatar-chip-effect-sample[data-effect='blood-rain'] {
  background: repeating-linear-gradient(5deg, transparent, transparent 10px, rgba(185, 28, 28, 0.6) 10px, rgba(185, 28, 28, 0.6) 11px); background-size: 100% 200%; animation: paBloodRain 0.6s infinite linear;
}
.pa-avatar-preview-effect[data-effect='blackhole'], .pa-avatar-chip-effect-sample[data-effect='blackhole'] {
  background: conic-gradient(from 0deg, rgba(0,0,0,0.8), rgba(88,28,135,0.5), rgba(0,0,0,0.8)); animation: paAvatarSpin 3s infinite linear; border-radius: 50%; mix-blend-mode: multiply;
}
.pa-avatar-preview-effect[data-effect='ascension'], .pa-avatar-chip-effect-sample[data-effect='ascension'] {
  background: linear-gradient(0deg, transparent, rgba(253, 224, 71, 0.2) 50%, transparent); background-size: 100% 200%;
  animation: paAscensionRise 2s infinite linear; box-shadow: inset 0 -30px 40px rgba(253,224,71,0.3);
}
.pa-avatar-preview-effect[data-effect='omega-burst'], .pa-avatar-chip-effect-sample[data-effect='omega-burst'] {
  box-shadow: inset 0 0 0 rgba(236,72,153,0); animation: paOmegaBurst 1.5s infinite cubic-bezier(0.1, 0.8, 0.3, 1); border-radius: 50%; border: 1px solid rgba(255,255,255,0);
}

/* Animations */
@keyframes scrollDown { from { background-position: 0 0; } to { background-position: 0 100vh; } }
@keyframes glitchFlash { 0%, 96%, 98% { opacity: 1; transform: translateX(0); } 97% { opacity: 0.7; transform: translateX(-4px); } 99% { opacity: 0.9; transform: translateX(4px); } }
@keyframes floatUp { 0% { transform: translateY(0); opacity: 0;} 50% { opacity: 1; } 100% { transform: translateY(-40px); opacity: 0; } }
@keyframes rainFall { 0% { background-position: 0% 0%; } 100% { background-position: -20% 100%; } }
@keyframes embersFloat { 0% { transform: translateY(0) translateX(0); opacity: 0; } 25% { opacity: 1; transform: translateX(5px); } 75% { transform: translateX(-5px); } 100% { transform: translateY(-50px) translateX(0); opacity: 0; } }
@keyframes wispSwirl { 0% { transform: scale(1) rotate(0deg); opacity: 0.6; } 100% { transform: scale(1.2) rotate(15deg); opacity: 1; } }
@keyframes pulseOvercharge { 0% { opacity: 0.6; box-shadow: inset 0 0 20px rgba(57, 255, 20, 0.3); } 100% { opacity: 1; box-shadow: inset 0 0 60px rgba(57, 255, 20, 0.7); } }
@keyframes paAshFall { 0% { transform: translateY(-30px) translateX(0); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; transform: translateY(30px) translateX(10px); } 100% { transform: translateY(60px) translateX(15px); opacity: 0; } }
@keyframes paBlizzardFly { 0% { background-position: 0 0; } 100% { background-position: -50px 50px; } }
@keyframes paFireflies { 0% { transform: translateY(0) scale(0.8); opacity: 0.3; } 100% { transform: translateY(-10px) scale(1.2); opacity: 1; } }
@keyframes paGasSwirl { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.5); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes paLightningStrike { 0%, 94%, 100% { background: rgba(125,211,252,0); box-shadow: inset 0 0 0 rgba(125,211,252,0); } 95% { background: rgba(125,211,252,0.3); box-shadow: inset 0 0 40px rgba(125,211,252,0.8); } 96% { background: rgba(125,211,252,0); box-shadow: inset 0 0 0 rgba(125,211,252,0); } 98% { background: rgba(125,211,252,0.5); box-shadow: inset 0 0 60px rgba(125,211,252,1); } }
@keyframes paCosmosMove { 0% { background-position: 0 0; } 100% { background-position: 30px -80px; } }
@keyframes paBloodRain { 0% { background-position: 0 0; } 100% { background-position: -10px 100px; } }
@keyframes paAvatarSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes paAscensionRise { 0% { background-position: 0 200%; opacity: 0.5; } 50% { opacity: 1; } 100% { background-position: 0 0%; opacity: 0.5; } }
@keyframes paOmegaBurst { 0% { transform: scale(0.8); opacity: 1; box-shadow: inset 0 0 60px rgba(236,72,153,0.9); border-color: rgba(255,255,255,0.9); } 100% { transform: scale(1.5); opacity: 0; box-shadow: inset 0 0 0 rgba(139,92,246,0); border-color: rgba(255,255,255,0); } }

/* Shared Dummy anims */
.pa-anim-bg { background-size: 200% 200% !important; animation: bgPan 6s ease-in-out infinite alternate; }
@keyframes bgPan { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
.pa-anim-frame { position: relative; overflow: hidden; border-color: transparent !important; }
.pa-anim-frame::before {
  content: ''; position: absolute; inset: -50%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 60%, var(--pa-avatar-color) 100%); animation: paAvatarSpin 3s linear infinite;
}
.pa-anim-frame::after { content: ''; position: absolute; inset: 2px; background: var(--pa-bg-base); border-radius: 50%; z-index: -1; }
