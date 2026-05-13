# suppress-eslint-errors

![Release](https://github.com/amanda-mitchell/suppress-eslint-errors/workflows/Release/badge.svg)

你是否曾经尝试启用一个新的 eslint 规则，却被现有代码库中成百上千的错误所困扰？

我们也一样。

有时候，没有很好的业务理由去更新所有现有的（能正常工作的！）代码，特别是在较大的、遗留的代码库中。

对于这些情况，`suppress-eslint-errors` 可以帮到你。

## 工作原理

`suppress-eslint-errors` 是一个用于 [jscodeshift](https://github.com/facebook/jscodeshift) 的代码转换工具，它会对你的现有代码运行 eslint。

对于它找到的每个 eslint 错误，它会添加一个小片段：

```javascript
// TODO: Fix this the next time the file is edited.
// eslint-disable-next-line cool-new-rule
```

这样，你就可以在新代码中获得规则的好处，而不需要立即处理大量的历史遗留问题。

## 使用方法

`suppress-eslint-errors` 附带一个包装脚本，你可以直接调用它而无需安装任何额外的东西：

```bash
npx suppress-eslint-errors [jscodeshift options] PATH...
```

包装脚本会调用 `jscodeshift` 并使用转换器以及你传递的任何其他参数。

如果它在本地目录中检测到 `.gitignore`，它还会将其指定为 `--ignore-config`。

`suppress-eslint-errors` 必须与本地安装的 `eslint` 一起使用。

如果找不到，它会提前退出。

_注意：_ `jscodeshift` 在处理某些文件方面有一些错误。如果遇到问题，请尝试将文件拆分为更小的单元。

## 示例

### 基本用法

```bash
# 对 src 目录运行
npx suppress-eslint-errors src/

# 对特定文件运行
npx suppress-eslint-errors src/index.js src/utils.js

# 使用自定义 eslint 配置
npx suppress-eslint-errors --eslint-config .eslintrc.js src/
```

### 高级用法

```bash
# 排除某些文件
npx suppress-eslint-errors --ignore-pattern "**/node_modules/**" src/

# 干运行（不修改文件）
npx suppress-eslint-errors --dry src/

# 指定 eslint 规则
npx suppress-eslint-errors --rules '{"no-console": "error"}' src/
```

## 配置

### .eslintrc.js

确保你的 eslint 配置文件存在：

```javascript
module.exports = {
  rules: {
    'no-console': 'error',
    'no-unused-vars': 'error',
    // ... 其他规则
  },
};
```

### package.json

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "suppress-errors": "suppress-eslint-errors src/"
  }
}
```

## 工作流程

1. **启用新规则**：在 eslint 配置中添加新规则
2. **运行工具**：`npx suppress-eslint-errors src/`
3. **审查更改**：检查生成的 `eslint-disable` 注释
4. **提交代码**：将更改提交到版本控制
5. **逐步修复**：随着时间的推移，逐个修复被抑制的错误

## 注意事项

- 这个工具不会修复错误，只是抑制它们
- 生成的 `TODO` 注释可以帮助你跟踪需要修复的代码
- 建议定期审查和修复被抑制的错误
- 不要在新代码中使用这个工具，只用于遗留代码

## 许可证

MIT

---

> 项目地址：[amanda-mitchell/suppress-eslint-errors](https://github.com/amanda-mitchell/suppress-eslint-errors)
> npm 包：[suppress-eslint-errors](https://www.npmjs.com/package/suppress-eslint-errors)
