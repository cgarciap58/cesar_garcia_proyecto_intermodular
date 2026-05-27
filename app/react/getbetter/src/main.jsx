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

  const img = splash.querySelector('img')

  const doHide = () => {
    splash.classList.add('hide')
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  }

  // If the img is already loaded (cached), hide after a brief moment so the gif is visible
  if (!img || img.complete) {
    setTimeout(doHide, 600)
  } else {
    // Wait for the gif to load, then show it for at least 800ms before hiding
    img.addEventListener('load', () => setTimeout(doHide, 800), { once: true })
  }
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
