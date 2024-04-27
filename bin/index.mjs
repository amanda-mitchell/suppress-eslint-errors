#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import chalk from 'chalk'
import { sync } from 'cross-spawn'
import pleaseUpgradeNode from 'please-upgrade-node'

const require = createRequire(import.meta.url)
// This must be performed before anything else in order for
// please-upgrade-node to work properly.
const pkg = require('../package.json')
pleaseUpgradeNode(pkg)

const workingDirectoryRequire = createRequire(resolve(process.cwd(), 'index.js'))

function logWarning(...args) {
  console.warn(chalk.yellow(...args))
}

function logError(...args) {
  console.error(chalk.red(...args))
}

try {
  workingDirectoryRequire('biome')
} catch (x) {
  Promise.all([
    logError('biome was not found.'),
    logError('suppress-biome-errors requires biome to be installed in the working directory.'),
  ]).finally(() => process.exit(1))
}

const jscodeshiftPath = require.resolve('jscodeshift/bin/jscodeshift')
const transformPath = require.resolve('../transforms/suppress-biome-errors.ts')

async function findGitignoreArguments() {
  const gitignorePath = resolve(process.cwd(), '.gitignore')

  if (!existsSync(gitignorePath)) {
    return []
  }

  const allLines = readFileSync(gitignorePath, { encoding: 'utf8' }).split('\n')
  if (allLines.findIndex((line) => line.startsWith('!')) !== -1) {
    logWarning('your .gitignore contains exclusions, which jscodeshift does not properly support.')
    logWarning('skipping the ignore-config option.')

    return []
  }

  return ['--ignore-config=.gitignore']
}
;(async function runJsCodeShift() {
  const result = sync(
    'node',
    [
      jscodeshiftPath,
      '-t',
      transformPath,
      ...(await findGitignoreArguments()),
      ...process.argv.slice(2),
    ],
    {
      stdio: 'inherit',
    },
  )

  if (result.signal) {
    if (result.signal === 'SIGKILL') {
      console.error(
        'The script failed because the process exited too early. ' +
          'This probably means the system ran out of memory or someone called ' +
          '`kill -9` on the process.',
      )
    } else if (result.signal === 'SIGTERM') {
      console.error(
        'The script failed because the process exited too early. ' +
          'Someone might have called `kill` or `killall`, or the system could ' +
          'be shutting down.',
      )
    }
    process.exit(1)
  }

  process.exit(result.status)
})()
