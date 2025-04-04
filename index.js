import React from 'react';
import { createRoot } from 'react-dom/client';
import ApproximateLVL from './app.js';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ApproximateLVL />
  </React.StrictMode>
);
