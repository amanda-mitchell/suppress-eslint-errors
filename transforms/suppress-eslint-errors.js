const { createRequireFromPath } = require('module');
const path = require('path');

const workingDirectoryRequire = createRequireFromPath(path.resolve(process.cwd(), 'index.js'));
const eslint = workingDirectoryRequire('eslint');

const cliEngine = new eslint.CLIEngine();

const eslintDisableRegexp = /^\s*eslint-disable-next-line(\s|$)(.*)/;

module.exports = function codeMod(file, api, options) {
	const results = cliEngine.executeOnText(file.source, file.path).results;

	if (!results || !results[0] || !results[0].messages) {
		return;
	}

	const targets = results[0].messages.map(({ ruleId, line }) => ({
		ruleId,
		targetLine: line,
	}));

	if (!targets.length) {
		return;
	}

	const result = api.j(file.source);

	const commentText =
		options && options.message
			? options.message
			: 'TODO: Fix this the next time the file is edited.';

	for (const { targetLine, ruleId } of targets) {
		const firstPathOnLine = result
			.find(
				'Node',
				node => node.loc && node.loc.start.line === targetLine && node.loc.end.line === targetLine
			)
			.paths()[0];

		if (!firstPathOnLine) {
			api.report(
				`Unable to find any nodes on line ${targetLine} of ${
					file.path
				}. Skipping suppression of ${ruleId}`
			);
			continue;
		}

		addDisableComment(file.path, api, commentText, targetLine, ruleId, firstPathOnLine);
	}

	return result.toSource();
};

function addDisableComment(filePath, api, commentText, targetLine, ruleId, path) {
	let targetPath = path;
	while (
		targetPath.parent &&
		targetPath.parent.node.loc &&
		targetPath.parent.node.loc.start.line === targetLine
	) {
		targetPath = targetPath.parent;
	}

	if (targetPath.node.type === 'JSXClosingElement') {
		api.report(`Skipping suppression of violation of ${ruleId} on ${targetLine} of ${filePath}`);
		return;
	}

	if (targetPath.parent && targetPath.parent.node.type.substr(0, 3) === 'JSX') {
		let siblingIndex = targetPath.parent.value.children.indexOf(targetPath.value) - 1;

		while (siblingIndex >= 0) {
			const sibling = targetPath.parent.value.children[siblingIndex];
			if (sibling.type === 'JSXText') {
				siblingIndex--;
			} else {
				if (
					sibling.type === 'JSXExpressionContainer' &&
					sibling.expression.type === 'JSXEmptyExpression' &&
					sibling.expression.comments &&
					sibling.expression.comments.length
				) {
					const lastComment = sibling.expression.comments[sibling.expression.comments.length - 1];

					const match = eslintDisableRegexp.exec(lastComment.value);
					if (match) {
						const disabledRules = match[2].split(',').map(x => x.trim());
						if (!disabledRules.length || disabledRules.includes(ruleId)) {
							return;
						}

						lastComment.value = ` ${lastComment.value.trim()}, ${ruleId} `;
						return;
					}
				}

				break;
			}
		}

		targetPath.insertBefore(createJsxComment(api, commentText));
		targetPath.insertBefore(api.j.jsxText('\n'));
		targetPath.insertBefore(createJsxComment(api, `eslint-disable-next-line ${ruleId}`));
		targetPath.insertBefore(api.j.jsxText('\n'));
	} else {
		const targetNode = targetPath.value;
		if (!targetNode.comments) {
			targetNode.comments = [];
		}

		if (targetNode.comments.length) {
			const lastComment = targetNode.comments[targetNode.comments.length - 1];

			const match = eslintDisableRegexp.exec(lastComment.value);
			if (match) {
				const disabledRules = match[2].split(',').map(x => x.trim());
				if (!disabledRules.length || disabledRules.includes(ruleId)) {
					return;
				}

				lastComment.value = ` ${lastComment.value.trim()}, ${ruleId}`;
				return;
			}
		}

		targetNode.comments.push(
			api.j.line(` ${commentText}`),
			api.j.line(` eslint-disable-next-line ${ruleId}`)
		);
	}
}

// Using the builder methods to generate a jsx comment expression
// results in newlines in weird places. Parsing the exact strings that
// we want, however, produces the desired output.
function createJsxComment(api, text) {
	// The <element> around the curly braces causes this to be parsed as a JSXExpressionContainer
	// instead of as a BlockExpression.
	return api.j(`<element>{/* ${text} */}</element>`).paths()[0].value.program.body[0].expression
		.children[0];
}
