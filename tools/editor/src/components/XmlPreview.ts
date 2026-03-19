// P.A.N.D.A. Conversation Editor — XML Preview Panel

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';

export function renderXmlPreview(container: HTMLElement): void {
  const state = store.get();
  const xml = generateXml(state.project, state.systemStrings);

  const panel = document.createElement('div');
  panel.className = 'xml-preview-panel';

  const content = document.createElement('pre');
  content.className = 'xml-preview-content';

  // Simple syntax highlighting
  content.innerHTML = highlightXml(xml);

  panel.appendChild(content);
  container.appendChild(panel);
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
