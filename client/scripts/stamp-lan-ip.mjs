#!/usr/bin/env node
/**
 * Rewrite VITE_PROD_API_URL in client/.env to this machine's current LAN IP.
 *
 * The native app cannot use localhost — on a device that resolves to the device
 * — so on-device testing points at the Mac's LAN address. That address is
 * baked into the bundle at build time and DHCP reassigns it without warning:
 * the app then spins forever on every request, with no error that points at
 * the cause. Stamping it at build time removes the trap.
 *
 * Only touches URLs that are already a private address, so it can never
 * clobber a real production host. Run via `npm run build:device`.
 */

import { networkInterfaces } from 'node:os'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const PORT = process.env.ARTBEAT_API_PORT ?? '3001'

/** Private (RFC1918) IPv4 ranges — a LAN address, not a routable host. */
const isPrivate = (ip) =>
  /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)

function currentLanIp() {
  // Prefer en0 (Wi-Fi on a Mac), then any other non-internal IPv4.
  const nets = networkInterfaces()
  const ordered = ['en0', ...Object.keys(nets).filter((n) => n !== 'en0')]
  for (const name of ordered) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && isPrivate(net.address)) {
        return net.address
      }
    }
  }
  return null
}

const ip = currentLanIp()
if (!ip) {
  console.error('✗ No private LAN address found. Are you on Wi-Fi?')
  process.exit(1)
}

if (!existsSync(ENV_PATH)) {
  console.error(`✗ ${ENV_PATH} not found. Copy .env.example to .env first.`)
  process.exit(1)
}

const target = `http://${ip}:${PORT}`
const original = readFileSync(ENV_PATH, 'utf8')

const line = /^VITE_PROD_API_URL=(.*)$/m
const match = original.match(line)

if (!match) {
  console.error('✗ No VITE_PROD_API_URL line in .env — add one (see .env.example).')
  process.exit(1)
}

const existing = match[1].trim()

// Refuse to overwrite anything that is not a private-IP dev URL: a real host
// must only ever change deliberately.
const existingHost = existing.replace(/^https?:\/\//, '').split(':')[0]
if (existing && !isPrivate(existingHost) && existingHost !== 'localhost') {
  console.log(`• VITE_PROD_API_URL is "${existing}" — not a LAN address, leaving it alone.`)
  process.exit(0)
}

if (existing === target) {
  console.log(`✓ VITE_PROD_API_URL already ${target}`)
  process.exit(0)
}

writeFileSync(ENV_PATH, original.replace(line, `VITE_PROD_API_URL=${target}`))
console.log(`✓ VITE_PROD_API_URL: ${existing || '(empty)'} → ${target}`)
