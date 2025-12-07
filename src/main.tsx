import React from 'react'
import ReactDOM from 'react-dom/client'
import { nanoid } from 'nanoid'
import { EmbedWidget } from './components/EmbedWidget'
import { generateThemeCSS, type Theme } from './themes'

// Detect theme from script tag attribute or URL query parameter
// Extract token from script tags (same pattern as useVisitorData)
const scripts = document.getElementsByTagName('script');
let theme: Theme = 'light';
let embedScript: HTMLScriptElement | null = null;

for (let i = 0; i < scripts.length; i++) {
  const script = scripts[i];
  if (script.src && script.src.includes('embed.js')) {
    embedScript = script;
    const url = new URL(script.src);
    const themeParam = url.searchParams.get('theme');
    if (themeParam === 'dark' || themeParam === 'light') {
      theme = themeParam;
      break;
    }
  }
  // Also check data attribute
  if (script.dataset.theme === 'dark' || script.dataset.theme === 'light') {
    theme = script.dataset.theme as Theme;
    break;
  }
  // Also check regular attribute
  const attrTheme = script.getAttribute('theme');
  if (attrTheme === 'dark' || attrTheme === 'light') {
    theme = attrTheme as Theme;
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
  ${generateThemeCSS(theme, cssClass)}

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
    width: 300px;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--foreground));
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

// Find container: use script's parent if it exists, otherwise fall back to body
let containerElement: HTMLElement = document.body;
if (embedScript && embedScript.parentElement) {
  containerElement = embedScript.parentElement;
}

// Get parent classes to inherit positioning/styling
const parentClasses = containerElement !== document.body && containerElement.className 
  ? containerElement.className 
  : '';

// Create root element with unique ID
let rootElement = document.getElementById(rootId);
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = rootId;
  // Combine embed class with parent classes so positioning/styling is inherited
  rootElement.className = parentClasses ? `${cssClass} ${parentClasses}` : cssClass;
  containerElement.appendChild(rootElement);
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