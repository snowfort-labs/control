import React from 'react';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { useTheme } from '../hooks/useTheme';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="header">
      <div className="header-title">
        <img 
          src={theme === 'dark' ? require('../assets/snowfort-logo-inverted-no-bg.png') : require('../assets/snowfort-logo.png')}
          alt="Snowfort Logo" 
          className="snowfort-logo"
        />
        <h1>Snowfort</h1>
        <span className="badge">MVP</span>
      </div>
      
      <div className="header-status">
        <div className="status-indicator">
          <span className="status-dot active"></span>
          <span>3 Active</span>
          <span className="status-dot working" style={{ marginLeft: 8 }}></span>
          <span>2 Working</span>
        </div>
        
        <select>
          <option>Manual Mode</option>
          <option>Guided Mode</option>
          <option>Auto Mode</option>
        </select>

        <button className="dark-mode-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </div>
  );
};