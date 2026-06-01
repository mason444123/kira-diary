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
  const DATA_URL = 'data/entries.json';

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

  const now = new Date();
  const todayKey = dateKey(now);
  const todayWord = wordFor(todayKey);
  const MONTH_STORAGE_KEY = 'kiraDiary.visibleMonth';
  const HABIT_STORAGE_KEY = 'kiraDiary.habits.v1';
  const habitDefs = [
    { id: 'supplements', label: 'Выпил БАД', text: 'БАД' },
    { id: 'gym', label: 'Зал отмечен', text: 'Зал' },
    { id: 'money', label: 'Деньги отмечены', text: 'Деньги' }
  ];
  const habitClassMap = {
    supplements: 'habit-bad',
    gym: 'habit-gym',
    money: 'habit-money'
  };

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
  function readHabits() {
    try { return JSON.parse(localStorage.getItem(HABIT_STORAGE_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function writeHabits(state) {
    try { localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
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

            <section class="habit-orbs" aria-label="Быстрые отметки дня">
              ${habitDefs.map((habit) => `<button class="habit-orb" type="button" data-habit="${habit.id}" aria-label="${habit.label}"><span class="habit-orb__glow"></span><span class="habit-text" aria-hidden="true">${habit.text}</span></button>`).join('')}
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
      const wind = Math.round(c.wind_speed_10m);
      main.textContent = `${temp > 0 ? '+' : ''}${temp}°`;
      meta.textContent = `ощущается ${feels > 0 ? '+' : ''}${feels}° · ветер ${wind} км/ч`;
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
    const habitState = readHabits();
    for (let d = 1; d <= total; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = !!entryStore[k];
      const habits = habitState[k] || {};
      const habitClasses = Object.keys(habits)
        .filter((id) => habits[id] && habitClassMap[id])
        .map((id) => habitClassMap[id])
        .join(' ');
      html += `<i class="${entry ? 'filled' : 'empty'} ${habitClasses}" title="${k}"></i>`;
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

  function renderEntryDetail(detail, entry, date) {
    if (!entry) {
      detail.innerHTML = `<p class="label">${date}</p><strong>Нет записи</strong><span>Этот день пока пустой.</span>`;
      return;
    }
    detail.innerHTML = `
      <p class="label">${escapeHtml(date)}</p>
      <strong>${escapeHtml(site(entry, 'mood', 'Запись есть'))}</strong>
      <span>${escapeHtml(diaryText(entry))}</span>`;
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
    const todayEntry = entryStore[todayKey] || entryList().at(-1);
    const monthEntries = entriesForMonth(y, m);
    const status = overlay.querySelector('[data-month-status]');
    const monthName = overlay.querySelector('[data-month-name]');
    const healthMonth = overlay.querySelector('[data-health-month]');
    const score = todayEntry?.kira_score ?? todayEntry?.score;
    if (monthName) monthName.textContent = `${monthNames[m]} ${y}`;
    if (healthMonth) healthMonth.textContent = `${monthNames[m]} ${y} · календарь`;
    if (status) status.textContent = monthEntries.length ? `${monthEntries.length} записей` : 'Нет записей';
    const moodTile = overlay.querySelector('[data-tile-mood]');
    const energyTile = overlay.querySelector('[data-tile-energy]');
    const neededTile = overlay.querySelector('[data-tile-needed]');
    if (moodTile) moodTile.textContent = site(todayEntry, 'mood_score', score == null ? '—' : String(score));
    if (energyTile) energyTile.textContent = site(todayEntry, 'energy_score', todayEntry?.state?.energy_score ?? '—');
    if (neededTile) neededTile.textContent = site(todayEntry, 'needed_score', todayEntry?.needs_score ?? '—');
    renderHealthStats(overlay, todayEntry);
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
    const habitState = readHabits();

    Object.assign(entryStore, await loadEntries());
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

    function renderHabits() {
      overlay.querySelectorAll('[data-habit]').forEach((btn) => {
        const active = !!habitState?.[todayKey]?.[btn.dataset.habit];
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    overlay.querySelectorAll('[data-habit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        habitState[todayKey] = habitState[todayKey] || {};
        habitState[todayKey][btn.dataset.habit] = !habitState[todayKey][btn.dataset.habit];
        writeHabits(habitState);
        btn.classList.add('is-popping');
        window.setTimeout(() => btn.classList.remove('is-popping'), 420);
        renderHabits();
        renderMonthDots(dots, visibleMonth.y, visibleMonth.m);
      });
    });
    renderHabits();

    const rerenderMonth = renderVisibleMonth;
    renderVisibleMonth = (...args) => {
      rerenderMonth(...args);
      renderHabits();
    };

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
