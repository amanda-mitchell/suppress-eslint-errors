const spawn = require('cross-spawn')
const path = require('node:path')

test('runs without errors', () => {
  const result = spawn.sync(
    'node',
    [
      path.join(__dirname, '..', 'bin', 'index.mjs'),
      '-d',
      '--extensions=js,ts',
      '--parser=ts',
      './',
    ],
    {
      stdio: 'inherit',
    },
  )

  expect(result.status).toBe(0)
})
