#!/usr/bin/env node

// This must be performed before anything else in order for
// please-upgrade-node to work properly.
const pkg = require('../package.json')
require('please-upgrade-node')(pkg)

const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')
const spawn = require('cross-spawn')

const workingDirectoryRequire = createRequire(path.resolve(process.cwd(), 'index.js'))

const chalkImport = import('chalk')

async function logWarning(...args) {
  const { default: chalk } = await chalkImport
  console.warn(chalk.yellow(...args))
}

async function logError(...args) {
  const { default: chalk } = await chalkImport
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
  const gitignorePath = path.resolve(process.cwd(), '.gitignore')

  if (!fs.existsSync(gitignorePath)) {
    return []
  }

  const allLines = fs.readFileSync(gitignorePath, { encoding: 'utf8' }).split('\n')
  if (allLines.findIndex((line) => line.startsWith('!')) !== -1) {
    await logWarning(
      'your .gitignore contains exclusions, which jscodeshift does not properly support.',
    )
    await logWarning('skipping the ignore-config option.')

    return []
  }

  return ['--ignore-config=.gitignore']
}
;(async function runJsCodeShift() {
  const result = spawn.sync(
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
