# suppress-biome-errors

If you have a large number of biome errors, you can use this tool to automatically add biome-ignore comments.

> [!WARNING]
> This tool uses @biomejs/js-api of alpha version.

## Acknowledgments

This tool is forked from [suppress-eslint-errors](https://github.com/amanda-mitchell/suppress-eslint-errors) by [
Amanda Mitchell](https://github.com/amanda-mitchell).

## How it works

`suppress-biome-errors` is a codemod for [jscodeshift](https://github.com/facebook/jscodeshift) that runs biome against your existing code.
For each biome error it finds, it adds a little snippet:

```javascript
// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix this the next time the file is edited.
```

This way, you can get the benefits of the rule in new code without having to immediately work through a huge backlog.

## Usage

`suppress-biome-errors` comes with a wrapper script so that you can call it directly without installing anything extra:

```bash
npx suppress-biome-errors [jscodeshift options] PATH...
```

The wrapper will call `jscodeshift` with the transformer and any other arguments that you pass to it.
If it detects a `.gitignore` in the local directory, it will also specify that as the `--ignore-config`.

_NOTE:_ `jscodeshift` has some bugs with respect to how it handles `.gitignore` files that sometimes causes it to ignore all files.
If this tool detects that your `.gitignore` contains problematic patterns, the `--ignore-config` option will be skipped.

In some cases, the code produced by this codemod will make some unfortunate indentation decisions.
Be sure to re-run any code formatting tools you use before committing!

## Options

**--message**: Sets the comment to add biome-ignore explanation.

**--rules**: Comma-separated list of biome rule category to disable. When specified, violations of rules not in this set will be left in place.

**--config-path** The path to a biome configuration file that will be used to determine which rules to disable. If not specified, find biome.json or biome.jsonc automatically.

## Examples

Suppress all errors in the `index.js` file, using a custom comment:

```bash
npx @ton1517/suppress-biome-errors ./index.js --message="TODO: Issue #123"
```

Suppress violations of the `lint/suspicious/noExplicitAny` and `lint/style/noNonNullAssertion` rules in .ts and .tsx files in the `src` directory:

```bash
npx @ton1517/suppress-biome-errors ./src --extensions=ts,tsx --parser=tsx --rules='lint/suspicious/noExplicitAny,lint/style/noNonNullAssertion'
```
