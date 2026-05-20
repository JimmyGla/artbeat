import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.artbeat.app',
  appName: 'ArtBeat',
  webDir: 'dist',

  // Background shown while the WebView is loading — matches brand-50.
  // Update this hex if you change the app's primary background colour.
  backgroundColor: '#fdf4ff',

  server: {
    // Uncomment and set to your dev machine's local IP to enable live reload
    // on a physical device (run `npm run dev` first, then deploy with cap run).
    // url: 'http://192.168.1.X:5173',
    // cleartext: true,

    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#fdf4ff',
      showSpinner: false,
    },
  },
}

export default config
