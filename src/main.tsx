import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/blocks.css';
import './styles/lots.css';
import './styles/paths.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionProvider } from './app/session';
import { firebaseSessionSource } from './data/sessionSource';

const root = document.getElementById('root');
if (!root) {
  throw new Error('No existe el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <SessionProvider source={firebaseSessionSource}>
      <App />
    </SessionProvider>
  </StrictMode>,
);
