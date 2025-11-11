import React from 'react'
import ReactDOM from 'react-dom/client'
import { nanoid } from 'nanoid'
import { EmbedWidget } from './components/EmbedWidget'

// Detect theme from script tag attribute or URL query parameter
// Extract token from script tags (same pattern as useVisitorData)
const scripts = document.getElementsByTagName('script');
let theme = 'light';

for (let i = 0; i < scripts.length; i++) {
  const script = scripts[i];
  if (script.src && script.src.includes('embed.js')) {
    const url = new URL(script.src);
    const themeParam = url.searchParams.get('theme');
    if (themeParam) {
      theme = themeParam;
      break;
    }
  }
  // Also check data attribute
  if (script.dataset.theme) {
    theme = script.dataset.theme;
    break;
  }
  // Also check regular attribute
  if (script.getAttribute('theme')) {
    theme = script.getAttribute('theme') || 'light';
    break;
  }
}

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
    --muted-special: 202 15% 15%;
    --special: 25 95% 53%;
    --special-l: 25 95% 43%;
    --muted-foreground: 202 7% 83%;
    --primary: 202 7% 17%;
    --primary-foreground: 202 7% 93%;
    --constructive: 116 54% 50%;
    --constructive-foreground: 202 7% 93%;
    --destructive: 4 75% 25%;
    --destructive-foreground: 202 7% 93%;
    --border: 202 7% 50%;
    --ring: 202 7% 93%;
    ` : `
    /* Light theme colors for embed */
    --background: 202 7% 93%;
    --foreground: 202 7% 7%;
    --muted: 202 7% 88%;
    --muted-special: 202 15% 85%;
    --special: 25 95% 53%;
    --special-l: 25 95% 43%;
    --muted-foreground: 202 7% 17%;
    --primary: 202 7% 83%;
    --primary-foreground: 202 7% 7%;
    --constructive: 116 54% 50%;
    --constructive-foreground: 202 7% 93%;
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

  /* Aggressive CSS reset and isolation for all children */
  .${cssClass} *,
  .${cssClass} *::before,
  .${cssClass} *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    font: inherit;
    vertical-align: baseline;
    line-height: inherit;
    color: inherit;
    text-decoration: none;
    background: transparent;
    list-style: none;
    quotes: none;
    outline: none;
  }

  /* Completely isolated styles for embed root */
  .${cssClass} {
    all: initial;
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 300px !important;
    max-height: 600px !important;
    display: flex !important;
    flex-direction: column !important;
    z-index: 10000 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    color: hsl(var(--foreground)) !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: transparent;
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
  }

  /* Reset form elements */
  .${cssClass} input,
  .${cssClass} textarea,
  .${cssClass} select {
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    color: inherit !important;
    background: transparent;
    border: none;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }
  
  /* Buttons - don't override color to allow explicit styling */
  .${cssClass} button {
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    background: transparent;
    border: none;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
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