import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'toast-custom',
          style: {
            background: '#1a2030',
            color: '#e2e8f0',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: '5px',
            fontSize: '13px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#0c1017' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#0c1017' } },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
