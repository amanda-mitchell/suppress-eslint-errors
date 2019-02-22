module.exports = {
	extends: ['@commitlint/config-angular'],
	rules: {
		'subject-full-stop': [2, 'always', '.'],
		'subject-case': [2, 'always', 'sentence-case'],
		'scope-empty': [2, 'never'],
		'scope-case': [0],
		'header-max-length': [2, 'always', 120],
		'type-enum': [
			2,
			'always',
			['chore', 'docs', 'feat', 'fix', 'perf', 'refactor', 'style', 'test'],
		],
	},
};
