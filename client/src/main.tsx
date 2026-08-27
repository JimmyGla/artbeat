import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import App from './App'
import { installGlobalHandlers, track } from './lib/telemetry'
import './index.css'

// Installed before React mounts so an error thrown during the first render is
// still caught. Previously only React render errors were noticed at all —
// unhandled rejections vanished silently.
installGlobalHandlers()
track('app_opened')

// ─── Native shell setup ──────────────────────────────────────────────────────
//
// Runs only inside the Capacitor WebView.  The app deliberately draws *under*
// the status bar (viewport-fit=cover, with every header padded by
// safe-area-inset-top), so the bar overlays the WebView.  `Style.Light` means
// dark status-bar text — correct against our light headers and map pills.

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
  StatusBar.setStyle({ style: Style.Light }).catch(() => {})

  // `Native` resize keeps the WebView itself full-height and lets the OS
  // scroll focused inputs into view, instead of squashing the layout.
  Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {})
  Keyboard.setScroll({ isDisabled: false }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
