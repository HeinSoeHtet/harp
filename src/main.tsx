import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Initialize Google Auth for web support if needed
GoogleAuth.initialize({
  clientId: import.meta.env.VITE_DRIVE_CLIENT_ID,
  scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
  grantOfflineAccess: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
