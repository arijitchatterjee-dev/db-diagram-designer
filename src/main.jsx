import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import App from './App';
import './styles.css';
import './styles/shell.css';
import './styles/dash.css';
import './styles/parts.css';
import './styles/steps.css';
import './styles/plan.css';
import './styles/chat.css';
import './styles/history.css';
import './styles/modules.css';
import './styles/templates.css';
import './styles/print.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
