import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, copyFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { generatorVersion } from './locale-config.mjs';

async function translationRequestFixture(scenario, label, manifestState, extraArgs = [], cachedPageState, sourceBody = 'Example content.\n') {
  const root = await mkdtemp(path.join(tmpdir(), 'sixmm-translation-request-'));
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const manifestContent = manifestState?.content ?? '{';
  try {
    await mkdir(path.join(root, 'scripts'));
    // Copy the generator's modules, not unrelated maintenance scripts or tests.
    // Real copies keep import.meta.url rooted in this disposable workspace.
    for (const name of ['generate-translations.mjs', 'locale-config.mjs', 'polish-core-translations.mjs', 'translation-text.mjs', 'write-generated-file.mjs', 'ordered-batches.mjs']) {
      await copyFile(path.join(projectRoot, 'scripts', name), path.join(root, 'scripts', name));
    }
    await symlink(path.join(projectRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    await mkdir(path.join(root, 'fern'));
    await writeFile(path.join(root, 'fern/docs.yml'), JSON.stringify({
      tabs: { home: { 'display-name': label } },
      navigation: [{ tab: 'home', layout: [{ section: label, contents:
        Array.from({ length: 158 }, (_, i) => ({ page: label, path: `docs/pages/page-${i}.mdx` }))
      }] }]
    }));
    if (manifestState) {
      const manifest = path.join(root, 'fern/translations/.translation-manifest.json');
      await mkdir(path.dirname(manifest), { recursive: true });
      if (manifestState === 'directory') await mkdir(manifest);
      else await writeFile(manifest, manifestContent);
    }
    const cachedPages = new Map();
    if (cachedPageState) {
      const pages = {};
      await mkdir(path.join(root, 'fern/docs/pages'), { recursive: true });
      await mkdir(path.join(root, 'fern/translations/ja/docs/pages'), { recursive: true });
      for (let i = 0; i < 158; i++) {
        const relative = `docs/pages/page-${i}.mdx`;
        const source = `---\ntitle: Example\nslug: page-${i}\n---\n\n${sourceBody}`;
        const sourcePath = path.join(root, 'fern', relative);
        if (i === 157 && cachedPageState === 'source-directory') await mkdir(sourcePath);
        else if (!(i === 157 && cachedPageState === 'source-missing')) await writeFile(sourcePath, source);
        pages[relative] = createHash('sha256').update(`${generatorVersion}\0ja\0ja\0${source}`).digest('hex');
        const destination = path.join(root, 'fern/translations/ja', relative);
        if (i === 0 && cachedPageState === 'missing') continue;
        if (i === 0 && cachedPageState === 'directory') { await mkdir(destination); continue; }
        const edited = `Preserved manually reviewed translation ${i}\n`;
        await writeFile(destination, edited);
        cachedPages.set(destination, edited);
      }
      await writeFile(path.join(root, 'fern/translations/.translation-manifest.json'),
        JSON.stringify({ version: generatorVersion, locales: { ja: { pages } } }));
    }
    const originalManifest = cachedPageState
      ? await readFile(path.join(root, 'fern/translations/.translation-manifest.json'), 'utf8') : null;
    if (scenario.startsWith('navigation-')) {
      await writeFile(path.join(root, 'fern/translations/ja/docs.yml'), 'Preserved navigation\n');
    }
    const preload = path.join(root, 'mock-provider.cjs');
    await writeFile(preload, `const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const nativeWrite = fsPromises.writeFile;
const nativeRename = fsPromises.rename;
const mode = process.env.SIXMM_TRANSLATION_CASE;
function outputFailure(file, operation) {
  return (mode === 'page-' + operation + '-failure' && String(file).endsWith('page-0.mdx')) ||
    (mode === 'navigation-' + operation + '-failure' && String(file).endsWith('docs.yml'));
}
fsPromises.writeFile = async (file, content, ...args) => {
  if (outputFailure(file, 'write')) {
    await nativeWrite(file, content.slice(0, 10), ...args);
    throw Object.assign(new Error('Simulated partial output write'), { code: 'EIO' });
  }
  if (process.env.SIXMM_TRANSLATION_CASE === 'manifest-write-failure' && String(file).includes('.translation-manifest')) {
    await nativeWrite(file, content.slice(0, 10), ...args);
    throw Object.assign(new Error('Simulated partial manifest write'), { code: 'EIO' });
  }
  return nativeWrite(file, content, ...args);
};
fsPromises.rename = async (source, destination) => {
  if (outputFailure(destination, 'rename')) {
    throw Object.assign(new Error('Simulated output rename failure'), { code: 'EACCES' });
  }
  if (process.env.SIXMM_TRANSLATION_CASE === 'manifest-rename-failure' && String(destination).endsWith('.translation-manifest.json')) {
    throw Object.assign(new Error('Simulated manifest rename failure'), { code: 'EACCES' });
  }
  return nativeRename(source, destination);
};
require('node:module').syncBuiltinESMExports();
let calls = 0, authCalls = 0;
Date.now = () => 1000000 + calls * 1000;
globalThis.setTimeout = fn => { queueMicrotask(fn); return 0; };
globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.hostname === 'edge.microsoft.com') {
    fs.appendFileSync('auth-requests.jsonl', 'auth\\n');
    authCalls++;
    if (mode === 'edge-auth-forbidden') return { ok: false, status: 403 };
    if (mode === 'edge-refresh-transient' && authCalls === 2) return { ok: false, status: 503 };
    return { ok: true, text: async () => 'fixture-token' };
  }
  const edge = url.hostname === 'api-edge.cognitive.microsofttranslator.com';
  if (!edge && url.hostname !== 'clients5.google.com') throw new Error('Unexpected network request');
  const texts = edge ? JSON.parse(options.body).map(item => item.Text) : url.searchParams.getAll('q');
  fs.appendFileSync('requests.jsonl', JSON.stringify(texts) + '\\n');
  if (++calls > 20) {
    const error = new Error('Fixture request budget exhausted');
    error.status = 400;
    throw error;
  }
  const http = mode.match(/^edge-http-(\\d+)(-once)?$/);
  if (http && (!http[2] || calls === 1)) return { ok: false, status: Number(http[1]) };
  if (mode === 'edge-refresh-transient' && calls === 1) return { ok: false, status: 401 };
  if (mode === 'multi-missing') {
    const requestNumber = calls;
    fs.appendFileSync('request-events.jsonl', JSON.stringify(['start', requestNumber]) + '\\n');
    return { ok: true, json: async () => {
      await new Promise(resolve => setImmediate(resolve));
      fs.appendFileSync('request-events.jsonl', JSON.stringify(['finish', requestNumber]) + '\\n');
      return texts.map(text => requestNumber === 2 ? text.replace(/\\[\\[\\[ph\\d+\\]\\]\\]/g, '') : text);
    } };
  }
  return { ok: true, json: async () => texts.map(text => {
    const mode = process.env.SIXMM_TRANSLATION_CASE;
    if (edge) {
      if (mode === 'edge-missing-text' || (mode === 'edge-transient' && calls === 1)) return { translations: [{}] };
      if (mode === 'edge-null-item') return null;
      if (mode === 'edge-number-text') return { translations: [{ text: 123 }] };
      if (mode === 'edge-empty-text') return { translations: [{ text: '   ' }] };
      if (mode === 'edge-missing-placeholder') text = text.replace(/<span[^>]*>ph\\d+<\\/span>/g, '');
      if (mode === 'edge-extra-placeholder') text += ' <span class="notranslate">ph999999</span>';
      return { translations: [{ text }] };
    }
    if (mode === 'empty-text') return '   ';
    if (mode === 'poison' || (mode === 'transient' && calls === 1)) return text + ' [[[ph999999]]]';
    if (mode === 'missing' && calls === 1) return text.replace(/\\[\\[\\[ph\\d+\\]\\]\\]/g, '');
    return text;
  }) };
};
`);
    const localeArgs = extraArgs.some(argument => argument.startsWith('--locales=')) ? [] : ['--locales=ja'];
    const result = spawnSync(process.execPath, ['--require', preload,
      'scripts/generate-translations.mjs', ...(cachedPageState ? [] : ['--labels-only']), ...localeArgs, ...extraArgs], {
      cwd: root, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, DOCS_TRANSLATION_PROVIDER: scenario.startsWith('edge-') ? 'edge' : 'google', SIXMM_TRANSLATION_CASE: scenario }
    });
    assert.equal(result.signal, null, result.error?.message);
    const log = await readFile(path.join(root, 'requests.jsonl'), 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    });
    const requests = log.trim() ? log.trim().split('\n') : [];
    const requestEvents = (await readFile(path.join(root, 'request-events.jsonl'), 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    })).split('\n').filter(Boolean).map(JSON.parse);
    const authRequests = (await readFile(path.join(root, 'auth-requests.jsonl'), 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    })).split('\n').filter(Boolean).length;
    const output = await readFile(path.join(root, 'fern/translations/ja/docs.yml'), 'utf8').catch(() => null);
    if (manifestState && manifestState !== 'directory') {
      assert.equal(await readFile(path.join(root, 'fern/translations/.translation-manifest.json'), 'utf8'), manifestContent);
    }
    for (const [file, content] of cachedPages) {
      assert.equal(await readFile(file, 'utf8'), content, 'Existing translations must remain untouched');
    }
    const recoveredPage = cachedPageState === 'missing'
      ? await readFile(path.join(root, 'fern/translations/ja/docs/pages/page-0.mdx'), 'utf8').catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      }) : null;
    const preservedManifest = cachedPageState
      ? (await readFile(path.join(root, 'fern/translations/.translation-manifest.json'), 'utf8')) === originalManifest : null;
    const temporaryWrites = cachedPageState
      ? (await Promise.all(['', 'ja', 'ja/docs/pages'].map(directory => readdir(path.join(root, 'fern/translations', directory)))))
        .flat().filter(name => name.startsWith('.translation-manifest-') || name.startsWith('.translation-write-')) : [];
    return { ...result, requests, requestEvents, authRequests, output, recoveredPage, preservedManifest, temporaryWrites };
  } finally { await rm(root, { recursive: true, force: true }); }
}

for (const state of ['source-missing', 'source-directory', 'missing', 'directory']) {
  test(`manifest refresh preserves the cache when input is ${state}`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, ['--refresh-manifest'], state);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, state.includes('directory') ? /EISDIR/ : /ENOENT/);
    assert.equal(result.requests.length, 0);
    assert.equal(result.output, null);
    assert.equal(result.preservedManifest, true);
    assert.deepEqual(result.temporaryWrites, []);
  });
}

test('multiple placeholder repairs finish in order without overlapping provider requests', async () => {
  const body = 'First SDK\nSecond API\n';
  const result = await translationRequestFixture('multi-missing', 'Example', undefined, [], 'missing', body);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 4);
  assert.ok(result.recoveredPage?.endsWith(body));
  assert.deepEqual(result.requestEvents, [1, 2, 3, 4].flatMap(id => [['start', id], ['finish', id]]));
});

for (const [scenario, requests, authRequests] of [
  ['edge-http-400', 1, 1], ['edge-http-403', 1, 1], ['edge-http-404', 1, 1],
  ['edge-http-408', 8, 1], ['edge-http-429', 20, 1], ['edge-http-503', 8, 1], ['edge-http-401', 8, 8],
  ['edge-auth-forbidden', 0, 1],
]) {
  test(`${scenario} stops at the appropriate retry limit without writing`, async () => {
    const result = await translationRequestFixture(scenario, 'Example');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, requests);
    assert.equal(result.authRequests, authRequests);
    assert.equal(result.output, null);
    assert.match(result.stderr, /returned HTTP/);
  });
}
for (const [scenario, authRequests] of [['edge-http-401-once', 2], ['edge-refresh-transient', 3]]) {
  test(`${scenario} recovers through the bounded token refresh flow`, async () => {
    const result = await translationRequestFixture(scenario, 'SDK Example');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.requests.length, 2);
    assert.equal(result.authRequests, authRequests);
    assert.ok(result.output?.includes('display-name: "SDK Example"'));
  });
}

for (const scenario of ['edge-missing-text', 'edge-null-item', 'edge-number-text', 'edge-empty-text', 'edge-missing-placeholder', 'edge-extra-placeholder', 'empty-text']) {
  test(`${scenario} exhausts retries without writing incomplete translations`, async () => {
    const result = await translationRequestFixture(scenario, 'SDK Example');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, scenario.startsWith('edge-') ? 8 : 4);
    assert.equal(result.output, null);
    assert.match(result.stderr, /Translation response|Translation service.*placeholder/);
  });
}
for (const scenario of ['edge-valid', 'edge-transient']) {
  test(`${scenario} restores protected terms and preserves navigation labels`, async () => {
    const result = await translationRequestFixture(scenario, 'SDK Example');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.requests.length, scenario === 'edge-transient' ? 2 : 1);
    assert.ok(result.output?.includes('display-name: "SDK Example"'));
    assert.doesNotMatch(result.output, /notranslate|\[\[\[ph/);
  });
}

test('generation preserves literal dollar sequences in protected code and translated attributes', async () => {
  const body = [
    "Literal `$$` and `$&` and `$'`.",
    '<Card title="Cost $$ and $&" href="/sdk/overview">Use $$ literally.</Card>',
    '[Guide $$ and $&](/sdk/overview)',
    '<b data-value="$`">API</b>',
    'Visit https://example.com/$$',
  ].join('\n') + '\n';
  const result = await translationRequestFixture('normal', 'Example', undefined, [], 'missing', body);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.recoveredPage?.endsWith(body.replaceAll('/sdk/overview', '/ja/sdk/overview')), result.recoveredPage);
  assert.doesNotMatch(result.recoveredPage, /\[\[\[(?:ph|attr)\d+\]\]\]/);
});

for (const state of ['source-missing', 'source-directory']) {
  test(`${state} stops full generation before translation requests or writes`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, [], state);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(result.output, null);
    assert.equal(result.preservedManifest, true);
    assert.match(result.stderr, state === 'source-missing' ? /ENOENT/ : /EISDIR/);
  });
}
test('labels-only generation does not require article sources', async () => {
  const result = await translationRequestFixture('normal', 'Example', undefined, ['--labels-only'], 'source-missing');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 1);
  assert.ok(result.output?.includes('display-name: "Example"'));
  assert.equal(result.preservedManifest, true);
});

for (const target of ['page', 'navigation']) {
  for (const operation of ['write', 'rename']) {
    test(`${target}-${operation}-failure preserves existing output and cache`, async () => {
      const result = await translationRequestFixture(`${target}-${operation}-failure`, 'Example', undefined, ['--force'], 'present');
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Simulated (partial output write|output rename failure)/);
      assert.equal(result.requests.length, target === 'page' ? 2 : 1);
      assert.equal(result.preservedManifest, true);
      assert.deepEqual(result.temporaryWrites, []);
      if (target === 'navigation') assert.equal(result.output, 'Preserved navigation\n');
    });
  }
}

for (const scenario of ['manifest-write-failure', 'manifest-rename-failure']) {
  for (const args of [[], ['--refresh-manifest']]) {
    test(`${scenario} preserves the previous manifest during ${args.length ? 'refresh' : 'generation'}`, async () => {
      const result = await translationRequestFixture(scenario, 'Example', undefined, args, 'present');
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Simulated (partial manifest write|manifest rename failure)/);
      assert.equal(result.preservedManifest, true, 'A failed save must not damage the previous manifest');
      assert.deepEqual(result.temporaryWrites, [], 'Temporary files must be cleaned up after failure');
    });
  }
}

for (const state of ['present', 'missing', 'directory']) {
  test(`cached translation output ${state}: preserve existing files and recover only missing pages`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, [], state);
    assert.equal(result.status, state === 'directory' ? 1 : 0, result.stderr);
    assert.equal(result.requests.length, state === 'missing' ? 2 : 1);
    if (state === 'missing') {
      assert.ok(result.recoveredPage?.includes('canonical-url: https://docs.6mm.com/ja/page-0'));
      assert.match(result.stdout, /1 generated, 157 unchanged/);
    } else if (state === 'present') {
      assert.match(result.stdout, /0 generated, 158 unchanged/);
    } else {
      assert.match(result.stderr, /Translation output is not a file/);
    }
  });
}

for (const args of [['--locales='], ['--locales=,,'], ['--locales=ja', '--locales=fr']]) {
  test(`invalid locale selection ${args.join(' ')} stops without requests or writes`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(result.output, null);
    assert.match(result.stderr, /At least one locale|Specify --locales once/);
  });
}
for (const args of [['--locales=ja', '--locales=ja'], ['--locales=ja,ja,']]) {
  test(`equivalent locale selection ${args.join(' ')} still generates only once`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.requests.length, 1);
    assert.ok(result.output?.includes('display-name: "Example"'));
  });
}

for (const argument of ['--locale=fr', '--froce', '--labels_only', '--refresh-manifset', 'fr']) {
  test(`unrecognized translation argument ${argument} stops before requests or writes`, async () => {
    const result = await translationRequestFixture('normal', 'Example', undefined, [argument]);
    assert.equal(result.requests.length, 0, 'Invalid arguments must not invoke the provider');
    assert.equal(result.output, null, 'Invalid arguments must not overwrite navigation');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Unknown argument/);
    assert.ok(result.stderr.includes(argument));
  });
}

for (const manifestState of ['malformed', 'directory']) {
  test(`unreadable translation manifest (${manifestState}) stops before requesting or writing labels`, async () => {
    const result = await translationRequestFixture('normal', 'Example', manifestState);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(result.output, null);
    assert.match(result.stderr, manifestState === 'directory' ? /EISDIR/ : /SyntaxError/);
  });
}

for (const [name, manifest] of [
  ['root array', []],
  ['null root', null],
  ['locale map array', { locales: [] }],
  ['locale record array', { locales: { ja: [] } }],
  ['page map array', { locales: { ja: { pages: [] } } }],
  ['missing page map', { locales: { ja: {} } }],
  ['non-string page hash', { locales: { ja: { pages: { 'docs/pages/page-0.mdx': null } } } }],
]) {
  test(`invalid manifest shape (${name}) stops before any translation request`, async () => {
    const result = await translationRequestFixture('normal', 'Example', { content: JSON.stringify(manifest) });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(result.output, null);
    assert.match(result.stderr, /Invalid translation manifest/);
  });
}

for (const manifest of [{}, { version: 3, locales: { ja: { pages: { 'docs/pages/page-0.mdx': 'older-source-hash' } } } }]) {
  test(`valid empty or earlier-version manifest remains usable: ${JSON.stringify(manifest)}`, async () => {
    const result = await translationRequestFixture('normal', 'Example', { content: JSON.stringify(manifest) });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.requests.length, 1);
    assert.ok(result.output?.includes('display-name: "Example"'));
  });
}

for (const [scenario, label, requests] of [
  ['poison', 'Example', 4],
  ['poison', 'Example SDK', 20],
  ['transient', 'Example', 2],
  ['missing', 'Example SDK', 2],
  ['normal', 'Example SDK', 1],
]) {
  test(`translation provider ${scenario} (${label}): bounded requests and preserved labels`, async () => {
    const result = await translationRequestFixture(scenario, label);
    assert.equal(result.requests.length, requests);
    assert.equal(result.status, scenario === 'poison' ? 1 : 0, result.stderr);
    if (scenario === 'poison') {
      assert.equal(result.output, null, 'Rejected responses must not write navigation labels');
      assert.match(result.stderr, /Translation service introduced an unexpected placeholder/);
    } else {
      assert.ok(result.output?.includes(`display-name: ${JSON.stringify(label)}`));
    }
  });
}
