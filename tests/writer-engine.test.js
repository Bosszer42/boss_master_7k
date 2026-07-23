'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const {
  parseWriterSources,
  createWriterSelection,
  buildWriterRequest,
  parseWriterOutput,
  validateWriterOutput,
  validateZipEntryName
} = require('../writer-engine');

function workbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'example.com');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

test('imports writer data from JSON and spreadsheets without bundled defaults', () => {
  const pack = parseWriterSources([
    {
      name: 'writer.json',
      buffer: Buffer.from(JSON.stringify({
        site: 'example.com',
        keywords: ['main key', 'support key'],
        tagSets: [{ name: 'set A', tags: ['one', 'two'] }],
        categories: ['News'],
        prompts: [{ mode: 'normal', content: 'Use a concise style.' }],
        rules: ['Do not invent facts.']
      }))
    },
    {
      name: 'extra.xlsx',
      buffer: workbookBuffer([{ website: 'example.com', keyword: 'third key', tags: 'three,four', category: 'Updates' }])
    }
  ], 'My pack');

  assert.equal(pack.name, 'My pack');
  assert.deepEqual(pack.sites, ['example.com']);
  assert.equal(pack.keywords.length, 3);
  assert.equal(pack.tagSets.length, 2);
  assert.equal(pack.categories.length, 2);
  assert.equal(pack.prompts.length, 1);
  assert.equal(pack.rules.length, 1);
});

test('rejects unsafe ZIP traversal paths', () => {
  assert.throws(() => validateZipEntryName('../escape.txt'), /พาธไม่ปลอดภัย/);
  assert.throws(() => validateZipEntryName('folder/../../escape.txt'), /พาธไม่ปลอดภัย/);
  assert.throws(() => validateZipEntryName('C:/escape.txt'), /พาธไม่ปลอดภัย/);
});

test('random selection is repeatable with the same seed', () => {
  const pack = parseWriterSources([{
    name: 'writer.json',
    buffer: Buffer.from(JSON.stringify({
      site: 'example.com',
      keywords: ['alpha', 'beta', 'gamma', 'delta'],
      tagSets: [{ name: 'one', tags: ['tag-a', 'tag-b'] }],
      categories: ['A', 'B']
    }))
  }]);
  pack.id = 'pack-1';
  const first = createWriterSelection(pack, { site: 'example.com', seed: 'fixed', supportKeywordCount: 2 });
  const second = createWriterSelection(pack, { site: 'example.com', seed: 'fixed', supportKeywordCount: 2 });
  assert.deepEqual(first, second);
  assert.equal(first.packId, 'pack-1');
});

test('builds a structured request and validates locked source facts', () => {
  const pack = parseWriterSources([{
    name: 'writer.json',
    buffer: Buffer.from(JSON.stringify({ site: 'example.com', keywords: ['alpha'], tags: ['one'], categories: ['News'] }))
  }]);
  pack.id = 'pack-1';
  const selection = createWriterSelection(pack, { site: 'example.com', seed: 'fixed' });
  const request = buildWriterRequest(pack, selection, {
    code: 'ABC-001',
    actor: 'Person A',
    studio: 'Studio A',
    sourceContent: 'Only source facts.',
    metaMin: 10,
    metaMax: 160,
    contentMin: 10
  });
  const output = parseWriterOutput(JSON.stringify({
    focus: selection.focusKeyword,
    title: 'A valid title',
    meta: 'A valid meta description',
    content: 'A valid content body.',
    categories: ['News'],
    tags: ['one'],
    code: 'ABC-001',
    actor: 'Person A',
    studio: 'Studio A'
  }));
  assert.deepEqual(validateWriterOutput(output, request, selection), []);
  output.code = 'CHANGED';
  assert.match(validateWriterOutput(output, request, selection).join('\n'), /code ไม่ตรง/);
});
