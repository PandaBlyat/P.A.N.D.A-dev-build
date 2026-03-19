// P.A.N.D.A. Conversation Editor — Main Entry Point

import './app.css';
import { store } from './lib/state';
import { renderApp } from './components/App';

// Boot
const app = document.getElementById('app')!;
renderApp(app);

// Re-render on state changes, but skip while an input is focused to prevent
// the DOM rebuild from stealing focus (the "tabs out after each keypress" bug).
let renderPending = false;

store.subscribe(() => {
  const active = document.activeElement;
  if (
    active && app.contains(active) &&
    (active instanceof HTMLInputElement ||
     active instanceof HTMLTextAreaElement ||
     active instanceof HTMLSelectElement)
  ) {
    renderPending = true;
    return;
  }
  renderPending = false;
  renderApp(app);
});

// When the user leaves an input, flush any deferred render.
document.addEventListener('focusout', () => {
  if (renderPending) {
    renderPending = false;
    // Use requestAnimationFrame so the blur fully completes first.
    requestAnimationFrame(() => renderApp(app));
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    store.redo();
  }
});
