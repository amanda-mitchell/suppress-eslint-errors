#!/usr/bin/env node

// This must be performed before anything else in order for
// please-upgrade-node to work properly.
// eslint-disable-next-line import/order
const pkg = require('../package.json');
require('please-upgrade-node')(pkg);

const fs = require('fs');
const { createRequireFromPath } = require('module');
const path = require('path');
const chalk = require('chalk');
const spawn = require('cross-spawn');

const workingDirectoryRequire = createRequireFromPath(path.resolve(process.cwd(), 'index.js'));

try {
	workingDirectoryRequire('eslint');
} catch (x) {
	console.error(chalk.red('eslint was not found.'));
	console.error(
		chalk.red('suppress-eslint-errors requires eslint to be installed in the working directory.')
	);
	process.exit(1);
}

const jscodeshiftPath = require.resolve('jscodeshift/bin/jscodeshift');
const transformPath = require.resolve('../transforms/suppress-eslint-errors');

const gitignoreArguments = [];
if (fs.existsSync(path.resolve(process.cwd(), '.gitignore'))) {
	gitignoreArguments.push(`--ignore-config=.gitignore`);
}

const result = spawn.sync(
	'node',
	[jscodeshiftPath, '-t', transformPath].concat(gitignoreArguments).concat(process.argv.slice(2)),
	{
		stdio: 'inherit',
	}
);

if (result.signal) {
	if (result.signal === 'SIGKILL') {
		console.error(
			'The script failed because the process exited too early. ' +
				'This probably means the system ran out of memory or someone called ' +
				'`kill -9` on the process.'
		);
	} else if (result.signal === 'SIGTERM') {
		console.error(
			'The script failed because the process exited too early. ' +
				'Someone might have called `kill` or `killall`, or the system could ' +
				'be shutting down.'
		);
	}
	process.exit(1);
}
