import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/700.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import App from './App.jsx';
import './index.css';

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#F8F4EA' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
}

createRoot(document.getElementById('root')).render(<App />);
