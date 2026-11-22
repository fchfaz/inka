import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


const splash = document.getElementById('splash')
if (splash) {
  const MIN_VISIBLE_MS = 1700
  const hide = () => {
    splash.classList.add('splash-hide')
    window.setTimeout(() => splash.remove(), 600)
  }
  window.setTimeout(hide, Math.max(0, MIN_VISIBLE_MS - performance.now()))
}
