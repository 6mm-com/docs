import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';
import { assertSourcePagesListed } from './documentation-pages.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Validation is read-only; share each file's text within this run.
const contents = new Map();
const read = relative => {
 const file = path.join(root, relative);
 if (!contents.has(file)) contents.set(file, readFile(file, 'utf8'));
 return contents.get(file);
};
const config=parse(await read('fern/docs.yml'));
const nav=config.navigation.find(item=>item.tab==='customerSupport');
assert(nav, 'AI Support must have a top-level navigation entry');
const pages=nav.layout.flatMap(group=>group.contents.map(page=>page.path));
const supportDirectory = 'docs/pages/customer-support';
assert(pages.length && pages.every(page => page?.startsWith(supportDirectory + '/')), 'AI Support navigation must point to tenant guide pages');
assert.equal(new Set(pages).size, pages.length, 'Duplicate tenant guide page in AI Support navigation');
await assertSourcePagesListed(path.join(root, 'fern'), pages, supportDirectory);
const source=await read('fern/docs/pages/customer-support/mcp-calls.mdx');
// Protocol examples are read-only and normally identical across all locales.
const parsedExamples = new Map();
const examples=content=>Array.from(content.matchAll(/```json\n([\s\S]*?)```/g), match => {
 const text = match[1];
 if (!parsedExamples.has(text)) parsedExamples.set(text, JSON.parse(text));
 return parsedExamples.get(text);
});
const expected=examples(source);
assert.equal(expected.length,5,'Expected read, create, preview, delete and operation examples');
const [readCall,create,preview,remove,status]=expected;
assert.equal(readCall.params.name,'knowledge_get_categories');
assert.equal(create.params.name,'knowledge_create_article');
assert(Number.isInteger(create.params.arguments.body.categoryId),'Article category must be numeric');
assert.equal(create.params.arguments.body.status,'draft');
assert.equal(preview.params.name,'mcp_preview');
assert.equal(preview.params.arguments.tool,remove.params.name);
assert.equal(preview.params.arguments.arguments.requestId,remove.params.arguments.requestId);
assert.equal(preview.params.arguments.arguments.id,remove.params.arguments.id);
assert.equal(status.params.name,'mcp_operation');
for(const message of expected){assert.equal(message.jsonrpc,'2.0');assert.equal(message.method,'tools/call');}
const sourceHeadingCounts = new Map();
for(const locale of config.translations){
 const base=locale.default?'fern':`fern/translations/${locale.lang}`;
 const prefix=locale.default?'':`/${locale.lang}`;
 // Read one locale's guides together; validate in the original order below.
 // Settle failures here so a later missing file cannot mask an earlier assertion.
 await Promise.allSettled(pages.map(file=>read(`${base}/${file}`)));
 for(const file of pages) {
  const body=await read(`${base}/${file}`);
  assert(body.length>200,`${locale.lang}: missing tenant guide content`);
  assert(!/^#{1,6}[ \t]*$/m.test(body),`${locale.lang}: empty heading in ${file}`);
  if (!sourceHeadingCounts.has(file)) {
   const source=await read(`fern/${file}`);
   sourceHeadingCounts.set(file, (source.match(/^## /gm)||[]).length);
  }
  assert.equal((body.match(/^## /gm)||[]).length,sourceHeadingCounts.get(file),`${locale.lang}: missing heading in ${file}`);
 }
 for (const slug of ['workbench','tickets','history','team','settings','analytics','billing','logs']) {
  const guide=await read(`${base}/docs/pages/customer-support/${slug}.mdx`);
  assert(guide.includes('className="sixmm-support-flow"'),`${locale.lang}/${slug}: missing workflow diagram`);
  assert.equal((guide.match(/<Accordion title="[^\"]+">/g)||[]).length,2,`${locale.lang}/${slug}: missing question or answer`);
  assert.equal((guide.match(/<Card title="[^\"]+" href="/g)||[]).length,2,`${locale.lang}/${slug}: missing related guide card`);
 }
 const calls=await read(`${base}/docs/pages/customer-support/mcp-calls.mdx`);
 assert.deepEqual(examples(calls),expected,`${locale.lang}: protocol examples changed`);
 const connect=await read(`${base}/docs/pages/customer-support/mcp-connect.mdx`);
 assert(connect.includes('https://csadmin.6mm.com/api/v1/mcp'),`${locale.lang}: wrong MCP endpoint`);
 for(const file of ['home','solutions/overview']){
  const entry=await read(`${base}/docs/pages/${file}.mdx`);
  assert(entry.includes(`href="${prefix}/customer-support/overview"`),`${locale.lang}: missing product entry`);
  assert(entry.includes(`href="${prefix}/customer-support/mcp-connect"`),`${locale.lang}: missing MCP entry`);
 }
}
console.log(`Customer support docs verified: ${pages.length} pages, ${config.translations.length} locales, tenant entry points and valid MCP examples.`);
