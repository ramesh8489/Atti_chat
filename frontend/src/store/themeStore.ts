import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('pingup_theme');
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDocument(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

const initial = getInitialTheme();
applyThemeToDocument(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('pingup_theme', next);
      applyThemeToDocument(next);
      return { theme: next };
    });
  },
  setTheme: (theme) => {
    localStorage.setItem('pingup_theme', theme);
    applyThemeToDocument(theme);
    set({ theme });
  },
}));

