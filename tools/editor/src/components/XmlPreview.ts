// P.A.N.D.A. Conversation Editor — XML Preview Panel (editable)

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { importXml } from '../lib/xml-import';
import { t } from '../lib/i18n';

const xmlPreviewCache = {
  projectRevision: -1,
  systemStringsRevision: -1,
  xml: '',
};

type XmlPreviewPanel = HTMLElement & { __updateFromStore?: () => void };

export function createXmlPreviewContent(): HTMLElement {
  const panel: XmlPreviewPanel = document.createElement('div');
  panel.className = 'xml-preview-panel';

  const textarea = document.createElement('textarea');
  textarea.className = 'xml-preview-textarea';
  textarea.spellcheck = false;
  textarea.setAttribute('autocorrect', 'off');
  textarea.setAttribute('autocapitalize', 'off');
  textarea.setAttribute('data-allow-immediate-render', 'true');
  panel.appendChild(textarea);

  const footer = document.createElement('div');
  footer.className = 'xml-preview-footer';

  const status = document.createElement('span');
  status.className = 'xml-preview-status';
  status.textContent = t('xmlPreview.live');

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'btn-sm xml-preview-apply-btn';
  applyBtn.textContent = t('xmlPreview.apply');
  applyBtn.title = t('xmlPreview.apply.tooltip');
  applyBtn.disabled = true;

  footer.append(status, applyBtn);
  panel.appendChild(footer);

  let isDirty = false;
  let lastKnownXml = '';

  const initialXml = getCachedXml();
  textarea.value = initialXml;
  lastKnownXml = initialXml;

  textarea.addEventListener('input', () => {
    if (textarea.value !== lastKnownXml) {
      isDirty = true;
      status.textContent = t('xmlPreview.modified');
      status.dataset.xmlState = 'modified';
      applyBtn.disabled = false;
    } else {
      isDirty = false;
      status.textContent = t('xmlPreview.live');
      status.dataset.xmlState = '';
      applyBtn.disabled = true;
    }
  });

  applyBtn.addEventListener('click', () => {
    const rawXml = textarea.value;
    applyBtn.disabled = true;

    const result = importXml(rawXml);
    if (!result) {
      status.textContent = t('xmlPreview.errorInvalid');
      status.dataset.xmlState = 'error';
      applyBtn.disabled = false;
      return;
    }

    const savedHeight = store.get().bottomWorkspaceHeight;
    isDirty = false;
    lastKnownXml = rawXml;

    store.loadProject(result.project, result.systemStrings);
    // loadProject resets the XML panel — re-open it and restore height
    store.toggleXmlPreview();
    store.setBottomWorkspaceHeight(savedHeight);
  });

  panel.__updateFromStore = () => {
    if (isDirty) return;
    const xml = getCachedXml();
    if (textarea.value !== xml) {
      textarea.value = xml;
      lastKnownXml = xml;
    }
  };

  return panel;
}

export function updateXmlPreviewContent(panel: HTMLElement): void {
  const p = panel as XmlPreviewPanel;
  if (typeof p.__updateFromStore === 'function') {
    p.__updateFromStore();
  }
}

function getCachedXml(): string {
  const state = store.get();
  if (
    xmlPreviewCache.projectRevision !== state.projectRevision
    || xmlPreviewCache.systemStringsRevision !== state.systemStringsRevision
  ) {
    xmlPreviewCache.xml = generateXml(state.project, state.systemStrings);
    xmlPreviewCache.projectRevision = state.projectRevision;
    xmlPreviewCache.systemStringsRevision = state.systemStringsRevision;
  }
  return xmlPreviewCache.xml;
}
