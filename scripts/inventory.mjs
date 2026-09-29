import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hash = value => createHash('sha256').update(value).digest('hex');
const decode = value => value.replace(/&amp;/g, '&');
const http = value => /^https?:\/\//.test(value);

export async function discover(repo, includeDetails = true) {
  repo = resolve(repo);
  const ts = createRequire(join(repo, 'package.json'))('typescript');
  const files = new Map();
  async function read(path) {
    const text = await readFile(join(repo, path), 'utf8');
    files.set(path.replaceAll('\\', '/'), hash(text));
    return text;
  }
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return decode(node.text);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
      if (!ts.isPropertyAssignment(p)) throw new Error('Unsupported config property');
      return [p.name.text, literal(p.initializer)];
    }));
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
    throw new Error(`Config expression needs review: ${node.getText()}`);
  }
  const sources = [], endpointCandidates = [];
  const registeredFiles = new Set();
  for (const [registry, type] of [['crawlers/run.ts', 'job'], ['crawlers/run-experience.ts', 'experience']]) {
    const text = await read(registry);
    const ast = ts.createSourceFile(registry, text, ts.ScriptTarget.Latest, true);
    const imports = new Map();
    for (const statement of ast.statements) {
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings)) {
        imports.set(statement.importClause.namedBindings.name.text, statement.moduleSpecifier.text);
      }
    }
    let registered;
    function findSites(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText() === 'sites') registered = node.initializer;
      ts.forEachChild(node, findSites);
    }
    findSites(ast);
    if (!registered) throw new Error(`Registry 'sites' not found: ${registry}`);
    const modules = new Set();
    function findModules(node) {
      if (ts.isPropertyAccessExpression(node) && ['config', 'configs'].includes(node.name.text) && ts.isIdentifier(node.expression)) modules.add(node.expression.text);
      ts.forEachChild(node, findModules);
    }
    findModules(registered);
    for (const module of modules) {
      const specifier = imports.get(module);
      if (!specifier) throw new Error(`Unresolved source module: ${module}`);
      let path = resolve(repo, dirname(registry), specifier).replace(/\.(js|ts)$/, '') + '.ts';
      path = relative(repo, path).replaceAll('\\', '/');
      if (path.startsWith('../') || isAbsolute(path)) throw new Error('Source escaped repository');
      const moduleText = await read(path);
      const moduleAst = ts.createSourceFile(path, moduleText, ts.ScriptTarget.Latest, true);
      let configs;
      function findConfig(node) {
        if (ts.isVariableDeclaration(node) && ['config', 'configs'].includes(node.name.getText())) {
          const value = literal(node.initializer);
          configs = Array.isArray(value) ? value : [value];
        }
        ts.forEachChild(node, findConfig);
      }
      findConfig(moduleAst);
      if (!configs?.length) throw new Error(`No source configs: ${path}`);
      for (const config of configs) {
        if (!config.id || !config.name || !http(config.url)) throw new Error(`Invalid config: ${path}`);
        sources.push({ ...config, type, module: path });
      }
      registeredFiles.add(path);
    }
  }
  if (new Set(sources.map(s => s.id)).size !== sources.length) throw new Error('Duplicate source IDs');
  for (const path of [...registeredFiles, 'crawlers/experience-urls.ts']) {
    const text = await read(path);
    const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    function collect(node) {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && http(node.text)) {
        endpointCandidates.push({ value: decode(node.text), kind: 'literal', file: path, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      } else if (ts.isTemplateExpression(node) && http(node.head.text)) {
        endpointCandidates.push({ value: node.getText(ast).slice(1, -1), kind: 'template', file: path, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
      ts.forEachChild(node, collect);
    }
    collect(ast);
  }
  const urlFileEntries = (await read('url.txt')).split(/\r?\n/).map(l => decode(l.trim())).filter(Boolean);
  if (urlFileEntries.some(u => !http(u))) throw new Error('Non-URL entry in url.txt');
  for (const path of ['noise-keywords.txt', 'data/learned-exclusions.json', 'crawlers/types.ts', 'crawlers/base.ts', 'crawlers/opportunity.ts', 'crawlers/resilience.ts', 'crawlers/schedule.ts', 'web/model.js', 'web/exclusions.js', 'data/experience-sources.json']) await read(path);
  const knownDetails = [];
  if (includeDetails) for (const name of ['crawlers/results.json', 'crawlers/experience-results.json']) {
    let data;
    try { data = JSON.parse(await readFile(join(repo, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!Array.isArray(data)) throw new Error(`Invalid runtime source data: ${name}`);
    for (const result of data) for (const p of result.postings) {
      for (const [kind, value] of [['detail', p.url], ['form-action', p.sourceForm?.action], ...(p.informationLinks || []).map(l => ['information-link', l.url])]) {
        if (value && http(value)) knownDetails.push({ siteId: result.site.id, kind, url: value, postingId: p.postingId || null });
      }
    }
  }
  const inputs = Object.fromEntries([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const unique = rows => [...new Map(rows.map(r => [JSON.stringify(r), r])).values()];
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), fingerprint: hash(JSON.stringify(inputs)), inputs,
    counts: { job: sources.filter(s => s.type === 'job').length, experience: sources.filter(s => s.type === 'experience').length, urlFileEntries: urlFileEntries.length },
    sources, urlFileEntries, endpointCandidates: unique(endpointCandidates), knownDetails: unique(knownDetails) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repo, output, flag] = process.argv.slice(2);
  if (!repo || !output || (flag && flag !== '--no-details')) throw new Error('Usage: node inventory.mjs <repo> <new-output.json> [--no-details]');
  const inventory = await discover(repo, flag !== '--no-details');
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(inventory, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ counts: inventory.counts, endpointCandidates: inventory.endpointCandidates.length, knownDetails: inventory.knownDetails.length, output: resolve(output) }));
}
