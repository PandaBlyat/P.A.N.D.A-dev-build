// P.A.N.D.A. Conversation Editor — XML Preview Panel

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';

const xmlPreviewCache = {
  projectRevision: -1,
  systemStringsRevision: -1,
  xml: '',
  highlightedXml: '',
};

export function renderXmlPreview(container: HTMLElement): void {
  container.appendChild(createXmlPreviewContent());
}

export function createXmlPreviewContent(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'xml-preview-panel';

  const content = document.createElement('pre');
  content.className = 'xml-preview-content';
  panel.appendChild(content);

  updateXmlPreviewContent(content);
  return panel;
}

export function updateXmlPreviewContent(content: HTMLElement): void {
  const { xml, highlightedXml } = getCachedXmlPreview();
  if (content.dataset.xmlText === xml) return;
  content.dataset.xmlText = xml;
  content.innerHTML = highlightedXml;
}

function getCachedXmlPreview(): { xml: string; highlightedXml: string } {
  const state = store.get();
  if (
    xmlPreviewCache.projectRevision !== state.projectRevision
    || xmlPreviewCache.systemStringsRevision !== state.systemStringsRevision
  ) {
    const xml = generateXml(state.project, state.systemStrings);
    xmlPreviewCache.projectRevision = state.projectRevision;
    xmlPreviewCache.systemStringsRevision = state.systemStringsRevision;

    if (xmlPreviewCache.xml !== xml) {
      xmlPreviewCache.xml = xml;
      xmlPreviewCache.highlightedXml = highlightXml(xml);
    }
  }

  return {
    xml: xmlPreviewCache.xml,
    highlightedXml: xmlPreviewCache.highlightedXml,
  };
}

function highlightXml(xml: string): string {
  return xml
    // Escape any existing HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xml-comment">$1</span>')
    // Tags
    .replace(/(&lt;\/?)([\w_]+)/g, '$1<span class="xml-tag">$2</span>')
    // Attributes
    .replace(/([\w-]+)=(&quot;[^&]*&quot;)/g, '<span class="xml-attr">$1</span>=<span class="xml-text">$2</span>')
    // Text content between tags (simplified)
    .replace(/(&gt;)([^&<]+)(&lt;)/g, '$1<span class="xml-text">$2</span>$3');
}
