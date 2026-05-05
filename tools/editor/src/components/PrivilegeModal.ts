import {
  fetchEditorAdmins,
  grantEditorAdmin,
  revokeEditorAdmin,
  type EditorAdmin,
  type UserProfile,
} from '../lib/api-client';
import { t } from '../lib/i18n';

let overlayEl: HTMLElement | null = null;

export function canOpenPrivilegeModal(): boolean {
  const profile = (globalThis as any).__pandaUserProfile as UserProfile | null;
  return (profile?.username ?? '').trim().toLowerCase() === 'panda';
}

export function openPrivilegeModal(): void {
  if (overlayEl) return;
  const profile = (globalThis as any).__pandaUserProfile as UserProfile | null;
  if (!profile?.publisher_id || !canOpenPrivilegeModal()) {
    alert(t('privilege.onlyPanda'));
    return;
  }

  overlayEl = document.createElement('div');
  overlayEl.className = 'privilege-overlay';

  const modal = document.createElement('div');
  modal.className = 'privilege-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'privilege-header';
  const title = document.createElement('div');
  title.className = 'privilege-title';
  title.textContent = t('privilege.title');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toolbar-button';
  close.textContent = t('action.close');
  close.onclick = closePrivilegeModal;
  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'privilege-body';

  const form = document.createElement('form');
  form.className = 'privilege-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('privilege.input.placeholder');
  input.className = 'share-form-input';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'toolbar-button btn-primary';
  submit.textContent = t('privilege.grant');
  form.append(input, submit);

  const status = document.createElement('div');
  status.className = 'privilege-status';

  const list = document.createElement('div');
  list.className = 'privilege-list';

  modal.append(header, form, status, list);
  overlayEl.appendChild(modal);
  document.body.appendChild(overlayEl);

  const setStatus = (message: string, tone: 'neutral' | 'danger' | 'success' = 'neutral') => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const renderAdmins = (admins: EditorAdmin[]) => {
    list.replaceChildren();
    if (admins.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'privilege-empty';
      empty.textContent = t('privilege.empty');
      list.appendChild(empty);
      return;
    }
    for (const admin of admins) {
      const row = document.createElement('div');
      row.className = 'privilege-row';
      const copy = document.createElement('div');
      copy.className = 'privilege-row-copy';
      copy.textContent = `${admin.username} (${admin.publisher_id})`;
      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.className = 'toolbar-button';
      revoke.textContent = t('privilege.revoke');
      revoke.onclick = async () => {
        revoke.disabled = true;
        try {
          await revokeEditorAdmin(profile.publisher_id, admin.publisher_id);
          renderAdmins((await fetchEditorAdmins(profile.publisher_id)).filter(item => item.publisher_id !== admin.publisher_id));
          setStatus(t('privilege.revoked', { user: admin.username }), 'success');
        } catch (err) {
          revoke.disabled = false;
          setStatus(err instanceof Error ? err.message : String(err), 'danger');
        }
      };
      row.append(copy, revoke);
      list.appendChild(row);
    }
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const username = input.value.trim();
    if (!username) return;
    submit.disabled = true;
    setStatus(t('privilege.granting'), 'neutral');
    try {
      await grantEditorAdmin(profile.publisher_id, username);
      input.value = '';
      renderAdmins(await fetchEditorAdmins(profile.publisher_id));
      setStatus(t('privilege.granted', { user: username }), 'success');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), 'danger');
    } finally {
      submit.disabled = false;
    }
  };

  overlayEl.onclick = (event) => {
    if (event.target === overlayEl) closePrivilegeModal();
  };

  void fetchEditorAdmins(profile.publisher_id)
    .then(renderAdmins)
    .catch((err) => setStatus(err instanceof Error ? err.message : String(err), 'danger'));
}

export function closePrivilegeModal(): void {
  overlayEl?.remove();
  overlayEl = null;
}
