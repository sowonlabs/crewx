/**
 * Zero-dependency check for README.md and the issue templates.
 * Run with: node scripts/verify-docs.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('README orders intro -> download -> help -> issues', () => {
  const readme = read('README.md');
  const introIdx = readme.indexOf('# CrewX');
  const downloadIdx = readme.indexOf('## Download');
  const helpIdx = readme.indexOf('## Help');
  const issuesIdx = readme.indexOf('## Issues');
  assert.ok(introIdx >= 0, 'missing # CrewX heading');
  assert.ok(downloadIdx > introIdx, '## Download must come after the intro');
  assert.ok(helpIdx > downloadIdx, '## Help must come after ## Download');
  assert.ok(issuesIdx > helpIdx, '## Issues must come after ## Help');
});

test('README points the primary download link at the approved download page', () => {
  assert.match(read('README.md'), /https:\/\/www\.crewx\.dev\/download/);
});

test('README does not claim a macOS build is available yet', () => {
  const macLine = read('README.md').split('\n').find((line) => /macOS/i.test(line));
  assert.ok(macLine, 'expected a line mentioning macOS');
  assert.match(macLine, /coming soon|in progress|not yet available/i);
});

test('README does not promote npx as the primary install method', () => {
  assert.doesNotMatch(read('README.md'), /npx crewx/i);
});

test('README keeps the npm CLI install instructions', () => {
  assert.match(read('README.md'), /npm install -g @crewx\/cli/);
});

test('README links to the public issue tracker and says it is public', () => {
  const readme = read('README.md');
  assert.match(readme, /https:\/\/github\.com\/sowonlabs\/crewx\/issues\/new\/choose/);
  assert.match(readme.toLowerCase(), /public/);
});

test('README scopes Apache-2.0 to the CLI source only', () => {
  const readme = read('README.md');
  const licenseSection = readme.slice(readme.indexOf('## Source & license'));
  assert.ok(licenseSection.length > 0, 'missing ## Source & license section');
  assert.match(licenseSection, /Apache-2\.0/);
  assert.match(licenseSection, /@crewx\/sdk/);
  assert.match(licenseSection, /proprietary/i);
  assert.match(licenseSection, /Source code \(zip\)/);
  assert.match(licenseSection, /not the Desktop|not.*Desktop.*source/i);
});

test('bug report template asks for version, OS, install type, repro, expected/actual', () => {
  const tpl = read('.github/ISSUE_TEMPLATE/bug_report.md');
  assert.match(tpl, /version/i);
  assert.match(tpl, /\bOS\b/);
  assert.match(tpl, /install type/i);
  assert.match(tpl, /steps to reproduce/i);
  assert.match(tpl, /expected behavior/i);
  assert.match(tpl, /actual behavior/i);
});

test('both issue templates warn against posting secrets or private conversation content', () => {
  for (const rel of ['.github/ISSUE_TEMPLATE/bug_report.md', '.github/ISSUE_TEMPLATE/feature_request.md']) {
    const tpl = read(rel);
    assert.match(tpl, /public/i);
    assert.match(tpl, /token|api key/i);
  }
});
