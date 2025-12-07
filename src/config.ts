// Centralized configuration for the embed
export const EMBED_CONFIG = {
  // CHANGE THIS DOMAIN WHEN DEPLOYED WITH DIFFERENT DOMAIN
  DOMAIN: 'localhost:3000',
  
  get API_BASE() {
    return `http://localhost:3000`;
  }
};
