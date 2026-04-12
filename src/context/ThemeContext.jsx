import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('acl_theme') || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (currentTheme) => {
      root.setAttribute('data-theme', currentTheme);
      
      if (currentTheme === 'dark' || currentTheme === 'dim') {
        root.classList.add('dark'); // keep generic 'dark' class for some utilities
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme(theme);
    localStorage.setItem('acl_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dim';
      if (prev === 'dim') return 'dark';
      return 'light';
    });
  };

  const setExplicitTheme = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setExplicitTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
