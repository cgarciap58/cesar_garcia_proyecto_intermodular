import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import './i18n/config.js'
import './index.css'
import App from './App.jsx'

function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('hide')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider onReady={hideSplash}>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
