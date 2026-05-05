import type { CollabInviteOffer } from '../lib/collab-realtime';
import { acceptCollabInvite, refuseCollabInvite } from '../lib/collab-session';
import { t } from '../lib/i18n';

export function showCollabInviteToast(offer: CollabInviteOffer): void {
  document.querySelectorAll('.collab-invite-toast').forEach((toast) => toast.remove());

  const toast = document.createElement('div');
  toast.className = 'collab-invite-toast';

  const title = document.createElement('strong');
  title.textContent = t('collab.invite.title', { user: offer.hostUsername });

  const label = document.createElement('span');
  label.textContent = offer.conversationLabel;

  const countdown = document.createElement('span');
  countdown.className = 'collab-countdown';

  const actions = document.createElement('div');
  actions.className = 'collab-toast-actions';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'primary-btn';
  accept.textContent = t('collab.invite.accept');
  const refuse = document.createElement('button');
  refuse.type = 'button';
  refuse.className = 'secondary-btn';
  refuse.textContent = t('collab.invite.refuse');
  actions.append(accept, refuse);

  let remaining = 30;
  const timer = window.setInterval(() => {
    remaining -= 1;
    countdown.textContent = t('collab.invite.countdown', { count: remaining });
    if (remaining <= 0) {
      window.clearInterval(timer);
      void refuseCollabInvite(offer);
      toast.remove();
    }
  }, 1000);
  countdown.textContent = `${remaining}s`;

  accept.onclick = async () => {
    accept.disabled = true;
    refuse.disabled = true;
    window.clearInterval(timer);
    try {
      await acceptCollabInvite(offer);
      toast.remove();
    } catch (error) {
      accept.disabled = false;
      refuse.disabled = false;
      countdown.textContent = error instanceof Error ? error.message : 'Failed';
    }
  };
  refuse.onclick = async () => {
    accept.disabled = true;
    refuse.disabled = true;
    window.clearInterval(timer);
    await refuseCollabInvite(offer).catch(() => undefined);
    toast.remove();
  };

  toast.append(title, label, countdown, actions);
  document.body.appendChild(toast);
}
