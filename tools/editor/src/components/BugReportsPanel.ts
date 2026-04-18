import {
  deleteBugReport,
  fetchBugReports,
  getLocalPublisherId,
  getStoredUsername,
  submitBugReport,
  updateBugReportAdmin,
  type BugReportStatus,
  type EditorBugReport,
} from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';

const BUG_REPORTS_MOUNT_ID = 'app-modal-host';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let reports: EditorBugReport[] = [];
let currentFilter: BugReportStatus = 'all';
let viewerCanAdmin = false;
let loading = false;
let statusEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let filterEl: HTMLElement | null = null;

function getMount(): HTMLElement {
  return document.getElementById(BUG_REPORTS_MOUNT_ID)
    ?? document.getElementById('app')
    ?? document.body;
}

function getCurrentUsername(): string | null {
  const profile = (globalThis as typeof globalThis & { __pandaUserProfile?: { username?: string } | null }).__pandaUserProfile;
  return profile?.username?.trim() || getStoredUsername();
}

function formatReportDate(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown time';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createMetadata(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  return {
    url: window.location.href,
    user_agent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export function openBugReportsPanel(): void {
  if (overlayEl) return;

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.className = 'bug-report-overlay';
  overlay.onclick = (event) => {
    if (event.target === overlay) closeBugReportsPanel();
  };

  const panel = document.createElement('section');
  panel.className = 'bug-report-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'bug-report-title');
  panel.onclick = event => event.stopPropagation();

  const header = document.createElement('div');
  header.className = 'bug-report-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'bug-report-title-wrap';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'bug-report-eyebrow';
  eyebrow.textContent = 'Editor reports';
  const title = document.createElement('h2');
  title.className = 'bug-report-title';
  title.id = 'bug-report-title';
  title.append(createIcon('bug'), document.createTextNode('Bug Reports'));
  const subtitle = document.createElement('p');
  subtitle.className = 'bug-report-subtitle';
  subtitle.textContent = 'Leave complaint. Read past reports. Panda can reply or mark fixed.';
  titleWrap.append(eyebrow, title, subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bug-report-close btn-icon';
  closeBtn.setAttribute('aria-label', 'Close bug reports');
  closeBtn.title = 'Close bug reports';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.onclick = closeBugReportsPanel;
  header.append(titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'bug-report-body';

  const form = buildReportForm();
  const board = document.createElement('div');
  board.className = 'bug-report-board';

  const boardHeader = document.createElement('div');
  boardHeader.className = 'bug-report-board-header';
  const boardTitle = document.createElement('div');
  boardTitle.className = 'bug-report-board-title';
  boardTitle.textContent = 'Past reports';
  filterEl = document.createElement('div');
  filterEl.className = 'bug-report-filters';
  boardHeader.append(boardTitle, filterEl);

  statusEl = document.createElement('div');
  statusEl.className = 'bug-report-status';
  statusEl.setAttribute('aria-live', 'polite');

  listEl = document.createElement('div');
  listEl.className = 'bug-report-list';
  board.append(boardHeader, statusEl, listEl);
  body.append(form, board);
  panel.append(header, body);
  overlay.appendChild(panel);
  getMount().appendChild(overlay);

  overlayEl = overlay;
  renderFilters();
  renderReportList();
  void loadReports();

  focusTrap = trapFocus(panel, {
    restoreFocus: restoreFocusEl,
    initialFocus: form.querySelector<HTMLInputElement>('input') ?? closeBtn,
    onEscape: closeBugReportsPanel,
  });
}

export function closeBugReportsPanel(): void {
  overlayEl?.remove();
  overlayEl = null;
  focusTrap?.release();
  focusTrap = null;
  restoreFocusEl = null;
  statusEl = null;
  listEl = null;
  filterEl = null;
}

function buildReportForm(): HTMLElement {
  const form = document.createElement('form');
  form.className = 'bug-report-form';

  const title = document.createElement('div');
  title.className = 'bug-report-form-title';
  title.textContent = 'New complaint';

  const subjectLabel = document.createElement('label');
  subjectLabel.className = 'bug-report-field';
  const subjectText = document.createElement('span');
  subjectText.textContent = 'Subject';
  const subject = document.createElement('input');
  subject.type = 'text';
  subject.maxLength = 120;
  subject.required = true;
  subject.placeholder = 'Broken toolbar, profile menu, export issue...';
  subjectLabel.append(subjectText, subject);

  const messageLabel = document.createElement('label');
  messageLabel.className = 'bug-report-field';
  const messageText = document.createElement('span');
  messageText.textContent = 'Message';
  const message = document.createElement('textarea');
  message.maxLength = 2500;
  message.required = true;
  message.rows = 8;
  message.placeholder = 'What happened? What should happen instead?';
  messageLabel.append(messageText, message);

  const submitRow = document.createElement('div');
  submitRow.className = 'bug-report-submit-row';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'toolbar-button btn-primary bug-report-submit';
  setButtonContent(submit, 'bug', 'Send Report');
  const formStatus = document.createElement('div');
  formStatus.className = 'bug-report-form-status';
  formStatus.setAttribute('aria-live', 'polite');
  submitRow.append(submit, formStatus);

  form.onsubmit = async (event) => {
    event.preventDefault();
    const subjectValue = subject.value.trim();
    const messageValue = message.value.trim();
    if (!subjectValue || !messageValue) return;

    submit.disabled = true;
    formStatus.textContent = 'Sending...';
    try {
      const report = await submitBugReport({
        subject: subjectValue,
        message: messageValue,
        author_username: getCurrentUsername(),
        author_publisher_id: getLocalPublisherId(),
        metadata: createMetadata(),
      });
      subject.value = '';
      message.value = '';
      formStatus.textContent = 'Sent.';
      if (report) reports = [report, ...reports.filter(item => item.id !== report.id)];
      currentFilter = 'all';
      renderFilters();
      renderReportList();
      void loadReports();
    } catch (error) {
      formStatus.textContent = error instanceof Error ? error.message : 'Report failed.';
    } finally {
      submit.disabled = false;
    }
  };

  form.append(title, subjectLabel, messageLabel, submitRow);
  return form;
}

function renderFilters(): void {
  if (!filterEl) return;
  filterEl.textContent = '';
  const filters: Array<{ id: BugReportStatus; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'fixed', label: 'Fixed' },
    { id: 'closed', label: 'Closed' },
  ];
  for (const filter of filters) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bug-report-filter';
    btn.classList.toggle('is-active', filter.id === currentFilter);
    btn.textContent = filter.label;
    btn.onclick = () => {
      currentFilter = filter.id;
      renderFilters();
      void loadReports();
    };
    filterEl.appendChild(btn);
  }
}

async function loadReports(): Promise<void> {
  loading = true;
  renderReportList();
  try {
    const response = await fetchBugReports(currentFilter, getLocalPublisherId());
    reports = response.reports;
    viewerCanAdmin = response.viewer_can_admin || (getCurrentUsername()?.toLowerCase() === 'panda');
  } catch {
    reports = [];
    viewerCanAdmin = getCurrentUsername()?.toLowerCase() === 'panda';
  } finally {
    loading = false;
    renderReportList();
  }
}

function renderReportList(): void {
  if (!listEl || !statusEl) return;
  listEl.textContent = '';
  statusEl.textContent = loading ? 'Loading reports...' : `${reports.length} report${reports.length === 1 ? '' : 's'}`;

  if (loading) return;
  if (reports.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bug-report-empty';
    empty.textContent = 'No reports yet.';
    listEl.appendChild(empty);
    return;
  }

  for (const report of reports) {
    listEl.appendChild(buildReportCard(report));
  }
}

function buildReportCard(report: EditorBugReport): HTMLElement {
  const card = document.createElement('article');
  card.className = `bug-report-card bug-report-card-${report.status}`;

  const top = document.createElement('div');
  top.className = 'bug-report-card-top';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'bug-report-card-title-wrap';
  const title = document.createElement('h3');
  title.className = 'bug-report-card-title';
  title.textContent = report.subject;
  const meta = document.createElement('div');
  meta.className = 'bug-report-card-meta';
  const author = report.author_username || 'Anonymous';
  meta.textContent = `${author} - ${formatReportDate(report.created_at)}`;
  titleWrap.append(title, meta);

  const status = document.createElement('span');
  status.className = `bug-report-status-pill bug-report-status-${report.status}`;
  status.textContent = report.status;
  top.append(titleWrap, status);

  const message = document.createElement('p');
  message.className = 'bug-report-card-message';
  message.textContent = report.message;

  card.append(top, message);

  if (report.admin_reply) {
    const reply = document.createElement('div');
    reply.className = 'bug-report-admin-reply';
    const replyTitle = document.createElement('div');
    replyTitle.className = 'bug-report-admin-reply-title';
    replyTitle.textContent = `Panda reply${report.admin_username ? ` - ${report.admin_username}` : ''}`;
    const replyText = document.createElement('p');
    replyText.textContent = report.admin_reply;
    reply.append(replyTitle, replyText);
    card.appendChild(reply);
  }

  if (viewerCanAdmin) {
    card.appendChild(buildAdminControls(report));
  }

  return card;
}

function buildAdminControls(report: EditorBugReport): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'bug-report-admin-controls';

  const status = document.createElement('select');
  status.className = 'bug-report-admin-status';
  (['open', 'fixed', 'closed'] as const).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = value === report.status;
    status.appendChild(option);
  });

  const reply = document.createElement('textarea');
  reply.className = 'bug-report-admin-textarea';
  reply.rows = 3;
  reply.maxLength = 2500;
  reply.placeholder = 'Panda reply...';
  reply.value = report.admin_reply;

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'toolbar-button bug-report-admin-save';
  setButtonContent(save, 'check', 'Save');
  const note = document.createElement('div');
  note.className = 'bug-report-admin-note';
  note.setAttribute('aria-live', 'polite');

  save.onclick = async () => {
    save.disabled = true;
    note.textContent = 'Saving...';
    try {
      const updated = await updateBugReportAdmin(report.id, {
        publisher_id: getLocalPublisherId(),
        username: getCurrentUsername(),
        status: status.value as Exclude<BugReportStatus, 'all'>,
        admin_reply: reply.value,
      });
      if (updated) {
        reports = reports.map(item => item.id === updated.id ? updated : item);
        note.textContent = 'Saved.';
        renderReportList();
      }
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : 'Save failed.';
    } finally {
      save.disabled = false;
    }
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'toolbar-button bug-report-admin-delete';
  setButtonContent(deleteBtn, 'delete', 'Delete');

  deleteBtn.onclick = async () => {
    if (!confirm('Permanently delete this report?')) return;
    deleteBtn.disabled = true;
    note.textContent = 'Deleting...';
    try {
      await deleteBugReport(report.id, getLocalPublisherId());
      reports = reports.filter(item => item.id !== report.id);
      renderReportList();
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : 'Delete failed.';
      deleteBtn.disabled = false;
    }
  };

  controls.append(status, reply, save, deleteBtn, note);
  return controls;
}
