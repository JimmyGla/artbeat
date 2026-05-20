import { Capacitor } from '@capacitor/core'

const devUrl  = import.meta.env.VITE_API_URL      || 'http://localhost:3001'
const prodUrl = import.meta.env.VITE_PROD_API_URL || devUrl

export const API_BASE: string = Capacitor.isNativePlatform() ? prodUrl : devUrl
