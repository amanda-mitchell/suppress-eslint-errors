import { Biome, Distribution, type LintResult } from '@biomejs/js-api'
import { type API, type ASTPath, type FileInfo, Node, type Options } from 'jscodeshift'

type JAPI = Pick<API, 'j' | 'report'>
type Explanation = string | undefined

const defaultExplanation = 'TODO: Fix this the next time the file is edited.'

function biomeIgnoreStr(rule: string, explanation: Explanation) {
  const exp = explanation ?? defaultExplanation
  return `biome-ignore ${rule}:${exp ? ` ${exp}` : ''}`
}

function findLineNumber(source: string, startByte: number): number {
  const lines = source.split('\n')
  let currentByte = 0

  for (let i = 0; i < lines.length; i++) {
    const lineLength = Buffer.byteLength(lines[i], 'utf8')
    if (startByte >= currentByte && startByte < currentByte + lineLength) {
      return i + 1
    }

    currentByte += lineLength + 1
  }

  return -1
}

async function runBiome(source: string, filePath: string): Promise<LintResult> {
  const biome = await Biome.create({
    distribution: Distribution.NODE,
  })
  return biome.lintContent(source, { filePath })
}

export default async function transform(
  file: FileInfo,
  api: JAPI,
  options: Options,
): Promise<string | null | undefined> {
  const { j, report } = api
  const lintResult = await runBiome(file.source, file.path)

  const ruleIdWhitelist = (options.rules || '').split(',').filter((x: string) => x)
  const ruleIdWhitelistSet = ruleIdWhitelist.length ? new Set(ruleIdWhitelist) : null

  // remove duplicates by category and location span
  const uniqueDiagnosticList = [
    ...new Map(
      lintResult.diagnostics
        .filter((diagnostic) => diagnostic.category?.startsWith('lint/'))
        .filter((diagnostic) => {
          return ruleIdWhitelistSet === null || ruleIdWhitelistSet.has(diagnostic.category)
        })
        .map((diagnostic) => [diagnostic.location.span?.join(), diagnostic]),
    ).values(),
  ]

  if (uniqueDiagnosticList.length === 0) {
    return
  }

  const lineDiagnosticsMap = new Map<number, string[]>()
  for (const { location, category } of uniqueDiagnosticList) {
    if (!category) {
      continue
    }
    const targetLine = findLineNumber(file.source, location.span?.[0] ?? 0)
    lineDiagnosticsMap.set(targetLine, [...(lineDiagnosticsMap.get(targetLine) ?? []), category])
  }

  const result = j(file.source)

  const explanation: Explanation = options?.message

  lineDiagnosticsMap.forEach((rules, targetLine) => {
    const pathsStartingOnLine = result
      .find(Node, (node) => node.loc?.start.line === targetLine)
      .paths()

    const firstPathOnLine =
      pathsStartingOnLine.find((path) => path.node.loc?.end.line === targetLine) ||
      pathsStartingOnLine[0]

    if (!firstPathOnLine) {
      report(
        `Unable to find any nodes on line ${targetLine} of ${
          file.path
        }. Skipping suppression of ${rules.join(', ')}`,
      )

      return
    }

    addDisableComment(file.path, api, explanation, targetLine, rules, firstPathOnLine)
  })

  return result.toSource()
}

function addDisableComment(
  filePath: string,
  api: JAPI,
  explanation: Explanation,
  targetLine: number,
  rules: string[],
  path: ASTPath<Node>,
) {
  let targetPath = path
  while (
    targetPath.parent &&
    (!targetPath.parent.node.loc || targetPath.parent.node.loc.start.line === targetLine)
  ) {
    targetPath = targetPath.parent
  }

  if (
    targetPath.parent &&
    targetPath.parent.value.type === 'IfStatement' &&
    targetPath.parent.value.alternate === targetPath.value &&
    targetPath.parent.value.consequent.type === 'BlockStatement'
  ) {
    const ifStatement = targetPath.parent.value

    const { consequent } = ifStatement
    const consequentBody = consequent.body

    if (consequentBody.length === 0) {
      consequentBody.push(api.j.noop())
    }

    const lastStatement = consequentBody[consequentBody.length - 1]

    if (!lastStatement.comments) {
      lastStatement.comments = []
    }

    if (!lastStatement.trailingComments) {
      lastStatement.trailingComments = []
    }

    const newComments = rules.map((rule) =>
      createTrailingComment(api, ` ${biomeIgnoreStr(rule, explanation)}`),
    )

    lastStatement.comments.push(...newComments)
    lastStatement.trailingComments.push(...newComments)

    return
  }

  if (targetPath.node.type === 'JSXClosingElement') {
    const { children } = targetPath.parent.value

    for (const rule of rules) {
      children.push(createJsxComment(api, biomeIgnoreStr(rule, explanation)))
      children.push(api.j.jsxText('\n'))
    }

    return
  }

  if (targetPath.node.type === 'JSXAttribute') {
    for (const rule of rules) {
      createNormalComment(api, rule, explanation, targetPath.value)
    }

    return
  }

  if (targetPath.parent && targetPath.parent.node.type === 'JSXExpressionContainer') {
    for (const rule of rules) {
      createNormalComment(api, rule, explanation, targetPath.value)
    }

    return
  }

  if (targetPath.parent && targetPath.parent.node.type.substr(0, 3) === 'JSX') {
    if (!targetPath.parent.value.children) {
      api.report(
        `Skipping suppression of violation of ${rules.join(', ')} on ${targetLine} of ${filePath}`,
      )
      return
    }

    const { children } = targetPath.parent.value

    // jscodeshift has some bugs around how it handles JSXText nodes that can cause
    // it to swallow significant whitespace. Creating whitespace only nodes appears to
    // solve the issue.
    for (let siblingIndex = children.length - 1; siblingIndex >= 0; siblingIndex--) {
      const sibling = children[siblingIndex]

      if (sibling.type !== 'JSXText') {
        continue
      }

      if (sibling.value[0] === '\n' && sibling.value.trim().length === 0) {
        continue
      }

      const lines = sibling.value.split('\n')
      const segments = lines.flatMap((line: string, lineIndex: number) => {
        const result = []

        const trimmedLine = line.trimEnd()
        if (trimmedLine.length !== 0) {
          if (lineIndex === 0) {
            const startTrimmedLine = trimmedLine.trimStart()
            if (startTrimmedLine.length === line.length) {
              result.push(line)
            } else {
              if (startTrimmedLine.length < trimmedLine.length) {
                result.push(trimmedLine.substring(0, trimmedLine.length - startTrimmedLine.length))
              }

              result.push(startTrimmedLine)

              if (trimmedLine.length < line.length) {
                result.push(line.substring(trimmedLine.length))
              }
            }
          } else {
            if (trimmedLine.length === line.length) {
              result.push(line)
            } else {
              result.push(trimmedLine, line.substring(trimmedLine.length))
            }
          }
        }

        if (lineIndex !== lines.length - 1) {
          result.push('\n')
        }

        return result
      })

      children.splice(siblingIndex, 1, ...segments.map((segment: string) => api.j.jsxText(segment)))
    }

    let targetIndex = children.indexOf(targetPath.value)
    for (let siblingIndex = targetIndex - 1; siblingIndex >= 0; siblingIndex--) {
      const sibling = children[siblingIndex]
      if (sibling.type === 'JSXText') {
        if (sibling.value.indexOf('\n') !== -1) {
          break
        }

        targetIndex = siblingIndex
      } else if (sibling.loc) {
        if (sibling.loc.start.line !== targetLine) {
          break
        }

        targetIndex = siblingIndex
      }
    }

    const previousSibling = children[targetIndex - 1]

    if (previousSibling && previousSibling.type === 'JSXText') {
      const textValue = previousSibling.value
      const lastNewline = textValue.lastIndexOf('\n')
      if (
        lastNewline !== textValue.length - 1 &&
        textValue.substr(lastNewline + 1).trim().length === 0
      ) {
        previousSibling.value = textValue.substr(0, lastNewline)
        children.splice(targetIndex, 0, api.j.jsxText(textValue.substr(lastNewline)))
        targetIndex++
      }
    }

    children.splice(
      targetIndex,
      0,
      ...rules.flatMap((rule) => [
        createJsxComment(api, biomeIgnoreStr(rule, explanation)),
        api.j.jsxText('\n'),
      ]),
    )

    return
  }

  for (const rule of rules) {
    createNormalComment(api, rule, explanation, targetPath.value)
  }
}

function createNormalComment(
  api: JAPI,
  rule: string,
  explanation: string | undefined,
  targetNode: Node,
) {
  if (!targetNode.comments) {
    targetNode.comments = []
  }

  const newComments = [api.j.line(` ${biomeIgnoreStr(rule, explanation)}`)]

  targetNode.comments.push(...newComments)
}

// Using the builder methods to generate a jsx comment expression
// results in newlines in weird places. Parsing the exact strings that
// we want, however, produces the desired output.
function createJsxComment(api: JAPI, text: string): string {
  // The <element> around the curly braces causes this to be parsed as a JSXExpressionContainer
  // instead of as a BlockExpression.
  const expressionContainer = api.j('<element>{/* a comment */}</element>').paths()[0].value.program
    .body[0].expression.children[0]

  expressionContainer.expression.innerComments[0].value = ` ${text} `

  return expressionContainer
}

// Using the builder methods to generate trailing comments results
// in comments without preceding newlines. However, parsing a small
// module containing a trailing comment with a preceding newline will
// generate a node with the necessary properties.
function createTrailingComment(api: JAPI, text: string): string {
  const comment = api
    .j(
      `statement();
// trailing comment`,
    )
    .paths()[0].value.program.body[0].comments[0]

  comment.value = text

  return comment
}
