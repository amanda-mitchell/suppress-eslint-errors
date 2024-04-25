const spawn = require('cross-spawn')
const path = require('node:path')

test('runs without errors', () => {
  const result = spawn.sync('node', [path.join(__dirname, '..', 'bin', 'index.js'), '-d', '.'], {
    stdio: 'inherit',
  })

  expect(result.status).toBe(0)
})
