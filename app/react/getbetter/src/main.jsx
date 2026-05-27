import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import './i18n/config.js'  // initialise i18next before anything renders
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)


// Fade out the splash screen once React starts rendering
const splash = document.getElementById('splash')
if (splash) {
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 400) // clean up after fade
}