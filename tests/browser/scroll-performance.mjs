import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readScopedTocCss, sampleTocMotion } from './toc.mjs';

// Profile rendered public pages with real wheel input. No timing thresholds or
// production requests in the normal regression suite.
const probeArticleRules = process.argv.includes('--probe-unused-article-rules');
const probeTocMotion = process.argv.includes('--probe-toc-motion');
const inspectToc = process.argv.includes('--inspect-toc');
const probeTocScope = process.argv.includes('--probe-toc-scope');
assert.ok([probeArticleRules, probeTocMotion, probeTocScope].filter(Boolean).length < 2, 'Use one diagnostic probe at a time');
const paths = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!paths.length) paths.push('/zh-CN/developer-api/rest-api/order', '/zh-CN/sdk/agent-sdk/java/perpetual-queries');
const scopedCss = probeTocScope ? await readScopedTocCss() : null;
const origin = 'https://docs.6mm.com';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  console.log(`Chromium ${browser.version()}, desktop wheel; median of 3 samples per page`);
  for (const path of paths) {
    const url = new URL(path, origin);
    assert.ok(path.startsWith('/') && url.origin === origin, 'Pass a docs.6mm.com path');
    const page = await context.newPage();
    try {
      const response = await page.goto(url.href, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      assert.equal(new URL(page.url()).origin, origin);
      const article = page.locator('main article').first();
      await article.waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready.then(() => true));
      const dimensions = await article.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { x: box.left + box.width / 2, height: Math.round(box.height), nodes: node.querySelectorAll('*').length };
      });
      assert.ok(dimensions.height > 3000, `Choose a long document: ${path} is ${dimensions.height}px`);
      await page.mouse.move(dimensions.x, 400);
      if (inspectToc) {
        console.log(path, JSON.stringify(await page.evaluate(() => {
          const rules = [];
          function visit(entries) {
            for (const rule of entries) {
              if (/\btoc-(root|item|fill)\b|@property\s+--\S*toc\b/.test(rule.selectorText || rule.cssText.slice(0, 80))) {
                rules.push(rule.cssText);
              } else if (rule.cssRules) visit(rule.cssRules);
            }
          }
          for (const sheet of document.styleSheets) {
            let entries;
            try { entries = sheet.cssRules; } catch { continue; }
            visit(entries);
          }
          const toc = document.querySelector('#fern-toc');
          return { rules, markup: toc?.querySelector('.toc-root')?.outerHTML.slice(0, 1300) };
        })));
        continue;
      }
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
      await sweep(page); // Warm compositing and delayed page work.
      console.log(path, JSON.stringify(dimensions));
      const variants = ['live'];
      if (probeArticleRules) variants.push('unused-rules-off');
      if (probeTocMotion) variants.push('toc-motion-off');
      if (probeTocScope) variants.push('toc-motion-scoped');
      const samples = new Map(variants.map(name => [name, []]));
      for (let i = 0; i < 3; i++) {
        for (const variant of i % 2 ? [...variants].reverse() : variants) {
          if (probeArticleRules) await setUnusedArticleRules(page, variant === 'unused-rules-off');
          if (probeTocMotion) await setTocMotion(page, variant === 'toc-motion-off');
          if (probeTocScope) await setTocScope(page, variant === 'toc-motion-scoped');
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await frames(page, 8);
          const before = await metrics(cdp);
          await cdp.send('Profiler.start');
          const end = await sweep(page);
          const { profile } = await cdp.send('Profiler.stop');
          const after = await metrics(cdp);
          assert.ok(end > 2000, `Wheel input reached only ${end}px`);
          const delta = key => (after[key] - before[key]) * 1000;
          samples.get(variant).push({
            wheelEnd: end, taskMs: delta('TaskDuration'), scriptMs: delta('ScriptDuration'),
            styleMs: delta('RecalcStyleDuration'), layoutMs: delta('LayoutDuration'),
            ...sampleScripts(profile),
          });
        }
      }
      for (const [variant, rows] of samples) {
        console.log(variant, 'samples:', JSON.stringify(rows));
        console.log(variant, 'median:', JSON.stringify(Object.fromEntries(Object.keys(rows[0]).map(key => [
          key, rows.map(row => row[key]).sort((a, b) => a - b)[1],
        ]))));
      }
      if (probeArticleRules) await setUnusedArticleRules(page, false);
      if (probeTocMotion) await setTocMotion(page, false);
      if (probeTocScope) {
        await setTocScope(page, false);
        const live = await verifyToc(page, 'toc-root');
        await setTocScope(page, true);
        assert.deepEqual(await verifyToc(page, 'toc-fill'), live, 'TOC animation, highlighting or fragment navigation changed');
        await setTocScope(page, false);
        console.log(`TOC parity: ${live.frames.length} clip-path frames × ${live.frames[0].length} fills; ${live.heading} anchor and current state`);
      }
      await page.mouse.move(dimensions.x, 400);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await frames(page, 8);
      console.log('render trace:', JSON.stringify(await traceRendering(page, cdp)));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

async function sweep(page) {
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 168);
    await frames(page, 2);
  }
  await frames(page, 4);
  return page.evaluate(() => scrollY);
}

async function frames(page, count) {
  await page.evaluate(async count => {
    for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame);
  }, count);
}

async function metrics(cdp) {
  return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
}

async function setUnusedArticleRules(page, disable) {
  const count = await page.evaluate(disable => {
    const state = window.sixmmScrollProbeRules ??= [];
    if (!state.length) {
      function inspect(rules) {
        for (const rule of rules) {
          const selector = rule.selectorText;
          if (selector?.includes(':has(') && /sixmm-home|sixmm-support-flow|available-tools-follow-your-role/.test(selector) &&
              !document.querySelector(selector)) state.push({ rule, selector });
          if (rule.cssRules) inspect(rule.cssRules);
        }
      }
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // Unrelated cross-origin CSS.
        inspect(rules);
      }
    }
    for (const { rule, selector } of state) {
      if (disable && document.querySelector(selector)) throw new Error('The probe would change visible styling');
      const wanted = disable ? ':not(*)' : selector;
      if (rule.selectorText !== wanted) rule.selectorText = wanted;
    }
    return state.length;
  }, disable);
  assert.ok(count, 'No unused brand article rules found in deployed CSS');
}

async function setTocMotion(page, disable) {
  await page.evaluate(disable => {
    if (!document.querySelector('#fern-toc .toc-root')) throw new Error('No Fern TOC on this page');
    let style = document.getElementById('sixmm-scroll-probe-toc');
    if (!style) {
      style = document.createElement('style');
      style.id = 'sixmm-scroll-probe-toc';
      // Diagnostic only: an active TOC entry still changes, but without transitions.
      style.textContent = '#fern-toc, #fern-toc * { transition-duration: 0s !important; animation-duration: 0s !important; }';
      document.head.appendChild(style);
    }
    style.sheet.disabled = !disable;
  }, disable);
}

async function setTocScope(page, enabled) {
  await page.evaluate(({ enabled, css }) => {
    let state = window.sixmmTocScopeProbe;
    if (!state) {
      const root = document.querySelector('#fern-toc .toc-root');
      const alreadyScoped = getComputedStyle(root).getPropertyValue('--sixmm-toc-target-top').trim() !== '';
      const style = document.createElement('style');
      style.id = 'sixmm-scroll-probe-scope';
      style.textContent = css;
      document.head.appendChild(style);
      style.sheet.disabled = true;
      const deployed = [];
      if (alreadyScoped) {
        // After release, create a control by disabling only the exact generated
        // override rules, not the original Fern rules in that same renderer.
        const expected = [...style.sheet.cssRules[0].cssRules];
        function find(rules) {
          for (const rule of rules) {
            if (rule.selectorText && expected.some(candidate =>
              candidate.selectorText === rule.selectorText && candidate.style.cssText === rule.style.cssText)) {
              deployed.push({ rule, selector: rule.selectorText });
            } else if (rule.cssRules) find(rule.cssRules);
          }
        }
        for (const sheet of document.styleSheets) {
          if (sheet === style.sheet) continue;
          let rules;
          try { rules = sheet.cssRules; } catch { continue; }
          find(rules);
        }
        if (deployed.length !== expected.length) throw new Error('Cannot isolate the deployed TOC override for this baseline');
      }
      state = window.sixmmTocScopeProbe = { style, deployed };
    }
    for (const { rule, selector } of state.deployed) {
      const wanted = enabled ? selector : ':not(*)';
      if (rule.selectorText !== wanted) rule.selectorText = wanted;
    }
    state.style.sheet.disabled = !enabled || state.deployed.length > 0;
  }, { enabled, css: scopedCss });
}

async function verifyToc(page, owner) {
  await page.evaluate(() => {
    history.replaceState(history.state, '', location.pathname + location.search);
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await frames(page, 5);
  const { frames: states, owners } = await sampleTocMotion(page);
  assert.ok(owners.includes(owner), `Expected animation on ${owner}, not ${owners.join(', ')}`);
  assert.equal(states.length, 5, 'No native TOC fill transition found');
  assert.notDeepEqual(states[0], states[2], 'The fill must animate, not jump between endpoints');
  const link = page.locator('#fern-toc .toc-item[data-depth="0"] > a[href^="#"]').nth(1);
  const href = await link.getAttribute('href');
  const heading = decodeURIComponent(href.slice(1));
  await link.click();
  await page.waitForFunction(heading => {
    if (decodeURIComponent(location.hash.slice(1)) !== heading) return false;
    const target = document.getElementById(heading);
    return target && Math.abs(target.getBoundingClientRect().top) < innerHeight / 2;
  }, heading, { timeout: 5000 });
  // Fern may choose a neighboring heading when several headings are visible.
  // Compare the result against Fern rather than defining a different policy.
  await frames(page, 16);
  const current = await page.locator('#fern-toc .toc-item[data-toc-state="current"] > a').getAttribute('href');
  assert.ok(current, 'Fern did not highlight a current heading');
  return { heading, current, frames: states };
}

async function traceRendering(page, cdp) {
  const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.invalidationTracking',
    transferMode: 'ReturnAsStream',
  });
  await page.evaluate(() => performance.mark('sixmm-scroll-start'));
  await sweep(page);
  await page.evaluate(() => performance.mark('sixmm-scroll-end'));
  await cdp.send('Tracing.end');
  const { stream, dataLossOccurred } = await complete;
  assert.ok(stream && !dataLossOccurred, 'Chromium did not return a complete trace');
  const chunks = [];
  try {
    for (;;) {
      const { data, base64Encoded, eof } = await cdp.send('IO.read', { handle: stream });
      chunks.push(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
      if (eof) break;
    }
  } finally {
    await cdp.send('IO.close', { handle: stream });
  }
  const { traceEvents: events } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const start = events.find(event => event.name === 'sixmm-scroll-start');
  const end = events.find(event => event.name === 'sixmm-scroll-end');
  assert.ok(start && end, 'Trace markers were not recorded');
  const phases = new Set(['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize']);
  const render = {};
  const invalidations = new Map();
  for (const { name, pid, tid, ts, dur, args } of events) {
    if (pid !== start.pid || tid !== start.tid || ts < start.ts || ts >= end.ts) continue;
    if (phases.has(name) && dur) {
      const stat = render[name] ??= { count: 0, ms: 0 };
      stat.count++;
      stat.ms += dur / 1000;
    }
    if (name.endsWith('InvalidationTracking')) {
      const data = args?.data;
      const key = [data?.reason || name, data?.changedAttribute || data?.changedClass, data?.nodeName].filter(Boolean).join(' / ');
      invalidations.set(key, (invalidations.get(key) || 0) + 1);
    }
  }
  // Phases can be nested; their timings must not be added together.
  return { render, topInvalidations: [...invalidations].sort((a, b) => b[1] - a[1]).slice(0, 8) };
}

function sampleScripts(profile) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children || []) parents.set(child, node.id);
  }
  let customSamples = 0;
  let fernSamples = 0;
  let otherScriptSamples = 0;
  for (let id of profile.samples || []) {
    for (; id; id = parents.get(id)) {
      const { url } = nodes.get(id).callFrame;
      if (!url) continue;
      if (/\/_fern-files\/.+\/(?:card-effects|docs-interface|language-modal|locale-direction|safari-hydration|seo-structured-data|support-widget)\.js(?:$|\?)/.test(url)) {
        customSamples++;
      } else if (url.startsWith(origin + '/')) {
        fernSamples++;
      } else {
        otherScriptSamples++;
      }
      break;
    }
  }
  return { customSamples, fernSamples, otherScriptSamples };
}
