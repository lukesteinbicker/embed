export type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  foreground: string;
  muted: string;
  'muted-special': string;
  special: string;
  'special-l': string;
  'muted-foreground': string;
  primary: string;
  'primary-foreground': string;
  constructive: string;
  'constructive-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  border: string;
  ring: string;
  radius: string;
}

export const themes: Record<Theme, ThemeColors> = {
  dark: {
    background: '202 7% 3%',
    foreground: '202 7% 93%',
    muted: '202 7% 12%',
    'muted-special': '202 15% 15%',
    special: '228 35% 37%',
    'special-l': '228 35% 27%',
    'muted-foreground': '202 7% 83%',
    primary: '202 7% 17%',
    'primary-foreground': '202 7% 93%',
    constructive: '218 36% 18%',
    'constructive-foreground': '202 7% 93%',
    destructive: '202 7% 17%',
    'destructive-foreground': '202 7% 93%',
    border: '202 7% 50%',
    ring: '202 7% 93%',
    radius: '0.5rem',
  },
  light: {
    background: '202 7% 93%',
    foreground: '202 7% 7%',
    muted: '202 7% 88%',
    'muted-special': '202 15% 85%',
    special: '228 35% 47%',
    'special-l': '228 35% 37%',
    'muted-foreground': '202 7% 17%',
    primary: '202 7% 83%',
    'primary-foreground': '202 7% 7%',
    constructive: '218 36% 38%',
    'constructive-foreground': '202 7% 93%',
    destructive: '202 7% 83%',
    'destructive-foreground': '202 7% 7%',
    border: '202 7% 50%',
    ring: '202 7% 7%',
    radius: '0.5rem',
  }
};

export function generateThemeCSS(theme: Theme, cssClass: string): string {
  const themeColors = themes[theme];
  const cssVariables = Object.entries(themeColors)
    .map(([key, value]) => `    --${key}: ${value};`)
    .join('\n');

  return `
  /* Embed widget CSS variables - theme: ${theme} - ID: ${cssClass} */
  .${cssClass} {
${cssVariables}
  }`;
}

