// Centralized configuration for the embed
export const EMBED_CONFIG = {
  // CHANGE THIS DOMAIN WHEN DEPLOYED WITH DIFFERENT DOMAIN
  DOMAIN: 'demoservice.app',
  
  get API_BASE() {
    return `http://demoservice.app`;
  }
};
