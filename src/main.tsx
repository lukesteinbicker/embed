import React from 'react'
import ReactDOM from 'react-dom/client'
import { nanoid } from 'nanoid'
import { EmbedWidget } from './components/EmbedWidget'

// Detect theme from script tag attribute
const currentScript = document.currentScript as HTMLScriptElement;
const theme = currentScript?.getAttribute('data-theme') || 'light';

// Generate unique IDs to prevent any conflicts
const uniqueId = nanoid();
const rootId = `embed-widget-${uniqueId}`;
const cssClass = `embed-widget-${uniqueId}`;

// Create completely isolated CSS with unique class names
const style = document.createElement('style');
style.textContent = `
  /* Embed widget CSS variables - theme: ${theme} - ID: ${uniqueId} */
  .${cssClass} {
    ${theme === 'dark' ? `
    /* Dark theme colors for embed */
    --background: 202 7% 3%;
    --foreground: 202 7% 93%;
    --muted: 202 7% 12%;
    --muted-foreground: 202 7% 83%;
    --primary: 202 7% 17%;
    --primary-foreground: 202 7% 93%;
    --destructive: 4 75% 25%;
    --destructive-foreground: 202 7% 93%;
    --border: 202 7% 50%;
    --ring: 202 7% 93%;
    ` : `
    /* Light theme colors for embed */
    --background: 202 7% 93%;
    --foreground: 202 7% 7%;
    --muted: 202 7% 88%;
    --muted-foreground: 202 7% 17%;
    --primary: 202 7% 83%;
    --primary-foreground: 202 7% 7%;
    --destructive: 4 75% 25%;
    --destructive-foreground: 202 7% 7%;
    --border: 202 7% 50%;
    --ring: 202 7% 7%;
    `}
    --radius: 0.5rem;
  }

  /* Spinner animation with unique name */
  @keyframes ${cssClass}-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Completely isolated styles for embed */
  .${cssClass} {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .${cssClass} * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
`;
document.head.appendChild(style);

// Create root element with unique ID
let rootElement = document.getElementById(rootId);
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = rootId;
  rootElement.className = cssClass;
  document.body.appendChild(rootElement);
}

// Render the embed widget
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <EmbedWidget />
  </React.StrictMode>
);

// Export for global access if needed
(window as any).EmbedWidget = EmbedWidget;