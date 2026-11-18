import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, copyFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { locales, generatedLocaleSpecs } from './locale-config.mjs';
import { linkDirectory, linkFixtureDependencies } from './test-fixture-paths.mjs';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
test('ordered batches enforce their concurrency limit and preserve input order', async () => {
  const { orderedBatches } = await import('./ordered-batches.mjs');
  for (const size of [4, undefined]) {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 35 }, (_, index) => index);
    const output = [];
    for await (const [item, value] of orderedBatches(items, async item => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, (35 - item) % 4));
      active--;
      return item * 2;
    }, size)) output.push([item, value]);
    assert.equal(peak, size ?? 16);
    assert.deepEqual(output, items.map(item => [item, item * 2]));
  }
  for (const size of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(async () => {
      for await (const _ of orderedBatches([1], () => assert.fail('Invalid size must not start work'), size)) {}
    }, /positive integer/);
  }
});

test('syntax validation checks untracked files, skips ignored/deleted files and reports the first error', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-syntax-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await mkdir(path.join(root, 'fern'));
    for (const file of ['check-javascript.mjs', 'ordered-batches.mjs']) {
      await copyFile(new URL(file, import.meta.url), path.join(root, 'scripts', file));
    }
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(root, '.gitignore'), 'fern/ignored.mjs\n');
    await writeFile(path.join(root, 'fern/ignored.mjs'), 'const =;');
    await writeFile(path.join(root, 'fern/deleted.mjs'), 'const =;');
    for (const args of [['init', '-q'], ['add', 'fern/deleted.mjs']]) {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    await rm(path.join(root, 'fern/deleted.mjs'));
    await writeFile(path.join(root, 'fern/untracked file.mjs'), 'throw new Error("Must only parse");');
    const run = () => spawnSync(process.execPath, ['scripts/check-javascript.mjs'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /JavaScript syntax verified: 3 files/);
    for (const name of ['a-first.mjs', 'z-second.cjs']) await writeFile(path.join(root, 'fern', name), 'const =;');
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /a-first\.mjs/);
    assert.doesNotMatch(result.stderr, /z-second\.cjs/);
    assert.doesNotMatch(result.stdout, /verified/);
    await rm(path.join(root, 'fern/a-first.mjs'));
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /z-second\.cjs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('URL word corrections preserve permitted locales and protected Markdown syntax', async () => {
  const { polishMachineTranslation, findTranslationQualityIssues } = await import('./polish-core-translations.mjs');
  const file = 'docs/pages/example.mdx';
  const protectedText = '\n`URLétiquette`\n```js\nURL地址\n```\n[link](/URLالعربية) <a href="/URL𐐀">link</a> https://example.test/URLétiquette\n';
  const prose = 'URL guide; URLs; URL123; URLétiquette; URL地址; URLالعربية; URL𐐀';
  const content = prose + protectedText;
  for (const locale of ['ja', 'zh-CN', 'zh-TW']) {
    assert.equal(polishMachineTranslation(content, locale, file), content);
    assert.deepEqual(findTranslationQualityIssues(content, locale, file), []);
  }
  assert.equal(polishMachineTranslation(content, 'fr', file),
    'URL guide; URLs; URL123; URL étiquette; URL 地址; URL العربية; URL 𐐀' + protectedText);
  assert.deepEqual(findTranslationQualityIssues(content, 'fr', file),
    ['URLétiquette', 'URL地址', 'URLالعربية', 'URL𐐀'].map(token => `unexpected URL word join: ${token}`));
  for (const content of ['URL guide', 'URL123', 'URL_guide', 'urlword', 'URL\u0301']) {
    assert.equal(polishMachineTranslation(content, 'fr', file), content);
    assert.deepEqual(findTranslationQualityIssues(content, 'fr', file), []);
  }
});

test('support guide prefetch preserves validation order when later reads fail', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-support-order-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    for (const file of ['check-customer-support.mjs', 'documentation-pages.mjs']) {
      await copyFile(new URL(file, import.meta.url), path.join(root, 'scripts', file));
    }
    await linkFixtureDependencies(root);
    const config = parse(await readFile(new URL('../fern/docs.yml', import.meta.url), 'utf8'));
    config.translations = config.translations.filter(locale => locale.default || locale.lang === 'ja');
    const pages = config.navigation.find(item => item.tab === 'customerSupport').layout.flatMap(group => group.contents.map(page => page.path));
    for (const locale of config.translations) {
      const base = locale.default ? 'fern' : `fern/translations/${locale.lang}`;
      for (const file of [...pages, 'docs/pages/home.mdx', 'docs/pages/solutions/overview.mdx']) {
        const target = path.join(root, base, file);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(new URL(`../${base}/${file}`, import.meta.url), target);
      }
    }
    await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify(config));
    const first = path.join(root, 'fern/translations/ja', pages[0]);
    const second = path.join(root, 'fern/translations/ja', pages[1]);
    const firstBody = await readFile(first, 'utf8');
    const secondBody = await readFile(second, 'utf8');
    const run = () => spawnSync(process.execPath, ['scripts/check-customer-support.mjs'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    await writeFile(first, 'short');
    await rm(second);
    let result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ja: missing tenant guide content/);
    assert.doesNotMatch(result.stderr, /ENOENT|UnhandledPromiseRejection/);
    await writeFile(first, firstBody);
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ENOENT/);
    assert.ok(result.stderr.includes(second));
    await writeFile(second, secondBody);
    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Customer support docs verified/);

    const addedGuide = 'docs/pages/customer-support/new-guide.mdx';
    await writeFile(path.join(root, 'fern', addedGuide), await readFile(path.join(root, 'fern', pages[0]), 'utf8'));
    result = run();
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(addedGuide), result.stderr);
    assert.match(result.stderr, /missing from navigation/);
    const supportTab = config.navigation.find(item => item.tab === 'customerSupport');
    supportTab.layout[0].contents.push({ page: 'New guide', path: addedGuide });
    await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify(config));
    await writeFile(path.join(root, 'fern/translations/ja', addedGuide), firstBody);
    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`verified: ${pages.length + 1} pages`));
  } finally { await rm(root, { recursive: true, force: true }); }
});

const docsValidationAction = './.github/actions/validate-docs';

test('shared docs validation runs both gates and installs only the required browsers', async () => {
  const action = parse(await readFile(new URL(`../${docsValidationAction}/action.yml`, import.meta.url), 'utf8'));
  assert.equal(action.runs.using, 'composite');
  assert.equal(action.inputs['fern-token'].required, false);
  const [node, ...steps] = action.runs.steps;
  assert.match(node.uses, /^actions\/setup-node@/);
  const setup = node.with;
  assert.equal(setup['node-version'], 22);
  assert.equal(setup.cache, 'npm');
  assert.deepEqual(setup['cache-dependency-path'].trim().split(/\s+/), ['package-lock.json', 'tests/browser/package-lock.json']);
  assert.deepEqual(steps.map(step => step.run), [
    'npm ci',
    'npm run check',
    'npm ci --prefix tests/browser --ignore-scripts',
    'npm run install:browsers -- --with-deps --only-shell',
    'npm run browser:check',
  ]);
  assert.equal(steps[3]['working-directory'], 'tests/browser');
  assert.equal(steps[1].env.FERN_TOKEN, '${{ inputs.fern-token }}');
  for (const step of [node, ...steps]) {
    assert.equal(step.if, undefined);
    assert.ok(!step['continue-on-error']);
    if (step.run) assert.equal(step.shell, 'bash');
    if (step.run !== 'npm run check') assert.equal(step.env?.FERN_TOKEN, undefined);
  }
});

for (const [file, jobName] of [['docs-check.yml', 'validate'], ['docs-publish.yml', 'publish']]) {
  test(`${file} requires the shared validation action`, async () => {
    const workflow = parse(await readFile(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
    const job = workflow.jobs[jobName];
    const [checkout, validate, ...remaining] = job.steps;
    assert.match(checkout.uses, /^actions\/checkout@/);
    assert.equal(validate.uses, docsValidationAction);
    assert.equal(validate.with['fern-token'], '${{ secrets.FERN_TOKEN }}');
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    for (const step of [checkout, validate, ...remaining]) {
      assert.equal(step.if, undefined, 'A failed prerequisite must stop the job');
      assert.ok(!step['continue-on-error']);
    }
    assert.ok(!job['continue-on-error']);
    if (jobName === 'publish') {
      assert.equal(job.if, "github.ref == 'refs/heads/main'");
      assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].run, './node_modules/.bin/fern generate --docs --no-prompt');
      assert.equal(remaining[0].env.FERN_TOKEN, '${{ secrets.FERN_TOKEN }}');
    } else {
      assert.equal(remaining.length, 0);
      assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
      assert.deepEqual(workflow.on.push.branches, ['main']);
      assert.equal(job.if, undefined);
    }
  });
}

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-workflow-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await mkdir(path.join(root, 'node_modules/.bin'), { recursive: true });
    const probe = `import fs from 'node:fs';
const name=process.argv[1].split(/[\\\\/]/).pop();
fs.appendFileSync('events.jsonl',JSON.stringify({name,args:process.argv.slice(2)})+'\\n');
if(process.env.FAIL_STEP===name)process.exit(7);
`;
    for (const name of ['generate-translations.mjs', 'polish-core-translations.mjs', 'stabilize-heading-anchors.mjs', 'check.mjs']) {
      await writeFile(path.join(root, 'scripts', name), probe);
    }
    await writeFile(path.join(root, 'node_modules/.bin/fern'), '#!/usr/bin/env node\n' + probe.replace("import fs from 'node:fs';", "const fs=require('node:fs');"), { mode: 0o755 });
    if (process.platform === 'win32') {
      await writeFile(path.join(root, 'node_modules/.bin/fern.cmd'), '@node "%~dp0fern" %*\r\n');
    }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { ...pkg.scripts, check: 'node scripts/check.mjs' } }));
    await run((command, args = [], fail = '') => {
      // npm run provides its JS entry point, so no shell is needed for npm.cmd.
      const npm = process.env.npm_execpath;
      const npmCommand = npm ? process.execPath : 'npm';
      const npmArgs = npm ? [npm] : [];
      const result = spawnSync(npmCommand, [...npmArgs, 'run', command, '--', ...args], {
        cwd: root, encoding: 'utf8', env: { ...process.env, FAIL_STEP: fail, npm_config_ignore_scripts: 'false' }
      });
      return result;
    }, async () => (await readFile(path.join(root, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse));
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('translation arguments reach the generator, then anchors run without those arguments', async () => {
  await fixture(async (run, events) => {
    const result = run('translations:generate', ['--locales=ja', '--force']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await events(), [
      { name: 'generate-translations.mjs', args: ['--locales=ja', '--force'] },
      { name: 'stabilize-heading-anchors.mjs', args: [] }
    ]);
  });
});
test('failed translations stop before rewriting anchors', async () => {
  await fixture(async (run, events) => {
    assert.notEqual(run('translations:generate', [], 'generate-translations.mjs').status, 0);
    assert.equal((await events()).length, 1);
  });
});
test('publishing validates first and forwards Fern arguments', async () => {
  await fixture(async (run, events) => {
    const result = run('fern:publish', ['--no-prompt']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await events(), [
      { name: 'check.mjs', args: [] }, { name: 'fern', args: ['generate', '--docs', '--no-prompt'] }
    ]);
  });
});
test('failed validation prevents any publication', async () => {
  await fixture(async (run, events) => {
    assert.notEqual(run('fern:publish', ['--no-prompt'], 'check.mjs').status, 0);
    assert.deepEqual(await events(), [{ name: 'check.mjs', args: [] }]);
  });
});

for (const [args, message] of [
  [['--locales='], /At least one locale/],
  [['--locales=,,'], /At least one locale/],
  [['--locales=ja', '--locales=fr'], /Specify --locales once/],
  [['--locales', 'ja'], /Unknown argument/],
  [['--locale=ja'], /Unknown argument/],
  [['--force'], /Unknown argument/],
  [['--locales=unknown'], /Unknown locale/],
]) {
  test(`translation checks reject invalid scope: ${args.join(' ')}`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-translations.mjs', import.meta.url)), ...args], {
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stdout, /checks passed/);
  });
}

test('maintenance commands reject unsupported options before rewriting documents', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-maintenance-options-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    for (const name of ['stabilize-heading-anchors.mjs', 'repair-translation-links.mjs', 'polish-core-translations.mjs', 'locale-config.mjs', 'documentation-text.mjs', 'write-generated-file.mjs', 'ordered-batches.mjs']) {
      await copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name));
    }
    await linkFixtureDependencies(root);
    await mkdir(path.join(root, 'fern/docs/pages'), { recursive: true });
    const documentPath = path.join(root, 'fern/docs/pages/home.mdx');
    const original = '## Existing heading\n';
    await writeFile(documentPath, original);
    await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify({
      navigation: [{ path: 'docs/pages/home.mdx' }], translations: [{ default: true, lang: 'en' }],
    }));
    for (const [script, options] of [
      ['stabilize-heading-anchors.mjs', [['--chek'], ['--locales=ja'], ['--check', '--force']]],
      ['repair-translation-links.mjs', [['--check'], ['--locales=ja'], ['--force']]],
      ['polish-core-translations.mjs', [['--check'], ['--locales=ja'], ['--force']]],
    ]) {
      for (const args of options) {
        const result = spawnSync(process.execPath, [path.join('scripts', script), ...args], {
          cwd: root, encoding: 'utf8', timeout: 10_000,
        });
        assert.equal(result.status, 1, `${script}: ${result.stderr}`);
        assert.match(result.stderr, /Unknown argument/, `${script}: ${args.join(' ')}`);
        assert.equal(await readFile(documentPath, 'utf8'), original);
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('anchor validation preserves error order and avoids partial writes when a later locale is missing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-anchor-read-order-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    for (const name of ['stabilize-heading-anchors.mjs', 'write-generated-file.mjs']) {
      await copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name));
    }
    await linkFixtureDependencies(root);
    const relative = 'docs/pages/example.mdx';
    const source = path.join(root, 'fern', relative);
    const japanese = path.join(root, 'fern/translations/ja', relative);
    const french = path.join(root, 'fern/translations/fr', relative);
    for (const file of [source, japanese, french]) await mkdir(path.dirname(file), { recursive: true });
    await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify({
      navigation: [{ path: relative }],
      translations: [{ lang: 'en', default: true }, { lang: 'ja' }, { lang: 'fr' }],
    }));
    await writeFile(source, '## Heading\n');
    await writeFile(japanese, '## 見出し\n');
    const run = args => spawnSync(process.execPath, ['scripts/stabilize-heading-anchors.mjs', ...args], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
    });
    const check = run(['--check']);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /Non-native or unstable heading: en:docs\/pages\/example\.mdx/);
    const failedUpdate = run([]);
    assert.equal(failedUpdate.status, 1);
    assert.match(failedUpdate.stderr, /ENOENT/);
    assert.ok(failedUpdate.stderr.includes(french));
    assert.equal(await readFile(source, 'utf8'), '## Heading\n');
    assert.equal(await readFile(japanese, 'utf8'), '## 見出し\n');
    await writeFile(french, '## Titre\n');
    const update = run([]);
    assert.equal(update.status, 0, update.stderr);
    for (const file of [source, japanese, french]) {
      assert.match(await readFile(file, 'utf8'), /data-sixmm-canonical-anchor="heading"/);
    }
    const verified = run(['--check']);
    assert.equal(verified.status, 0, verified.stderr);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const failure of ['missing-source', 'missing-later-translation', 'multiple-missing-translations', 'missing-before-invalid-path', 'invalid-path', 'valid']) {
  test(`link repair handles ${failure} without partial or unstable output`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sixmm-links-preflight-'));
    try {
      await mkdir(path.join(root, 'scripts'));
      for (const name of ['repair-translation-links.mjs', 'stabilize-heading-anchors.mjs', 'locale-config.mjs', 'documentation-text.mjs', 'write-generated-file.mjs', 'ordered-batches.mjs']) {
        await copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name));
      }
      await linkFixtureDependencies(root);
      await mkdir(path.join(root, 'fern/docs/pages'), { recursive: true });
      const paths = ['docs/pages/first.mdx', 'docs/pages/second.mdx'];
      await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify({
        navigation: [{ layout: [{ contents: paths.map((path, index) => ({
          path: ['missing-before-invalid-path', 'invalid-path'].includes(failure) && index === 1 ? { invalid: true } : path,
        })) }] }],
        translations: [{ lang: 'en', default: true }, ...generatedLocaleSpecs.map(locale => ({ lang: locale.code }))],
      }));
      const originals = new Map();
      for (const directory of ['fern', ...generatedLocaleSpecs.map(locale => `fern/translations/${locale.code}`)]) {
        for (const [index, relative] of paths.entries()) {
          const file = path.join(root, directory, relative);
          await mkdir(path.dirname(file), { recursive: true });
          const content = `---\ntitle: Page ${index}\nslug: ${index ? 'second' : 'first'}\n---\n` +
            (directory === 'fern' && index === 0 ? '[Next](/second)\n' : 'Content\n');
          await writeFile(file, content);
          originals.set(file, content);
        }
      }
      const run = (script, args = []) => spawnSync(process.execPath, ['scripts/' + script, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
      if (failure === 'valid') {
        const result = run('repair-translation-links.mjs');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, new RegExp(`Updated files: ${generatedLocaleSpecs.length}\\.`));
        for (const locale of generatedLocaleSpecs) {
          const file = path.join(root, 'fern/translations', locale.code, paths[0]);
          let repaired = await readFile(file, 'utf8');
          assert.match(repaired, /data-sixmm-canonical-anchor="localized-page-links"/);
          assert.match(repaired, /\n## [^\n]+\n/);
          assert.doesNotMatch(repaired, /<h2|undefined/);
          assert.ok(repaired.includes(`(/${locale.code}/second)`));
          repaired = repaired.replace('[Page 1]', '[Reviewed label]');
          await writeFile(file, repaired);
          originals.set(file, repaired);
        }
        const anchors = run('stabilize-heading-anchors.mjs', ['--check']);
        assert.equal(anchors.status, 0, anchors.stderr);
        const repeat = run('repair-translation-links.mjs');
        assert.equal(repeat.status, 0, repeat.stderr);
        assert.match(repeat.stdout, /Updated files: 0\./);
        for (const [file, content] of originals) assert.equal(await readFile(file, 'utf8'), content, file);
        const changedFile = path.join(root, 'fern/translations/ja', paths[0]);
        await writeFile(changedFile, originals.get(changedFile).replace('(/ja/second)', '(/ja/obsolete)'));
        const corrected = run('repair-translation-links.mjs');
        assert.equal(corrected.status, 0, corrected.stderr);
        assert.match(corrected.stdout, /Updated files: 1\./);
        const correctedContent = await readFile(changedFile, 'utf8');
        assert.ok(correctedContent.includes('(/ja/second)'));
        assert.ok(!correctedContent.includes('(/ja/obsolete)'));
        return;
      }
      if (failure === 'invalid-path') {
        const result = run('repair-translation-links.mjs');
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /ERR_INVALID_ARG_TYPE/);
        for (const [file, content] of originals) assert.equal(await readFile(file, 'utf8'), content, file);
        return;
      }
      const missing = path.join(root, failure === 'missing-source' ? 'fern/docs/pages/second.mdx'
        : failure === 'missing-before-invalid-path' ? 'fern/translations/ja/docs/pages/first.mdx'
        : failure === 'multiple-missing-translations' ? 'fern/translations/ru/docs/pages/first.mdx'
        : 'fern/translations/ru/docs/pages/second.mdx');
      await rm(missing);
      originals.delete(missing);
      if (failure === 'multiple-missing-translations') {
        const laterMissing = path.join(root, 'fern/translations/ru/docs/pages/second.mdx');
        await rm(laterMissing);
        originals.delete(laterMissing);
      }
      const result = run('repair-translation-links.mjs');
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /ENOENT/);
      assert.ok(result.stderr.includes(missing), result.stderr);
      for (const [file, content] of originals) assert.equal(await readFile(file, 'utf8'), content, file);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

for (const failure of ['missing-direct-file', 'missing-locale', 'unreadable-local-files', null]) {
  const label = failure ? `${failure} leaves earlier documents unchanged` : 'applies page-specific rules to nested files';
  test(`polishing ${label}`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sixmm-polish-preflight-'));
    try {
      await mkdir(path.join(root, 'scripts'));
      for (const name of ['polish-core-translations.mjs', 'locale-config.mjs', 'write-generated-file.mjs', 'ordered-batches.mjs']) {
        await copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name));
      }
      for (const locale of locales.filter(item => !item.default)) {
        await mkdir(path.join(root, 'fern/translations', locale.code), { recursive: true });
      }
      const originals = new Map();
      for (const locale of ['ja', 'zh-TW']) {
        for (const relative of ['docs.yml', 'docs/pages/home.mdx']) {
          const file = path.join(root, 'fern/translations', locale, relative);
          await mkdir(path.dirname(file), { recursive: true });
          const content = relative === 'docs.yml' ? 'label: "SDKs"\n' : '---\ntitle: Example\n---\nAgent SDKs\n';
          await writeFile(file, content);
          originals.set(file, content);
        }
      }
      if (failure === 'missing-direct-file') {
        const file = path.join(root, 'fern/translations/zh-TW/docs/pages/home.mdx');
        await rm(file);
        originals.delete(file);
      } else if (failure === 'missing-locale') {
        await rm(path.join(root, 'fern/translations/ar'), { recursive: true });
      } else if (failure === 'unreadable-local-files') {
        for (const name of ['000-first.mdx', '001-second.mdx']) {
          const destination = path.join(root, 'fern/translations/ja', name);
          if (process.platform === 'win32') {
            await linkDirectory(path.join(root, `missing-${name}`), destination);
          } else {
            await symlink(`missing-${name}`, path.join(root, 'fern/translations/ja', name), 'file');
          }
        }
      }
      const orderPage = path.join(root, 'fern/translations/de/docs/pages/trading/order-types.mdx');
      if (!failure) {
        await mkdir(path.dirname(orderPage), { recursive: true });
        await writeFile(orderPage, 'Ordnungstypen\n');
      }
      const result = spawnSync(process.execPath, ['scripts/polish-core-translations.mjs'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
      if (!failure) {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(await readFile(orderPage, 'utf8'), 'Ordertypen\n');
        return;
      }
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /ENOENT/);
      if (failure === 'unreadable-local-files') {
        assert.ok(result.stderr.includes(path.join(root, 'fern/translations/ja/000-first.mdx')));
        assert.doesNotMatch(result.stderr, /UnhandledPromiseRejection/);
      }
      for (const [file, content] of originals) assert.equal(await readFile(file, 'utf8'), content, file);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('polishing recognizes path aliases while library imports stay read-only', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-polish-entry-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    for (const name of ['polish-core-translations.mjs', 'locale-config.mjs', 'write-generated-file.mjs', 'ordered-batches.mjs']) {
      await copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name));
    }
    const script = 'scripts/polish-core-translations.mjs';
    const alias = process.platform === 'win32' ? 'linked-scripts/polish-core-translations.mjs' : 'scripts/linked-polish.mjs';
    if (process.platform === 'win32') {
      await linkDirectory(path.join(root, 'scripts'), path.join(root, 'linked-scripts'));
    } else {
      await symlink('polish-core-translations.mjs', path.join(root, alias), 'file');
    }
    for (const entry of [
      [script],
      [path.join(root, script)],
      [alias],
      ['--preserve-symlinks-main', alias],
    ]) {
      const result = spawnSync(process.execPath, [...entry, '--check'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
      assert.equal(result.status, 1, `${entry.join(' ')}: ${result.stderr}`);
      assert.match(result.stderr, /Unknown argument/);
    }
    const consumer = 'import { polishMachineTranslation } from "./scripts/polish-core-translations.mjs"; console.log(typeof polishMachineTranslation);';
    await writeFile(path.join(root, 'consumer.mjs'), consumer);
    for (const args of [
      ['consumer.mjs', '--check'],
      ['--input-type=module', '--eval', consumer, '--', '--check'],
      ['--input-type=module', '-', '--check'],
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', input: consumer, timeout: 10_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'function');
    }
    const expected = ['consumer.mjs', 'scripts'];
    if (process.platform === 'win32') expected.splice(1, 0, 'linked-scripts');
    assert.deepEqual((await readdir(root)).sort(), expected);
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function previewFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm preview options-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    await mkdir(path.join(root, 'node_modules/fern-api'), { recursive: true });
    await copyFile(new URL('./preview-prediction.mjs', import.meta.url), path.join(root, 'scripts/preview-prediction.mjs'));
    const executable = path.join(root, 'node_modules/fern-api/cli.cjs');
    await writeFile(executable, `require('node:fs').writeFileSync('launch.json', JSON.stringify(process.argv.slice(2)));
if (process.env.SIXMM_PREVIEW_SIGNAL) process.kill(process.pid, process.env.SIXMM_PREVIEW_SIGNAL);
else process.exit(Number(process.env.SIXMM_PREVIEW_EXIT || 0));
`, { mode: 0o755 });
    await run(async (args = [], env = {}) => {
      await rm(path.join(root, 'launch.json'), { force: true });
      const result = spawnSync(process.execPath, ['scripts/preview-prediction.mjs', ...args], {
        cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 10_000,
      });
      const launch = await readFile(path.join(root, 'launch.json'), 'utf8').catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      return { ...result, launch: launch && JSON.parse(launch) };
    }, executable);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('preview preserves default, custom and repeated identical port settings', async () => {
  await previewFixture(async run => {
    for (const [args, port, backend] of [
      [[], 3010, 3011],
      [['--port=3012', '--backend-port=3013'], 3012, 3013],
      [['--port=1024', '--backend-port=65535'], 1024, 65535],
      [['--port=3012', '--port=3012'], 3012, 3011],
    ]) {
      const result = await run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.launch, ['docs', 'dev', '--port', String(port), '--backend-port', String(backend)]);
    }
  });
});
test('invalid preview options fail before starting Fern', async () => {
  await previewFixture(async run => {
    for (const args of [
      ['--port=3010=invalid'], ['--port=3012', '--port=3013'],
      ['--backend-port=3012', '--backend-port=3013'], ['--port', '3012'],
      ['--unknown'], ['--port=1023'], ['--backend-port=65536'],
      ['--port=3011'], ['--port=3012.5'], ['--port='],
    ]) {
      const result = await run(args);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Unknown argument|Invalid|Specify|ports must differ/);
      assert.equal(result.launch, null, args.join(' '));
    }
  });
});
test('preview propagates child failures and reports a missing Fern installation', async () => {
  await previewFixture(async (run, executable) => {
    assert.equal((await run([], { SIXMM_PREVIEW_EXIT: '7' })).status, 7);
    await rm(executable);
    const missing = await run();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Cannot find module/);
    assert.equal(missing.launch, null);
  });
});

test('preview reports POSIX signal termination', { skip: process.platform === 'win32' }, async () => {
  await previewFixture(async run => {
    for (const [signal, status] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGKILL', 137]]) {
      assert.equal((await run([], { SIXMM_PREVIEW_SIGNAL: signal })).status, status);
    }
  });
});

// Run the actual generator against a local provider stub. No network or
// repository documentation is touched, including when retries fail.
