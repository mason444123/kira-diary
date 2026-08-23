const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const overlay = fs.readFileSync('kira-overlay.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

assert.match(html, /work-projects\.js/);
assert.match(overlay, /data-tab="work"/);
assert.match(overlay, /data-screen="work"/);
assert.match(overlay, /data\/projects\.json/);
assert.match(overlay, /Главные проекты/);
assert.match(overlay, /work-project-brief/);
assert.match(overlay, /Сделано · \$\{progress\.done\}/);
assert.match(overlay, /Дальше · \$\{progress\.remaining\}/);
assert.match(overlay, /Подробнее/);
assert.match(overlay, /nowRoot\.hidden = true/);
assert.match(overlay, /diaryRoot\.hidden = true/);
assert.match(overlay, /Проектов пока нет\. Добавь их через Kira\/обновление data\/projects\.json/);
assert.match(overlay, /data-work-add-project/);
assert.match(overlay, /data-work-project-form/);
assert.match(overlay, /data-work-edit-project/);
assert.match(overlay, /Редактировать/);
assert.match(overlay, /LOCAL_PROJECT_OVERRIDES_KEY/);
assert.match(overlay, /Что нужно/);
assert.doesNotMatch(overlay, /data-work-(?:save|delete)/);
assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
console.log('work UI smoke tests passed');
