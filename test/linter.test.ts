const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLinterFunctions() {
  const linterJsPath = path.join(__dirname, '../dist/linter.js');
  const jsCode = fs.readFileSync(linterJsPath, 'utf8');

  const sandbox = {
    Logger: { log: () => {} },
    DocumentApp: {},
    WIKI_DOCS: [],
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);

  return {
    checkCrossReferencesInText: sandbox.checkCrossReferencesInText,
    detectOrphanDocuments: sandbox.detectOrphanDocuments,
    EXCLUDED_ORPHAN_DOCS: sandbox.EXCLUDED_ORPHAN_DOCS
  };
}

const {
  checkCrossReferencesInText,
  detectOrphanDocuments,
  EXCLUDED_ORPHAN_DOCS
} = loadLinterFunctions();

test('WIKI-006: 存在しない about-dummy-notfound.md を検知して BrokenCrossReference (FAIL) を起票する', () => {
  const validDocNames = new Set(['about-me.md', 'about-car.md', 'about-pet.md']);
  const inboundRefCount = new Map([
    ['about-me.md', 0],
    ['about-car.md', 0],
    ['about-pet.md', 0]
  ]);

  const text = '詳細は [about-dummy-notfound.md](https://example.com) を参照してください。';
  const issues = checkCrossReferencesInText(text, 'about-car.md', validDocNames, inboundRefCount);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, 'WIKI-006');
  assert.equal(issues[0].category, 'BrokenCrossReference');
  assert.equal(issues[0].status, 'FAIL');
  assert.match(issues[0].message, /about-dummy-notfound\.md/);
});

test('WIKI-006: 正当なリンク（about-pet.md）を含むテキスト走査で inboundRefCount が加算されエラーが出ない', () => {
  const validDocNames = new Set(['about-me.md', 'about-car.md', 'about-pet.md']);
  const inboundRefCount = new Map([
    ['about-me.md', 0],
    ['about-car.md', 0],
    ['about-pet.md', 0]
  ]);

  const text = '愛猫の情報は about-pet.md に記録されています。';
  const issues = checkCrossReferencesInText(text, 'about-car.md', validDocNames, inboundRefCount);

  assert.equal(issues.length, 0);
  assert.equal(inboundRefCount.get('about-pet.md'), 1);
});

test('WIKI-006: 起点文書（about-me.md 等）が被参照 0 でも OrphanDocument 判定から除外される', () => {
  const allDocNames = ['about-me.md', 'README.md', 'log.md', 'AGENTS.md', 'custom-instructions-master.md', 'about-car.md'];
  const inboundRefCount = new Map([
    ['about-me.md', 0],
    ['README.md', 0],
    ['log.md', 0],
    ['AGENTS.md', 0],
    ['custom-instructions-master.md', 0],
    ['about-car.md', 1]
  ]);

  const issues = detectOrphanDocuments(allDocNames, inboundRefCount, EXCLUDED_ORPHAN_DOCS);

  // 起点文書群は被参照0でも除外されるため、issuesは0件
  assert.equal(issues.length, 0);
});

test('WIKI-006: 被参照 0 の一般マスターが OrphanDocument (UNKNOWN) として起票される', () => {
  const allDocNames = ['about-me.md', 'about-car.md', 'about-isolated.md'];
  const inboundRefCount = new Map([
    ['about-me.md', 0],
    ['about-car.md', 1],
    ['about-isolated.md', 0]
  ]);

  const issues = detectOrphanDocuments(allDocNames, inboundRefCount, EXCLUDED_ORPHAN_DOCS);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, 'WIKI-006');
  assert.equal(issues[0].category, 'OrphanDocument');
  assert.equal(issues[0].status, 'UNKNOWN');
  assert.equal(issues[0].docName, 'about-isolated.md');
});
