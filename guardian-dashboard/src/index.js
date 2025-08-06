import React from 'react';
import ReactDOM from 'react-dom/client';
import GuardianPlatform from './GuardianPlatform';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4',
    },
    secondary: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ffc107',
    },
    success: {
      main: '#4caf50',
    },
    background: {
      default: '#0f1419',
      paper: 'rgba(30, 39, 50, 0.95)',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <GuardianPlatform />
    </ThemeProvider>
  </React.StrictMode>
);