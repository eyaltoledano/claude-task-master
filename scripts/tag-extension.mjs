#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the extension's publishing package.json for accurate version/name
const extensionDir = join(__dirname, '..', 'apps', 'extension')
const publishPkgPath = join(extensionDir, 'package.publish.json')

let pkg
try {
  const pkgContent = readFileSync(publishPkgPath, 'utf8')
  pkg = JSON.parse(pkgContent)
} catch (error) {
  console.error('Failed to read package.publish.json:', error.message)
  process.exit(1)
}

// Ensure we have required fields
assert(pkg.name, 'package.publish.json must have a name field')
assert(pkg.version, 'package.publish.json must have a version field')
assert(pkg.repository, 'package.publish.json must have a repository field')

const tag = `${pkg.name}@${pkg.version}`

// Get repository URL - handle both string and object format
const repoUrl = typeof pkg.repository === 'string' 
  ? pkg.repository 
  : pkg.repository.url

assert(repoUrl, 'Repository URL not found in package.publish.json')

const { status, stdout, error } = spawnSync('git', [
  'ls-remote',
  repoUrl,
  tag
])

assert.equal(status, 0, error)

const exists = String(stdout).trim() !== ''

if (!exists) {
  console.log(`\nNew extension tag: ${tag}`)
} else {
  console.log(`\nExtension tag already exists: ${tag}`)
} 