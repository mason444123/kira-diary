(() => {
  const WORDS = [
    { word: 'clarity', translation: 'ясность', example: 'Clarity comes when you write one honest sentence.' },
    { word: 'gentle', translation: 'мягкий, бережный', example: 'Be gentle with yourself after a heavy day.' },
    { word: 'steady', translation: 'устойчивый', example: 'Keep it steady — one small step is enough today.' },
    { word: 'focus', translation: 'фокус', example: 'Choose one focus for tonight.' },
    { word: 'release', translation: 'отпустить', example: 'Release what you cannot fix today.' }
  ];

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const entryStore = {};
  let projectStore = [];
  const DATA_URL = 'data/entries.json';
  const PROJECTS_URL = 'data/projects.json';
  const LOCAL_PROJECTS_KEY = 'kiraDiary.localProjects';
  const LOCAL_PROJECT_OVERRIDES_KEY = 'kiraDiary.localProjectOverrides';
  const projectApi = window.KiraProjects || null;

  function entryList() {
    return Object.values(entryStore).filter(Boolean).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  function entriesForMonth(y, m) {
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
    return entryList().filter((entry) => String(entry.date || '').startsWith(prefix));
  }
  function site(entry, key, fallback = '—') {
    return entry?.site_blocks?.[key] || fallback;
  }
  function scoreClass(score) {
    if (score == null || score === '') return '';
    const n = Number(score);
    if (Number.isNaN(n)) return '';
    if (n >= 8) return 'score-good';
    if (n >= 6) return 'score-steady';
    if (n >= 4) return 'score-low';
    return 'score-hard';
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch]));
  }
  async function loadEntries() {
    try {
      const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return {};
      return await res.json();
    } catch (err) {
      console.warn('[KiraDiary] entries load failed', err);
      return {};
    }
  }
  async function loadProjects() {
    try {
      const res = await fetch(`${PROJECTS_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const payload = await res.json();
      return projectApi ? projectApi.normalizeProjects(payload) : [];
    } catch (err) {
      console.warn('[KiraDiary] projects load failed', err);
      return [];
    }
  }
  function readLocalProjects() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || '[]');
      return Array.isArray(saved) && projectApi ? projectApi.normalizeProjects({ projects: saved }) : [];
    } catch (_) {
      return [];
    }
  }
  function saveLocalProjects(projects) {
    try { localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects)); return true; } catch (_) { return false; }
  }
  function readProjectOverrides() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_PROJECT_OVERRIDES_KEY) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (_) {
      return {};
    }
  }
  function saveProjectOverrides(overrides) {
    try { localStorage.setItem(LOCAL_PROJECT_OVERRIDES_KEY, JSON.stringify(overrides)); return true; } catch (_) { return false; }
  }
  function mergeProjectOverrides(projects) {
    const overrides = readProjectOverrides();
    return projects.map((project) => overrides[project.id]
      ? projectApi.normalizeProjects({ projects: [{ ...project, ...overrides[project.id] }] })[0]
      : project);
  }
  function saveProjectEdit(project) {
    const localProjects = readLocalProjects();
    const localIndex = localProjects.findIndex((item) => item.id === project.id);
    if (localIndex >= 0) {
      localProjects[localIndex] = project;
      return saveLocalProjects(localProjects);
    }
    return saveProjectOverrides({ ...readProjectOverrides(), [project.id]: project });
  }
  function addLocalProject(title, needs) {
    const id = `local-${Date.now()}`;
    const cleanTitle = String(title).trim().slice(0, 90);
    const cleanNeeds = String(needs).trim().slice(0, 500);
    const project = {
      id,
      title: cleanTitle,
      description: cleanNeeds,
      status: 'active',
      next_action: cleanNeeds || 'Определить первый следующий шаг',
      blockers: [],
      tasks: cleanNeeds ? [{ id: `${id}-first-step`, title: cleanNeeds, status: 'in_progress', priority: 'high', updated_at: dateKey() }] : [],
      decisions: [{ date: dateKey(), text: 'Проект добавлен с панели управления.' }]
    };
    const localProjects = readLocalProjects();
    if (!saveLocalProjects([...localProjects, project])) return null;
    return projectApi.normalizeProjects({ projects: [project] })[0];
  }

  function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function wordFor(key) {
    const n = Number(key.replaceAll('-', '')) || 0;
    return WORDS[n % WORDS.length];
  }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthOffset(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; }
  function previousDateKey(d = new Date()) {
    const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    return dateKey(prev);
  }
  function latestCompletedEntry() {
    const yesterdayKey = previousDateKey(now);
    return entryStore[yesterdayKey]
      || entryList().filter((entry) => String(entry.date || '') < todayKey).at(-1)
      || entryList().at(-1)
      || null;
  }
  function metricNumber(value, kind = 'mood') {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 10) / 10;
    const text = String(value).trim().toLowerCase();
    const direct = text.match(/\d+(?:[.,]\d+)?/);
    if (direct) return Math.round(Number(direct[0].replace(',', '.')) * 10) / 10;
    if (kind === 'energy') {
      if (text.includes('высок') || text.includes('актив') || text.includes('разгон') || text.includes('ожив')) return 7;
      if (text.includes('сред') || text.includes('норм')) return 5;
      if (text.includes('низ') || text.includes('вял') || text.includes('желе') || text.includes('просад')) return 4;
      if (text.includes('нет сил') || text.includes('без сил') || text.includes('истощ')) return 3;
    } else {
      if (text.includes('хорош') || text.includes('позитив') || text.includes('спокой')) return 7;
      if (text.includes('смеш') || text.includes('норм') || text.includes('нейтрал')) return 6;
      if (text.includes('низ') || text.includes('груст') || text.includes('раздраж') || text.includes('трев')) return 4;
    }
    return null;
  }
  function metricScore(entry, kind = 'mood') {
    if (!entry) return '—';
    const siteBlocks = entry.site_blocks || {};
    const state = entry.state || {};
    const candidates = kind === 'energy'
      ? [siteBlocks.energy_score, state.energy_score, state.energy, siteBlocks.energy]
      : [siteBlocks.mood_score, state.mood_score, entry.kira_score, entry.score, siteBlocks.mood, state.mood_now];
    for (const candidate of candidates) {
      const n = metricNumber(candidate, kind);
      if (n != null && !Number.isNaN(n)) return String(n);
    }
    return '—';
  }

  const now = new Date();
  const todayKey = dateKey(now);
  const todayWord = wordFor(todayKey);
  const MONTH_STORAGE_KEY = 'kiraDiary.visibleMonth';

  function saveVisibleMonth(state) {
    try { localStorage.setItem(MONTH_STORAGE_KEY, JSON.stringify({ y: state.y, m: state.m })); } catch (_) {}
  }
  function readVisibleMonth() {
    try {
      const saved = JSON.parse(localStorage.getItem(MONTH_STORAGE_KEY) || 'null');
      if (saved && Number.isInteger(saved.y) && Number.isInteger(saved.m) && saved.m >= 0 && saved.m <= 11) return saved;
    } catch (_) {}
    return null;
  }
  const overlayHtml = `
    <main id="kira-overlay" class="phone-frame" aria-label="Дневник">
      <section class="hero-scene">
        <div class="grain"></div>
        <div class="liquid-object kira-bg-orb" aria-hidden="true"><span class="liquid-core"></span><span class="liquid-rim"></span><span class="liquid-glare"></span></div>
        <div class="kira-scroll">
          <header class="topbar">
            <div>
              <h1 data-title hidden></h1>
              <p class="screen-subtitle" data-subtitle>Автодневник · зеркало дня</p>
            </div>
          </header>

          <section class="kira-screen is-active" data-screen="home">
            <section class="score-card glass main-card empty-state-card">
              <div class="score-head">
                <div>
                  <p class="label">Погода · Ишим</p>
                  <div class="weather-main" data-weather-main>обновляю…</div>
                  <div class="weather-meta" data-weather-meta>ощущается · ветер</div>
                </div>
                <div class="score-pill weather-pill" data-weather-time>сейчас</div>
              </div>
              <div class="wave is-empty"><span></span><span></span><span></span><i class="dot dot-l"></i><i class="dot dot-r"></i></div>
            </section>

            <section class="daily-pair" aria-label="Сводка дня">
              <article class="glass tile compact-tile"><span class="tile-icon icon-wake"></span><p>Настроение</p><strong data-tile-mood>—</strong></article>
              <article class="glass tile compact-tile"><span class="tile-icon icon-sleep"></span><p>Энергия</p><strong data-tile-energy>—</strong></article>
            </section>

            <section class="month-card glass">
              <div class="month-head"><div><p class="label" data-month-name>${monthNames[now.getMonth()]}</p><strong data-month-status>Нет записей</strong></div><div class="month-nav"><button type="button" data-month-prev aria-label="Предыдущий месяц">‹</button><button type="button" data-month-next aria-label="Следующий месяц">›</button></div></div>
              <div class="dot-calendar real-month-dots" data-month-dots aria-label="заполненность месяца"></div>
            </section>
          </section>

          <section class="kira-screen" data-screen="health">
            <section class="health-card glass">
              <div class="month-head"><div><p class="label">Здоровье</p><strong data-health-month>${monthNames[now.getMonth()]} · календарь</strong></div><div class="month-nav"><button type="button" data-health-prev aria-label="Предыдущий месяц">‹</button><button type="button" data-health-next aria-label="Следующий месяц">›</button></div></div>
              <div class="health-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
              <div class="health-calendar" data-health-calendar></div>
            </section>

            <section class="stats-grid health-summary-grid" data-health-stats>
              <article class="glass stat-card" data-health-stat="mood"><p>Настроение</p><strong>—</strong><span>Появится после записей.</span></article>
              <article class="glass stat-card" data-health-stat="sleep-energy"><p>Сон → энергия</p><strong>—</strong><span>Нужно больше данных.</span></article>
              <article class="glass stat-card" data-health-stat="stress"><p>Стресс</p><strong>—</strong><span>Пока паттернов нет.</span></article>
              <article class="glass stat-card" data-health-stat="helps"><p>Что помогает</p><strong>—</strong><span>Кира найдёт повторяющиеся опоры.</span></article>
            </section>

            <section class="health-detail glass diary-text-card" data-health-detail>
              <p class="label">День</p>
              <strong>Нет данных</strong>
              <span>Когда появится запись, здесь будет дневниковый текст выбранного дня.</span>
            </section>
          </section>

          <section class="kira-screen" data-screen="work">
            <section class="work-summary-grid" data-work-summary></section>
            <section class="work-section" data-work-now></section>
            <section class="work-section" data-work-projects></section>
            <section class="work-section" data-work-diary></section>
            <section class="work-add-project">
              <button class="work-add-project-button" type="button" data-work-add-project>＋ Добавить проект</button>
              <form class="glass work-project-form" data-work-project-form hidden>
                <label>Название проекта<input name="title" type="text" maxlength="90" required placeholder="Например, новый бот"></label>
                <label>Что нужно<textarea name="needs" maxlength="500" required placeholder="Коротко: что сделать, чего ждём или с чего начать"></textarea></label>
                <div class="work-form-actions"><button type="submit">Добавить</button><button type="button" data-work-cancel-project>Отмена</button></div>
                <small>Сохранится на этом устройстве. Для общей базы добавь через Киру.</small>
              </form>
            </section>
            <section class="work-section work-readonly-note glass"><p class="label">Как добавить</p><strong>Через Kira / чат</strong><span>Задачи синхронизируются из data/projects.json. На статичном сайте нельзя сохранять их прямо из браузера.</span></section>
          </section>

          <section class="kira-screen" data-screen="kira">
            <section class="health-card glass"><p class="label">Кира</p><strong>Автоподхват</strong><p class="plain-text">Если в сообщении или голосовом есть дневник, день, настроение, сон, стресс или здоровье — Кира должна перенести это в нужную дату.</p><div class="agent-flow"><span>текст/голос</span><i></i><span>анализ</span><i></i><span>дневник</span></div></section>
            <section class="health-detail glass"><p class="label">Готово для связки</p><strong>KiraDiaryBridge</strong><span>Позже подключим реальный автосейв из чата.</span></section>
          </section>

          <section class="kira-screen" data-screen="system">
            <section class="health-card glass"><p class="label">Система</p><strong>Настройки</strong><p class="plain-text">Здесь позже будут экспорт, импорт, бэкап и параметры дневника.</p></section>
          </section>
        </div>

        <nav class="multitool-nav" aria-label="Навигация">
          <button class="multitool-item is-active" type="button" aria-label="Главная" data-tab="home"><svg class="mt-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M6.5 10.2v8.3h11v-8.3"/><path d="M10 18.5v-5h4v5"/></svg><span>Главная</span></button>
          <button class="multitool-item" type="button" aria-label="Здоровье" data-tab="health"><svg class="mt-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7.8c0 5.2-8 10.2-8 10.2S4 13 4 7.8A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 1.8Z"/><path d="M8 12h2.2l1-2.5 1.7 5 1.1-2.5H16"/></svg><span>Здоровье</span></button>
          <button class="multitool-item" type="button" aria-label="Работа" data-tab="work"><svg class="mt-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/></svg><span>Работа</span></button>
          <button class="multitool-item" type="button" aria-label="Кира" data-tab="kira"><svg class="mt-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"/></svg><span>Кира</span></button>
          <button class="multitool-item" type="button" aria-label="Система" data-tab="system"><svg class="mt-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 7.4v8.2l-7 4.9-7-4.9V7.4z"/><path d="M5.4 7.8 12 11.8l6.6-4"/><path d="M12 11.8v8.1"/></svg><span>Система</span></button>
        </nav>
      </section>
    </main>`;


  async function updateWeather(overlay) {
    const main = overlay.querySelector('[data-weather-main]');
    const meta = overlay.querySelector('[data-weather-meta]');
    const time = overlay.querySelector('[data-weather-time]');
    if (!main || !meta) return;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=56.1128&longitude=69.4902&current=temperature_2m,apparent_temperature,wind_speed_10m&timezone=Asia%2FYekaterinburg';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('weather http ' + res.status);
      const data = await res.json();
      const c = data.current || {};
      const temp = Math.round(c.temperature_2m);
      const feels = Math.round(c.apparent_temperature);
      const wind = Math.round(c.wind_speed_10m / 3.6);
      main.textContent = `${temp > 0 ? '+' : ''}${temp}°`;
      meta.textContent = `ощущается ${feels > 0 ? '+' : ''}${feels}° · ветер ${wind} м/с`;
      if (time) time.textContent = 'Ишим';
    } catch (err) {
      main.textContent = 'погода недоступна';
      meta.textContent = 'проверь соединение · Ишим';
      if (time) time.textContent = 'онлайн';
    }
  }

  function renderMonthDots(root, y, m) {
    let html = '';
    const total = daysInMonth(y, m);
    for (let d = 1; d <= total; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = !!entryStore[k];
      html += `<i class="${entry ? 'filled' : 'empty'}" title="${k}"></i>`;
    }
    root.innerHTML = html;
  }

  function renderCalendar(root, y, m) {
    let html = '';
    for (let i = 0; i < monthOffset(y, m); i++) html += '<span class="cal-spacer"></span>';
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const filled = !!entryStore[k];
      html += `<button type="button" class="health-day ${filled ? 'has-entry' : ''}" data-date="${k}"><b>${d}</b>${filled ? '<i></i>' : ''}</button>`;
    }
    root.innerHTML = html;
  }


  function diaryText(entry) {
    return entry?.diary_text || entry?.edited_text || entry?.raw_transcript || site(entry, 'health_detail', 'Данные сохранены.');
  }

  function listToHtml(items) {
    if (!items) return '';
    const arr = Array.isArray(items) ? items : [items];
    return arr.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function manualEntriesHtml(entry) {
    const candidates = [
      ...(Array.isArray(entry?.manual_entries) ? entry.manual_entries : []),
      ...(Array.isArray(entry?.user_entries) ? entry.user_entries : []),
      ...(Array.isArray(entry?.notes_manual) ? entry.notes_manual : []),
      ...(entry?.text ? [entry.text] : [])
    ].filter(Boolean);
    const raw = entry?.raw_transcript && !String(entry.raw_transcript).startsWith('Read-only Telegram backfill') && !String(entry.raw_transcript).startsWith('Восстановлено по read-only Telegram-сбору')
      ? String(entry.raw_transcript).trim()
      : '';
    const items = candidates.length ? candidates : (raw ? [raw] : []);
    return items.length ? listToHtml(items) : '<li class="muted">Пока нет отдельных ручных записей за день.</li>';
  }

  function autoNotesHtml(entry) {
    const items = [
      ...(Array.isArray(entry?.events) ? entry.events : []),
      ...(Array.isArray(entry?.work?.done) ? entry.work.done : []),
      ...(Array.isArray(entry?.health?.notes) ? entry.health.notes : []),
      ...(Array.isArray(entry?.needs) ? entry.needs.map((x) => `Нужно: ${x}`) : [])
    ].filter(Boolean).slice(0, 10);
    return items.length ? listToHtml(items) : '<li class="muted">Автозаметок пока нет.</li>';
  }

  function renderEntryDetail(detail, entry, date) {
    if (!entry) {
      detail.innerHTML = `<p class="label">${date}</p><strong>Нет записи</strong><span>Этот день пока пустой.</span>`;
      return;
    }
    detail.innerHTML = `
      <details class="entry-collapse">
        <summary>
          <span><em>${escapeHtml(date)}</em><strong>${escapeHtml(site(entry, 'mood', 'Запись есть'))}</strong></span>
          <b>открыть</b>
        </summary>
        <div class="entry-section entry-auto">
          <p class="label">Автозаметки</p>
          <ul>${autoNotesHtml(entry)}</ul>
        </div>
        <div class="entry-section entry-manual">
          <p class="label">Мои записи</p>
          <ul>${manualEntriesHtml(entry)}</ul>
        </div>
        <div class="entry-section entry-full">
          <p class="label">Итог дня</p>
          <span>${escapeHtml(diaryText(entry))}</span>
        </div>
      </details>`;
  }

  function setHealthStat(overlay, key, value, note) {
    const card = overlay.querySelector(`[data-health-stat="${key}"]`);
    if (!card) return;
    const strong = card.querySelector('strong');
    const span = card.querySelector('span');
    if (strong) strong.textContent = value || '—';
    if (span) span.textContent = note || 'Нет данных.';
  }

  function shortStress(value) {
    const text = String(value || '').toLowerCase();
    if (!text) return '—';
    if (text.includes('высок')) return 'высокий';
    if (text.includes('сред')) return 'средний';
    if (text.includes('низ')) return 'низкий';
    return String(value).split(/[,.]/)[0].trim() || 'есть';
  }

  function countListLike(value) {
    if (Array.isArray(value)) return value.length;
    if (!value) return 0;
    return String(value).split(/[,;·]/).map((x) => x.trim()).filter(Boolean).length;
  }

  function renderHealthStats(overlay, entry) {
    const statsRoot = overlay.querySelector('[data-health-stats]');
    if (!entry) {
      if (statsRoot) statsRoot.classList.add('is-empty');
      setHealthStat(overlay, 'mood', '—', 'Появится после записей.');
      setHealthStat(overlay, 'sleep-energy', '—', 'Нужно больше данных.');
      setHealthStat(overlay, 'stress', '—', 'Пока паттернов нет.');
      setHealthStat(overlay, 'helps', '—', 'Кира найдёт повторяющиеся опоры.');
      return;
    }
    if (statsRoot) statsRoot.classList.remove('is-empty');

    const score = entry.kira_score ?? entry.score;
    const sleep = entry.sleep || {};
    const siteBlocks = entry.site_blocks || {};
    const moodValue = siteBlocks.mood_score || (score == null ? '—' : String(score));
    const moodNote = siteBlocks.mood || [entry.state?.mood_morning, entry.state?.mood_evening].filter(Boolean).join(' → ') || 'Настроение сохранено.';
    const sleepDuration = sleep.duration_hours;
    const sleepLabel = sleepDuration
      ? (/^\d+(\.\d+)?$/.test(String(sleepDuration)) ? `${sleepDuration}ч` : String(sleepDuration))
      : '';
    const sleepValue = sleepLabel ? `${sleepLabel} / ${siteBlocks.energy_score || '—'}` : (siteBlocks.energy_score || '—');
    const sleepNote = [sleep.sleep_time && sleep.wake_time ? `${sleep.sleep_time}–${sleep.wake_time}` : '', siteBlocks.energy || sleep.quality || ''].filter(Boolean).join(' · ') || 'Нет данных по сну.';
    const stressNote = siteBlocks.stress || entry.state?.stress || 'Нет данных по стрессу.';
    const helps = siteBlocks.what_helps || '';
    const helpsCount = countListLike(helps);

    setHealthStat(overlay, 'mood', moodValue, moodNote);
    setHealthStat(overlay, 'sleep-energy', sleepValue, sleepNote);
    setHealthStat(overlay, 'stress', shortStress(stressNote), stressNote);
    setHealthStat(overlay, 'helps', helpsCount ? `${helpsCount} опоры` : '—', helps || 'Пока опоры не выделены.');
  }

  function renderToday(overlay, y, m) {
    const summaryEntry = latestCompletedEntry();
    const monthEntries = entriesForMonth(y, m);
    const status = overlay.querySelector('[data-month-status]');
    const monthName = overlay.querySelector('[data-month-name]');
    const healthMonth = overlay.querySelector('[data-health-month]');
    if (monthName) monthName.textContent = `${monthNames[m]} ${y}`;
    if (healthMonth) healthMonth.textContent = `${monthNames[m]} ${y} · календарь`;
    if (status) status.textContent = monthEntries.length ? `${monthEntries.length} записей` : 'Нет записей';
    const moodTile = overlay.querySelector('[data-tile-mood]');
    const energyTile = overlay.querySelector('[data-tile-energy]');
    const neededTile = overlay.querySelector('[data-tile-needed]');
    if (moodTile) moodTile.textContent = metricScore(summaryEntry, 'mood');
    if (energyTile) energyTile.textContent = metricScore(summaryEntry, 'energy');
    if (neededTile) neededTile.textContent = site(summaryEntry, 'needed_score', summaryEntry?.needs_score ?? '—');
    renderHealthStats(overlay, summaryEntry);
  }

  function addMonths(y, m, delta) {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function latestEntryInMonth(y, m) {
    return entriesForMonth(y, m).at(-1) || null;
  }

  function renderVisibleMonth(overlay, calendar, dots, detail, state, preferredDate = null) {
    const { y, m } = state;
    renderCalendar(calendar, y, m);
    renderMonthDots(dots, y, m);
    renderToday(overlay, y, m);

    const selectedDate = preferredDate && entryStore[preferredDate]
      ? preferredDate
      : latestEntryInMonth(y, m)?.date || `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const activeDay = calendar.querySelector(`[data-date="${selectedDate}"]`);
    if (activeDay) activeDay.classList.add('selected');
    const selectedEntry = entryStore[selectedDate];
    renderEntryDetail(detail, selectedEntry, selectedDate);
    renderHealthStats(overlay, selectedEntry || latestEntryInMonth(y, m));
  }

  const projectStatusLabel = { active: 'В работе', waiting: 'Жду', paused: 'На паузе', archived: 'Архив' };
  const taskStatusLabel = { inbox: 'Входящие', today: 'Сегодня', in_progress: 'В работе', waiting: 'Жду', done: 'Готово' };
  function workSection(title, content) { return `<p class="label">${title}</p>${content}`; }
  function workTaskHtml(item) {
    const project = item.project || {};
    const task = item.task || item;
    return `<li class="work-task"><span><b>${escapeHtml(task.title)}</b><em>${escapeHtml(project.title || '')}</em></span><i>${escapeHtml(taskStatusLabel[task.status] || task.status)}</i></li>`;
  }
  function taskItemsHtml(tasks, project, emptyText) {
    return tasks.length
      ? `<ul class="work-list">${tasks.map((task) => workTaskHtml({ project, task })).join('')}</ul>`
      : `<p class="work-empty">${emptyText}</p>`;
  }
  function renderWork(overlay) {
    const summaryRoot = overlay.querySelector('[data-work-summary]');
    const nowRoot = overlay.querySelector('[data-work-now]');
    const projectsRoot = overlay.querySelector('[data-work-projects]');
    const diaryRoot = overlay.querySelector('[data-work-diary]');
    if (!summaryRoot || !nowRoot || !projectsRoot || !diaryRoot || !projectApi) return;
    const summary = projectApi.summarizeProjects(projectStore);
    summaryRoot.innerHTML = [
      ['Проекты', projectStore.length], ['В работе', summary.inProgressTasks], ['Жду', summary.blockers], ['Готово', projectStore.reduce((count, project) => count + projectApi.projectProgress(project).done, 0)]
    ].map(([label, value]) => `<article class="glass work-metric"><p>${label}</p><strong>${value}</strong></article>`).join('');
    nowRoot.hidden = true;
    diaryRoot.hidden = true;
    projectsRoot.innerHTML = workSection('Главные проекты', projectStore.length
      ? `<div class="work-project-list">${projectStore.map((project) => {
        const progress = projectApi.projectProgress(project);
        const doneTasks = project.tasks.filter((task) => task.status === 'done');
        const nextTasks = project.tasks.filter((task) => task.status !== 'done');
        const doneText = doneTasks[0]?.title || 'Пока нет завершённых шагов';
        const nextText = nextTasks[0]?.title || project.next_action || 'Следующий шаг не задан';
        const blocker = project.blockers[0] || '';
        return `<details class="glass work-project"><summary><span class="work-project-title"><b>${escapeHtml(project.title)}</b><em>${escapeHtml(projectStatusLabel[project.status] || project.status)}</em></span><span class="work-project-brief"><span><small>Сделано</small><b>${escapeHtml(doneText)}</b></span><span><small>${blocker ? 'Ждём' : 'Дальше'}</small><b>${escapeHtml(blocker || nextText)}</b></span></span><i class="work-project-open">Подробнее</i></summary><div class="work-project-detail"><p class="work-description">${escapeHtml(project.description || '')}</p>${project.next_action ? `<p class="work-next"><small>Ближайшее действие</small>${escapeHtml(project.next_action)}</p>` : ''}<div class="work-detail-grid"><section><h3>Сделано · ${progress.done}</h3>${taskItemsHtml(doneTasks, project, 'Пока нет завершённых задач.')}</section><section><h3>Дальше · ${progress.remaining}</h3>${taskItemsHtml(nextTasks, project, 'Следующих задач пока нет.')}</section></div>${blocker ? `<p class="work-blocker"><small>Ожидание / блокер</small>${escapeHtml(blocker)}</p>` : ''}<h3>Контекст</h3><ul class="work-decisions">${project.decisions.length ? project.decisions.map((item) => `<li><small>${escapeHtml(item.date)}</small>${escapeHtml(item.text)}</li>`).join('') : '<li class="work-empty">Заметок пока нет.</li>'}</ul><button type="button" class="work-edit-project" data-work-edit-project="${escapeHtml(project.id)}">Редактировать</button></div></details>`;
      }).join('')}</div>`
      : '<p class="work-empty">Проектов пока нет. Добавь их через Kira/обновление data/projects.json.</p>');
  }

  async function mountOverlay() {
    document.title = 'Kira Diary';
    document.querySelectorAll('#kira-overlay').forEach((node) => node.remove());
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
    document.body.classList.add('kira-mode');

    const overlay = document.querySelector('#kira-overlay');
    const title = overlay.querySelector('[data-title]');
    const subtitle = overlay.querySelector('[data-subtitle]');
    const calendar = overlay.querySelector('[data-health-calendar]');
    const dots = overlay.querySelector('[data-month-dots]');
    const detail = overlay.querySelector('[data-health-detail]');
    let visibleMonth = readVisibleMonth() || { y: now.getFullYear(), m: now.getMonth() };

    const [entries, projects] = await Promise.all([loadEntries(), loadProjects()]);
    Object.assign(entryStore, entries);
    projectStore = [...mergeProjectOverrides(projects), ...readLocalProjects()];
    renderWork(overlay);
    const addProjectButton = overlay.querySelector('[data-work-add-project]');
    const projectForm = overlay.querySelector('[data-work-project-form]');
    const cancelProjectButton = overlay.querySelector('[data-work-cancel-project]');
    const projectsRoot = overlay.querySelector('[data-work-projects]');
    const formSubmitButton = projectForm?.querySelector('[type="submit"]');
    function closeProjectForm() {
      projectForm.reset();
      delete projectForm.dataset.editProjectId;
      projectForm.hidden = true;
      addProjectButton.hidden = false;
      formSubmitButton.textContent = 'Добавить';
    }
    function openProjectForm(project = null) {
      projectForm.hidden = false;
      addProjectButton.hidden = true;
      if (project) {
        projectForm.dataset.editProjectId = project.id;
        projectForm.querySelector('[name="title"]').value = project.title;
        projectForm.querySelector('[name="needs"]').value = project.description || project.next_action || '';
        formSubmitButton.textContent = 'Сохранить';
      } else {
        projectForm.reset();
        delete projectForm.dataset.editProjectId;
        formSubmitButton.textContent = 'Добавить';
      }
      projectForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      projectForm.querySelector('[name="title"]')?.focus();
    }
    addProjectButton?.addEventListener('click', () => openProjectForm());
    cancelProjectButton?.addEventListener('click', closeProjectForm);
    projectsRoot?.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-work-edit-project]');
      if (!editButton) return;
      event.preventDefault();
      openProjectForm(projectStore.find((project) => project.id === editButton.dataset.workEditProject));
    });
    projectForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(projectForm);
      const title = String(formData.get('title') || '').trim();
      const needs = String(formData.get('needs') || '').trim();
      const editingId = projectForm.dataset.editProjectId;
      if (!title || !needs) return;
      if (editingId) {
        const index = projectStore.findIndex((project) => project.id === editingId);
        if (index < 0) return;
        const updated = projectApi.normalizeProjects({ projects: [{ ...projectStore[index], title, description: needs, next_action: needs }] })[0];
        if (!saveProjectEdit(updated)) return;
        projectStore[index] = updated;
      } else {
        const project = addLocalProject(title, needs);
        if (!project) return;
        projectStore.push(project);
      }
      renderWork(overlay);
      closeProjectForm();
      overlay.querySelector('[data-work-projects]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const todayEntryForHealth = entryStore[todayKey] || entryList().at(-1);

    if (!readVisibleMonth() && todayEntryForHealth) {
      const entryDate = new Date(`${todayEntryForHealth.date}T00:00:00`);
      if (!Number.isNaN(entryDate.getTime())) {
        visibleMonth = { y: entryDate.getFullYear(), m: entryDate.getMonth() };
      }
    }
    saveVisibleMonth(visibleMonth);
    renderVisibleMonth(overlay, calendar, dots, detail, visibleMonth, todayEntryForHealth?.date);
    updateWeather(overlay);
    setInterval(() => updateWeather(overlay), 10 * 60 * 1000);

    const titles = {
      home: ['', 'Автодневник · зеркало дня'],
      health: ['Здоровье', 'Календарь · паттерны · тело'],
      work: ['Работа', 'Проекты · задачи · действия'],
      kira: ['Кира', 'Логика автоподхвата'],
      system: ['Система', 'Настройки · бэкап']
    };

    overlay.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        overlay.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
        overlay.querySelectorAll('[data-screen]').forEach(s => s.classList.toggle('is-active', s.dataset.screen === tab));
        title.textContent = titles[tab][0];
        subtitle.textContent = titles[tab][1];
        overlay.querySelector('.kira-scroll').scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    overlay.querySelectorAll('[data-month-prev], [data-health-prev]').forEach((btn) => {
      btn.addEventListener('click', () => {
        visibleMonth = addMonths(visibleMonth.y, visibleMonth.m, -1);
        saveVisibleMonth(visibleMonth);
        renderVisibleMonth(overlay, calendar, dots, detail, visibleMonth);
      });
    });
    overlay.querySelectorAll('[data-month-next], [data-health-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        visibleMonth = addMonths(visibleMonth.y, visibleMonth.m, 1);
        saveVisibleMonth(visibleMonth);
        renderVisibleMonth(overlay, calendar, dots, detail, visibleMonth);
      });
    });

    calendar.addEventListener('click', (e) => {
      const day = e.target.closest('.health-day');
      if (!day) return;
      calendar.querySelectorAll('.health-day').forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
      const selectedEntry = entryStore[day.dataset.date];
      renderEntryDetail(detail, selectedEntry, day.dataset.date);
      renderHealthStats(overlay, selectedEntry);
    });

    window.KiraDiaryBridge = {
      version: 2,
      getEntries: () => structuredClone(entryStore),
      addEntryFromText: (text, date = dateKey()) => {
        entryStore[date] = { text: String(text).slice(0, 500), createdAt: new Date().toISOString() };
        renderCalendar(calendar, visibleMonth.y, visibleMonth.m);
        renderMonthDots(dots, visibleMonth.y, visibleMonth.m);
        renderToday(overlay, visibleMonth.y, visibleMonth.m);
        window.dispatchEvent(new CustomEvent('kira:diary-entry-added', { detail: { date, text } }));
        return entryStore[date];
      }
    };
  }

  if (document.body) mountOverlay();
  else document.addEventListener('DOMContentLoaded', mountOverlay);
})();
