#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outPath = path.resolve(__dirname, '..', 'src', 'buildInfo.js')
const now = new Date().toISOString()
const content = `// Generated at build time\nconst BUILD_TIMESTAMP = '${now}'\nexport default BUILD_TIMESTAMP\n`

fs.writeFileSync(outPath, content, 'utf8')
console.log(`Wrote build timestamp ${now} to src/buildInfo.js`)
