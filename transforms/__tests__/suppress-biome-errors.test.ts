import * as path from 'node:path'
import { expect, test } from '@jest/globals'
import jscodeshift from 'jscodeshift'
import type { Options } from 'jscodeshift'
import transform from '../suppress-biome-errors'

test('inserts a new comment in javascript', async () => {
  const program = `export function foo(a, b) {
 return a == b;
}
`

  await expect(modifySource(program)).resolves.toBe(`export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 return a == b;
}
`)
})

test('inserts a new comment with empty message in javascript', async () => {
  const program = `export function foo(a, b) {
 return a == b;
}
`

  await expect(modifySource(program, { message: '' })).resolves.toBe(`export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals:
 return a == b;
}
`)
})

test("doesn't update unnecessarily", async () => {
  const program = `export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 return a == b;
}
`

  await expect(modifySource(program)).resolves.toBe(undefined)
})

test('inserts a new comment in jsx', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     <div>{a == b}</div>
   </div>
 );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
     <div>{a == b}</div>
   </div>)
 );
}`)
})

test('inserts a new comment with empty message in jsx', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     <div>{a == b}</div>
   </div>
 );
}`

  await expect(modifySource(program, { message: '' })).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: */}
     <div>{a == b}</div>
   </div>)
 );
}`)
})

test('insert a new comment below an existing comment in javascript', async () => {
  const program = `export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 var bar = a == b;
}
`

  await expect(modifySource(program)).resolves.toBe(`export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 // biome-ignore lint/style/noVar: TODO: Fix this the next time the file is edited.
 var bar = a == b;
}
`)
})

test('insert a new comment below an existing comment in jsx', async () => {
  const program = `export function Component({ a }) {
 return (
   <div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: */}
     <div>{c = c}{b == c}</div>
   </div>
 );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a }) {
 return (
   (<div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: */}
     {/* biome-ignore lint/suspicious/noAssignInExpressions: TODO: Fix this the next time the file is edited. */}
     {/* biome-ignore lint/correctness/noSelfAssign: TODO: Fix this the next time the file is edited. */}
     <div>{c = c}{b == c}</div>
   </div>)
 );
}`)
})

test('inserts comments above a closing tag', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     <div>
     </div>{a == b}
   </div>
 );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     <div>
       {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
     </div>{a == b}
   </div>)
 );
}`)
})

test('supports adding comments to JSX attributes', async () => {
  const program = `export function Component({ a, b }) {
   return (
     <div
       prop={a == b ? a : b}>
     </div>
   );
 }`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
   return (
     (<div
       // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
       prop={a == b ? a : b}>
     </div>)
   );
 }`)
})

test('supports adding comments to JSX attributes containing markup', async () => {
  const program = `export function Component({ a, b }) {
   return (
     <div
       prop={
         <div prop={a == b ? a : b} />
       }>
     </div>
   );
 }`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
   return (
     (<div
       prop={
         // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
         <div prop={a == b ? a : b} />
       }>
     </div>)
   );
 }`)
})

test('supports alternative messages in javascript', async () => {
  const program = `export function foo(a, b) {
 return a == b;
}
`

  await expect(modifySource(program, { message: 'Something more informative' })).resolves.toBe(`export function foo(a, b) {
 // biome-ignore lint/suspicious/noDoubleEquals: Something more informative
 return a == b;
}
`)
})

test('supports alternative messages in jsx', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     <div>{a == b}</div>
   </div>
 );
}`

  await expect(modifySource(program, { message: 'Something more informative' })).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: Something more informative */}
     <div>{a == b}</div>
   </div>)
 );
}`)
})

test('supports rule whitelist in javascript', async () => {
  const program = `export function foo(a, b) {
 return a == b;
 console.log('unreachable');
}
`

  await expect(modifySource(program, { rules: 'lint/correctness/noUnreachable' })).resolves.toBe(`export function foo(a, b) {
 return a == b;
 // biome-ignore lint/correctness/noUnreachable: TODO: Fix this the next time the file is edited.
 console.log('unreachable');
}
`)
})

// TODO: check biome warning.
//test('skips eslint warnings', async () => {
//  const program = `export function fn(a) {
//  a()
//}`
//
//  await expect(modifySource(program)).resolves.toBe(undefined)
//})

test('skips files that eslint cannot parse', async () => {
  const program = 'not actually javascript'

  await expect(modifySource(program)).resolves.toBe(undefined)
})

test('does not split JSX lines containing multiple nodes', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     Some text <span>{a == b}</span>.
   </div>
 );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
     Some text <span>{a == b}</span>.
   </div>)
 );
}`)
})

test('handles trailing text on the previous line', async () => {
  const program = `export function Component({ a, b }) {
 return (
   <div>
     <div />Some text
     <span>{a == b}</span>.
   </div>
 );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
 return (
   (<div>
     <div />Some text
     {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
     <span>{a == b}</span>.
   </div>)
 );
}`)
})

test('preserves significant trailing whitespace in jsx text nodes', async () => {
  const program = `export function Component({ a, b }) {
return (
  <div>
    Some text <span>next to a span</span>
    <span onClick={() => a == b}>hi</span>.
  </div>
);
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
return (
  (<div>
    Some text <span>next to a span</span>
    {/* biome-ignore lint/a11y/useKeyWithClickEvents: TODO: Fix this the next time the file is edited. */}
    {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
    <span onClick={() => a == b}>hi</span>.
  </div>)
);
}`)
})

test('preserves significant leading whitespace in jsx text nodes', async () => {
  const program = `export function Component({ a, b }) {
  return (
    <div>
      <span>A span</span> next to some text
      <span onClick={() => a === b}>hi</span>.
    </div>
  );
}`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
  return (
    (<div>
      <span>A span</span> next to some text
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: TODO: Fix this the next time the file is edited. */}
      <span onClick={() => a === b}>hi</span>.
    </div>)
  );
}`)
})

test('preserves significant leading whitespace in jsx text nodes when multiple comment', async () => {
  const program = `export function Component({ a, b }) {
   return (
     <div>
       <span>A span</span> next to some text
       <span onClick={() => a == b}>hi</span>.
     </div>
   );
 }`

  await expect(modifySource(program)).resolves.toBe(`export function Component({ a, b }) {
   return (
     (<div>
       <span>A span</span> next to some text
       {/* biome-ignore lint/a11y/useKeyWithClickEvents: TODO: Fix this the next time the file is edited. */}
       {/* biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited. */}
       <span onClick={() => a == b}>hi</span>.
     </div>)
   );
 }`)
})

test('does not split if from preceding else', async () => {
  const program = `export function foo(a, b) {
 if (a === b) {
   return a;
 } else if (a == b) {
   return b;
 }

 return null;
}`

  await expect(modifySource(program)).resolves.toBe(`export function foo(a, b) {
 if (a === b) {
   return a;
   // biome-ignore lint/style/noUselessElse: TODO: Fix this the next time the file is edited.
   // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 } else if (a == b) {
   return b;
 }

 return null;
}`)
})

test('correctly handles empty blocks with multiple violations in else if conditions', async () => {
  const program = `export function foo(a, b) {
 if (a === b) {
 } else if (a == c) {
   return b;
 }

 return null;
}`

  await expect(modifySource(program)).resolves.toBe(`export function foo(a, b) {
 if (a === b) {

  // biome-ignore lint/suspicious/noDoubleEquals: TODO: Fix this the next time the file is edited.
 } else if (a == c) {
   return b;
 }

 return null;
}`)
})

const defaultPath = path.resolve(__dirname, 'examples', 'index.js')

async function modifySource(source: string, options?: Options) {
  const transformOptions = { ...options }
  if (transformOptions.baseConfig) {
    transformOptions.baseConfig = JSON.stringify(transformOptions.baseConfig)
  }

  const result = await transform(
    {
      source,
      path: defaultPath,
    },
    { j: jscodeshift, report: console.log },
    transformOptions,
  )

  return result ? result.replace(/\r\n/g, '\n') : result
}
