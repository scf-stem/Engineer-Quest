import React from 'react';
import { createRoot } from 'react-dom/client';
import { EngineerQuestDemo } from './index.js';

createRoot(document.getElementById('eq-preview-root')).render(<React.StrictMode><EngineerQuestDemo/></React.StrictMode>);
