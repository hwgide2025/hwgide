#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pkgPath = path.resolve(__dirname, '..', 'package.json')
const raw = fs.readFileSync(pkgPath, 'utf8')
let pkg
try {
  pkg = JSON.parse(raw)
} catch (e) {
  console.error('Failed to parse package.json')
  process.exit(1)
}

const semver = (pkg.version || '0.0.0').split('.').map(n => parseInt(n, 10) || 0)
semver[2] = (semver[2] || 0) + 1 // bump patch
const newVersion = `${semver[0]}.${semver[1]}.${semver[2]}`
pkg.version = newVersion

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log(`Bumped package.json version -> ${newVersion}`)
