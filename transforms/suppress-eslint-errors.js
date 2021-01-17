const { createRequire } = require('module');
const path = require('path');

const workingDirectoryRequire = createRequire(path.resolve(process.cwd(), 'index.js'));
const { CLIEngine } = workingDirectoryRequire('eslint');

const eslintDisableRegexp = /^\s*eslint-disable-next-line(\s|$)(.*)/;

module.exports = function codeMod(file, api, options) {
	const { results } = new CLIEngine({
		baseConfig: options.baseConfig ? JSON.parse(options.baseConfig) : null,
	}).executeOnText(file.source, file.path);

	if (!results || !results[0] || !results[0].messages) {
		return;
	}

	const targets = results[0].messages
		.filter(({ ruleId, severity }) => ruleId && severity >= 2)
		.map(({ ruleId, line }) => ({
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

	const ruleIdWhitelist = (options.rules || '').split(',').filter((x) => x);
	const ruleIdWhitelistSet = ruleIdWhitelist.length ? new Set(ruleIdWhitelist) : null;

	for (const { targetLine, ruleId } of targets) {
		if (ruleIdWhitelistSet && !ruleIdWhitelistSet.has(ruleId)) {
			continue;
		}

		const pathsStartingOnLine = result
			.find('Node', (node) => node.loc && node.loc.start.line === targetLine)
			.paths();

		const firstPathOnLine =
			pathsStartingOnLine.find((path) => path.node.loc.end.line === targetLine) ||
			pathsStartingOnLine[0];

		if (!firstPathOnLine) {
			api.report(
				`Unable to find any nodes on line ${targetLine} of ${file.path}. Skipping suppression of ${ruleId}`
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
		(!targetPath.parent.node.loc || targetPath.parent.node.loc.start.line === targetLine)
	) {
		targetPath = targetPath.parent;
	}

	if (targetPath.node.type === 'JSXClosingElement') {
		const { children } = targetPath.parent.value;

		if (tryRewriteJsxEslintDisable(children, children.length, ruleId)) {
			return;
		}

		children.push(createJsxComment(api, commentText));
		children.push(api.j.jsxText('\n'));
		children.push(createJsxComment(api, `eslint-disable-next-line ${ruleId}`));
		children.push(api.j.jsxText('\n'));

		return;
	}

	if (targetPath.node.type === 'JSXAttribute') {
		createNormalComment(api, ruleId, commentText, targetPath.value);

		return;
	}

	if (targetPath.parent && targetPath.parent.node.type === 'JSXExpressionContainer') {
		createNormalComment(api, ruleId, commentText, targetPath.value);

		return;
	}

	if (targetPath.parent && targetPath.parent.node.type.substr(0, 3) === 'JSX') {
		if (!targetPath.parent.value.children) {
			api.report(`Skipping suppression of violation of ${ruleId} on ${targetLine} of ${filePath}`);
			return;
		}

		const { children } = targetPath.parent.value;
		if (tryRewriteJsxEslintDisable(children, children.indexOf(targetPath.value), ruleId)) {
			return;
		}

		targetPath.insertBefore(createJsxComment(api, commentText));
		targetPath.insertBefore(api.j.jsxText('\n'));
		targetPath.insertBefore(createJsxComment(api, `eslint-disable-next-line ${ruleId}`));
		targetPath.insertBefore(api.j.jsxText('\n'));

		return;
	}

	createNormalComment(api, ruleId, commentText, targetPath.value);
}

function createNormalComment(api, ruleId, commentText, targetNode) {
	if (tryRewriteEslintDisable(targetNode, ruleId)) {
		return;
	}

	if (!targetNode.comments) {
		targetNode.comments = [];
	}

	targetNode.comments.push(
		api.j.line(` ${commentText}`),
		api.j.line(` eslint-disable-next-line ${ruleId}`)
	);
}

function tryRewriteJsxEslintDisable(children, targetIndex, ruleId) {
	let currentIndex = targetIndex - 1;

	while (currentIndex >= 0) {
		const sibling = children[currentIndex];
		if (sibling.type === 'JSXText') {
			currentIndex--;
		} else {
			if (
				sibling.type === 'JSXExpressionContainer' &&
				sibling.expression.type === 'JSXEmptyExpression' &&
				tryRewriteEslintDisable(sibling.expression, ruleId)
			) {
				return true;
			}

			return false;
		}
	}

	return false;
}

function tryRewriteEslintDisable(targetNode, ruleId) {
	if (!targetNode.comments || !targetNode.comments.length) {
		return false;
	}

	const lastComment = targetNode.comments[targetNode.comments.length - 1];

	const match = eslintDisableRegexp.exec(lastComment.value);
	if (!match) {
		return false;
	}

	const [ruleDetails, ...explanationParts] = match[2].split('--');

	const disabledRules = ruleDetails.split(',').map((x) => x.trim());
	if (!disabledRules.length || disabledRules.includes(ruleId)) {
		return true;
	}

	const explanationSuffix = explanationParts.length
		? ` -- ${explanationParts.join('--').trim()}`
		: '';

	lastComment.value = ` eslint-disable-next-line ${disabledRules.join(
		', '
	)}, ${ruleId}${explanationSuffix}`;

	if (lastComment.type === 'CommentBlock') {
		lastComment.value += ' ';
	}

	return true;
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
