import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { siteConfig } from './config/site';
import './index.css';

// Ivy Mode (Adobe Fonts): solo si Casa Numa configuró su kit web. El CSS de
// Tailwind ya la pone primero en la familia "display".
if (siteConfig.adobeFontsKit) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://use.typekit.net/${siteConfig.adobeFontsKit}.css`;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
