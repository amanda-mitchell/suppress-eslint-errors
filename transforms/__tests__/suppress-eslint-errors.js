/* globals test, expect */
const path = require('path');
const jscodeshift = require('jscodeshift');
const codeMod = require('../suppress-eslint-errors');

test('inserts a new comment in javascript', () => {
	const program = `export function foo(a, b) {
  return a == b;
}
`;

	expect(modifySource(program)).toBe(`export function foo(a, b) {
  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line eqeqeq
  return a == b;
}
`);
});

test("doesn't update unnecessarily", () => {
	const program = `export function foo(a, b) {
		// TODO: Fix this the next time the file is edited.
		// eslint-disable-next-line eqeqeq
		return a == b;
	}
	`;

	expect(modifySource(program)).toBe(undefined);
});

test('inserts a new comment in jsx', () => {
	const program = `export function Component({ a, b }) {
  return (
    <div>
      <div>{a == b}</div>
    </div>
  );
}`;

	expect(modifySource(program)).toBe(`export function Component({ a, b }) {
  return (
    (<div>
      {/* TODO: Fix this the next time the file is edited. */}
      {/* eslint-disable-next-line eqeqeq */}
      <div>{a == b}</div>
    </div>)
  );
}`);
});

test('updates an existing comment in javascript', () => {
	const program = `export function foo(a, b) {
  // eslint-disable-next-line eqeqeq
  const bar = a == b;
}
`;

	expect(modifySource(program)).toBe(`export function foo(a, b) {
  // eslint-disable-next-line eqeqeq, no-unused-vars
  const bar = a == b;
}
`);
});

test('updates an existing comment with an explanation in javascript', () => {
	const program = `export function foo(a, b) {
  // eslint-disable-next-line eqeqeq -- for reasons
  const bar = a == b;
}
`;

	expect(modifySource(program)).toBe(`export function foo(a, b) {
  // eslint-disable-next-line eqeqeq, no-unused-vars -- for reasons
  const bar = a == b;
}
`);
});

test('updates an existing comment in jsx', () => {
	const program = `export function Component({ a }) {
  return (
    <div>
      {/* eslint-disable-next-line eqeqeq */}
      <div>{a == c}</div>
    </div>
  );
}`;

	expect(modifySource(program)).toBe(`export function Component({ a }) {
  return (
    <div>
      {/* eslint-disable-next-line eqeqeq, no-undef */}
      <div>{a == c}</div>
    </div>
  );
}`);
});

test('updates an existing comment with an explanation in jsx', () => {
	const program = `export function Component({ a }) {
  return (
    <div>
      {/* eslint-disable-next-line eqeqeq -- for reasons */}
      <div>{a == c}</div>
    </div>
  );
}`;

	expect(modifySource(program)).toBe(`export function Component({ a }) {
  return (
    <div>
      {/* eslint-disable-next-line eqeqeq, no-undef -- for reasons */}
      <div>{a == c}</div>
    </div>
  );
}`);
});

test('inserts comments above a closing tag', () => {
	const program = `export function Component({ a, b }) {
  return (
    <div>
      <div>
      </div>{a == b}
    </div>
  );
}`;

	expect(modifySource(program)).toBe(`export function Component({ a, b }) {
  return (
    <div>
      <div>
        {/* TODO: Fix this the next time the file is edited. */}
        {/* eslint-disable-next-line eqeqeq */}
      </div>{a == b}
    </div>
  );
}`);
});

test('updates comments above a closing tag', () => {
	const program = `export function Component({ a }) {
  return (
    <div>
      <div>
        {/* eslint-disable-next-line eqeqeq */}
      </div>{a == c}
    </div>
  );
}`;

	expect(modifySource(program)).toBe(`export function Component({ a }) {
  return (
    <div>
      <div>
        {/* eslint-disable-next-line eqeqeq, no-undef */}
      </div>{a == c}
    </div>
  );
}`);
});

test('supports adding comments to JSX attributes', () => {
	const program = `export function Component({ a, b }) {
    return (
      <div
        prop={a == b ? a : b}>
      </div>
    );
  }`;

	expect(modifySource(program)).toBe(`export function Component({ a, b }) {
    return (
      <div
        // TODO: Fix this the next time the file is edited.
        // eslint-disable-next-line eqeqeq
        prop={a == b ? a : b}>
      </div>
    );
  }`);
});

test('supports alternative messages in javascript', () => {
	const program = `export function foo(a, b) {
  return a == b;
}
`;

	expect(modifySource(program, { message: 'Something more informative' }))
		.toBe(`export function foo(a, b) {
  // Something more informative
  // eslint-disable-next-line eqeqeq
  return a == b;
}
`);
});

test('supports alternative messages in jsx', () => {
	const program = `export function Component({ a, b }) {
  return (
    <div>
      <div>{a == b}</div>
    </div>
  );
}`;

	expect(modifySource(program, { message: 'Something more informative' }))
		.toBe(`export function Component({ a, b }) {
  return (
    (<div>
      {/* Something more informative */}
      {/* eslint-disable-next-line eqeqeq */}
      <div>{a == b}</div>
    </div>)
  );
}`);
});

test('supports rule whitelist in javascript', () => {
	const program = `export function foo(a, b) {
  return a == b;
  console.log('unreachable');
}
`;

	expect(modifySource(program, { rules: 'no-unreachable' })).toBe(`export function foo(a, b) {
  return a == b;
  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line no-unreachable
  console.log('unreachable');
}
`);
});

const defaultPath = path.resolve(__dirname, 'examples', 'index.js');
function modifySource(source, options) {
	return codeMod(
		{
			source,
			path: defaultPath,
		},
		{ jscodeshift, j: jscodeshift, report: console.log },
		options || {}
	);
}
