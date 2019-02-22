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
    <div>
      {/* TODO: Fix this the next time the file is edited. */}
      {/* eslint-disable-next-line eqeqeq */}
      <div>{a == b}</div>
    </div>
  );
}`);
});

test('updates an existing comment in javascript', () => {
	const program = `export function foo(a, b) {
  // eslint-disable-next-line eqeqeq
  var bar = a == b;
}
`;

	expect(modifySource(program)).toBe(`export function foo(a, b) {
  // eslint-disable-next-line eqeqeq, no-unused-vars
  var bar = a == b;
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

// I discovered this edge case in testing, and it's sufficiently rare that I don't feel like
// *actually* handling it properly now; however, it should at least not crash.
test("doesn't crash on unusual markup", () => {
	const program = `export function Component({ a, b }) {
  return (
    <div>
      <div>
      </div>{a == b}
    </div>
  );
}`;

	expect(modifySource(program)).toBe(program);
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
    <div>
      {/* Something more informative */}
      {/* eslint-disable-next-line eqeqeq */}
      <div>{a == b}</div>
    </div>
  );
}`);
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
