import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Local comparison, not a timing assertion for CI. Use --against-head to
// compare two script revisions in one Chromium process with the same CSS.
const root = new URL('../../', import.meta.url);
const sourcePath = 'fern/card-effects.js';
const current = await readFile(new URL(sourcePath, root), 'utf8');
const css = await readFile(new URL('fern/styles.css', root), 'utf8');
const revisions = [['working', current]];
if (process.argv.includes('--against-head')) {
  revisions.unshift(['HEAD', execFileSync('git', ['show', `HEAD:${sourcePath}`], {
    cwd: fileURLToPath(root), encoding: 'utf8',
  })]);
}

const cards = Array.from({ length: 6 }, (_, i) =>
  `<a class="fern-card" href="#section-${i}"><h2>Integration ${i}</h2><p>Documentation and examples</p></a>`).join('');
const sections = Array.from({ length: 160 }, (_, i) =>
  `<section id="section-${i}"><h2>Reference ${i}</h2><p>Configuration <code>example</code> and limits.</p>
    <table><tbody>${'<tr><th>Field</th><td><code>value</code></td><td>Details</td></tr>'.repeat(5)}</tbody></table>
    <pre><code>${'const example = "configuration";\n'.repeat(8)}</code></pre></section>`).join('');

const browser = await chromium.launch();
try {
  console.log(`Chromium ${browser.version()}, 1400 × 950; median of 5 samples per scenario`);
  const samples = new Map();
  const work = new Map();
  for (let i = 0; i < 6; i++) {
    for (const [revision, source] of i % 2 ? [...revisions].reverse() : revisions) {
      for (const scenario of ['scroll', 'hover']) {
        const key = `${revision} ${scenario}`;
        const { counts, ...row } = await sample(source, scenario, i === 0);
        if (i === 0) {
          work.set(key, counts);
          continue; // Keep instrumented counts out of the timing samples.
        }
        if (!samples.has(key)) samples.set(key, []);
        samples.get(key).push(row);
      }
    }
  }
  for (const [scenario, rows] of samples) {
    const medians = Object.fromEntries(Object.keys(rows[0]).map(key => [
      key, Number(rows.map(row => row[key]).sort((a, b) => a - b)[2].toFixed(2)),
    ]));
    console.log(scenario, JSON.stringify({ ...medians, ...work.get(scenario) }),
      'task samples (ms):', rows.map(row => row.taskMs.toFixed(2)).join(', '));
  }
} finally {
  await browser.close();
}

async function sample(source, scenario, instrument) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  try {
    await page.setContent(`<main style="width:900px;margin:24px auto"><article>
      <div class="fern-card-group" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${cards}</div>
      ${sections}</article></main>`);
    await page.addStyleTag({ content: css + '\n.fern-card {display:block;padding:22px;min-height:120px}' });
    await page.addScriptTag({ content: source });
    await page.evaluate(async instrument => {
      if (!matchMedia('(hover: hover) and (pointer: fine)').matches) throw new Error('Desktop pointer unavailable');
      if (instrument) {
        const counts = window.cardWork = { rectReads: 0, styleWrites: 0 };
        const rect = Element.prototype.getBoundingClientRect;
        const setProperty = CSSStyleDeclaration.prototype.setProperty;
        Element.prototype.getBoundingClientRect = function () {
          if (this.classList.contains('sixmm-content-card')) counts.rectReads++;
          return rect.call(this);
        };
        CSSStyleDeclaration.prototype.setProperty = function (name, value) {
          if (name.startsWith('--sixmm-card-')) counts.styleWrites++;
          return setProperty.call(this, name, value);
        };
      }
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    }, instrument);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const before = await metrics(cdp);
    const counts = await page.evaluate(async scenario => {
      const cards = Array.from(document.querySelectorAll('.fern-card'));
      // Fixed physical coordinates; these initial reads are not part of the effect.
      const rects = cards.map(card => card.getBoundingClientRect());
      if (window.cardWork) window.cardWork.rectReads = 0;
      for (let i = 0; i < 60; i++) {
        // Deliver input after the frame, as opposed to dispatching 60 moves in
        // one task that collapses into a single render.
        await new Promise(requestAnimationFrame);
        if (scenario === 'scroll') {
          scrollTo(0, i * 390);
        } else {
          const index = i < 30 ? 0 : 3;
          const rect = rects[index];
          const x = rect.left + 30 + (i % 30) * 6;
          const y = rect.top + 40 + (i % 13) * 3;
          cards[index].dispatchEvent(new PointerEvent('pointermove', {
            pointerType: 'mouse', bubbles: true, clientX: x, clientY: y,
          }));
        }
      }
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      return window.cardWork;
    }, scenario);
    const after = await metrics(cdp);
    const ms = key => (after[key] - before[key]) * 1000;
    return {
      taskMs: ms('TaskDuration'), scriptMs: ms('ScriptDuration'),
      styleMs: ms('RecalcStyleDuration'), layoutMs: ms('LayoutDuration'), counts,
    };
  } finally {
    await page.close();
  }
}

async function metrics(cdp) {
  return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
}
