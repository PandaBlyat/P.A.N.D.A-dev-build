// P.A.N.D.A. Conversation Editor — Main Entry Point

import './app.css';
import { store } from './lib/state';
import { renderApp } from './components/App';

// Boot
const app = document.getElementById('app')!;
renderApp(app);

// Re-render on state changes
store.subscribe(() => renderApp(app));

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
