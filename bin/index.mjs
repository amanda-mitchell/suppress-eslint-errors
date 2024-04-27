#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import { sync } from 'cross-spawn'
import findConfig from 'find-config'
import pleaseUpgradeNode from 'please-upgrade-node'

function logWarning(...args) {
  console.warn(chalk.yellow(...args))
}

function logError(...args) {
  console.error(chalk.red(...args))
}

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

async function main() {
  const require = createRequire(import.meta.url)
  // This must be performed before anything else in order for
  // please-upgrade-node to work properly.
  const pkg = require('../package.json')
  pleaseUpgradeNode(pkg)

  const jscodeshiftPath = require.resolve('jscodeshift/bin/jscodeshift')
  const transformPath = require.resolve('../transforms/suppress-biome-errors.ts')

  const program = new Command()
  program
    .name(pkg.name)
    .description(`${pkg.description}

Example:
Suppress all errors in the index.js file, using a custom comment:
> npx @ton1517/suppress-biome-errors ./index.js --message="TODO: Issue #123"

Suppress violations of the lint/suspicious/noExplicitAny and lint/style/noNonNullAssertion rules in .ts and .tsx files in the src directory:
> npx @ton1517/suppress-biome-errors ./src --extensions=ts,tsx --parser=tsx --rules='lint/suspicious/noExplicitAny,lint/style/noNonNullAssertion'
`)
    .version(pkg.version, '--version')
    .allowUnknownOption()
    .usage('[jscodeshift options] PATH...')
    .argument('PATH...', 'path')
    .option('--message <MESSAGE>', 'Sets the comment to add biome-ignore explanation.')
    .option(
      '--rules <RULES>',
      'Comma-separated list of biome rule category to disable. When specified, violations of rules not in this set will be left in place.',
    )
    .option(
      '--config-path <PATH>',
      'The path to a biome configuration file that will be used to determine which rules to disable. If not specified, find biome.json or biome.jsonc automatically.',
    )
    .addHelpText(
      'after',
      `
See jscodeshift help for other options.

--------------------
jscodeshift
${sync('node', [jscodeshiftPath, '--help']).stdout.toString()}`,
    )

  program.parse()

  const argv = process.argv.slice(2)

  const options = program.opts()
  if (!options.configPath) {
    const configPath = findConfig('biome.json') ?? findConfig('biome.jsonc')
    if (!configPath) {
      logError('biome.json or biome.jsonc not found')
      process.exit(1)
    }

    argv.push('--config-path', configPath)
  }

  const result = sync(
    'node',
    [jscodeshiftPath, '-t', transformPath, ...(await findGitignoreArguments()), ...argv],
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
}

main()
