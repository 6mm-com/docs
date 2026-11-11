import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const config=parse(await read('fern/docs.yml'));
const nav=config.navigation.find(item=>item.tab==='customerSupport');
assert(nav, 'AI Support must have a top-level navigation entry');
const pages=nav.layout.flatMap(group=>group.contents.map(page=>page.path));
assert.equal(new Set(pages).size,18,'Expected 18 tenant guide pages');
const source=await read('fern/docs/pages/customer-support/mcp-calls.mdx');
const examples=content=>[...content.matchAll(/```json\n([\s\S]*?)```/g)].map(match=>JSON.parse(match[1]));
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
for(const locale of config.translations){
 const base=locale.default?'fern':`fern/translations/${locale.lang}`;
 const prefix=locale.default?'':`/${locale.lang}`;
 for(const file of pages) { const body=await read(`${base}/${file}`); assert(body.length>200,`${locale.lang}: missing tenant guide content`); assert(!/^#{1,6}[ \t]*$/m.test(body),`${locale.lang}: empty heading in ${file}`); const source=await read(`fern/${file}`); assert.equal((body.match(/^## /gm)||[]).length,(source.match(/^## /gm)||[]).length,`${locale.lang}: missing heading in ${file}`); }
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
console.log(`Customer support docs verified: 18 pages, ${config.translations.length} locales, tenant entry points and valid MCP examples.`);