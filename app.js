/* ============================================================
   学习记录平台  LearnLog
   纯前端 / localStorage 持久化 / 无需联网 / 可安装可离线(PWA)
   ============================================================ */

const DATA_KEY = 'learnlog_data_v1';
const SET_KEY = 'learnlog_settings_v1';
const TPL_KEY = 'learnlog_templates_v1';
const BADGE_KEY = 'learnlog_badges_v1';
const HABIT_KEY = 'learnlog_habits_v1';
const GOAL_KEY = 'learnlog_goals_v1';
const BACKUP_KEY = 'learnlog_autobackup_v1';
const SESSION_KEY = 'learnlog_sessions_v1';
const RECUR_KEY = 'learnlog_recurring_v1';
const MAX_BACKUPS = 7;
const CAT_PALETTE = ['#3b6cf6', '#2ea121', '#ff8800', '#a855f7', '#ec4899', '#14b8a6', '#f53f3f', '#64748b'];
const ACCENT_PRESETS = ['#3b6cf6', '#7c4dff', '#e0408a', '#1aa179', '#f5871f', '#0ea5b7', '#e5484d', '#475569'];

/* ---------- 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function weekdayCN(s) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[parseDate(s).getDay()];
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 存储层 ---------- */
function loadData() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY)) || {}; }
  catch { return {}; }
}
function saveData(data) { localStorage.setItem(DATA_KEY, JSON.stringify(data)); scheduleAutoSnapshot(); }
function loadSettings() {
  const def = { theme: 'light', accent: '#3b6cf6', categories: ['学习', '工作', '生活', '健身'], catColors: {}, focusMin: 25, breakMin: 5, dailyGoal: 0, weeklyGoal: 0, soundOn: true, onboarded: false };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(SET_KEY)) || {}) }; }
  catch { return def; }
}
function ensureCatColors() {
  const cats = state.settings.categories;
  cats.forEach((c, i) => {
    if (!state.settings.catColors[c]) state.settings.catColors[c] = CAT_PALETTE[i % CAT_PALETTE.length];
  });
  saveSettings(state.settings);
}
function saveSettings(s) { localStorage.setItem(SET_KEY, JSON.stringify(s)); scheduleAutoSnapshot(); }
function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TPL_KEY)) || []; }
  catch { return []; }
}
function saveTemplates(arr) { localStorage.setItem(TPL_KEY, JSON.stringify(arr)); scheduleAutoSnapshot(); }
function loadBadges() {
  try { return JSON.parse(localStorage.getItem(BADGE_KEY)) || { earned: [] }; }
  catch { return { earned: [] }; }
}
function saveBadges(b) { localStorage.setItem(BADGE_KEY, JSON.stringify(b)); scheduleAutoSnapshot(); }
function loadHabits() {
  try { return JSON.parse(localStorage.getItem(HABIT_KEY)) || defaultHabits(); }
  catch { return defaultHabits(); }
}
function saveHabits(arr) { localStorage.setItem(HABIT_KEY, JSON.stringify(arr)); scheduleAutoSnapshot(); }
function defaultHabits() {
  return [
    { id: uid(), name: '背单词', created: fmtDate(new Date()) },
    { id: uid(), name: '阅读 30 分钟', created: fmtDate(new Date()) },
    { id: uid(), name: '运动', created: fmtDate(new Date()) },
  ];
}
function getDayHabits(dateStr) {
  const day = getDay(dateStr);
  if (!day.habits) day.habits = {};
  return day.habits;
}
function loadGoals() {
  try { return JSON.parse(localStorage.getItem(GOAL_KEY)) || []; }
  catch { return []; }
}
function saveGoals(arr) { localStorage.setItem(GOAL_KEY, JSON.stringify(arr)); scheduleAutoSnapshot(); }
function loadRecurring() {
  try { return JSON.parse(localStorage.getItem(RECUR_KEY)) || []; }
  catch { return []; }
}
function saveRecurring(arr) { localStorage.setItem(RECUR_KEY, JSON.stringify(arr)); scheduleAutoSnapshot(); }

/* ---------- 专注记录（番茄日志） ---------- */
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || []; }
  catch { return []; }
}
function saveSessions(arr) { localStorage.setItem(SESSION_KEY, JSON.stringify(arr)); }
// 每次专注块完成写入一条记录，最近 500 条上限，避免无限增长
function recordFocusSession(duration, cat, taskId, title) {
  const arr = loadSessions();
  arr.push({ id: uid(), date: fmtDate(new Date()), ts: Date.now(), duration, cat, taskId: taskId || '', title: title || '' });
  if (arr.length > 500) arr.splice(0, arr.length - 500);
  saveSessions(arr);
}

/* ============================================================
   数据保险箱（浏览器内自动滚动备份，防 localStorage 误清）
   ============================================================ */
function loadBackups() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || []; }
  catch { return []; }
}
function saveBackups(arr) { localStorage.setItem(BACKUP_KEY, JSON.stringify(arr)); }
function snapshotAll() {
  return {
    [DATA_KEY]: localStorage.getItem(DATA_KEY),
    [SET_KEY]: localStorage.getItem(SET_KEY),
    [TPL_KEY]: localStorage.getItem(TPL_KEY),
    [BADGE_KEY]: localStorage.getItem(BADGE_KEY),
    [HABIT_KEY]: localStorage.getItem(HABIT_KEY),
    [GOAL_KEY]: localStorage.getItem(GOAL_KEY),
  };
}
function saveSnapshot(label) {
  const snap = { ts: Date.now(), date: fmtDate(new Date()), label: label || 'manual', data: snapshotAll() };
  const arr = loadBackups();
  arr.unshift(snap);
  while (arr.length > MAX_BACKUPS) arr.pop();
  saveBackups(arr);
  return snap;
}
let _snapTimer = null;
function scheduleAutoSnapshot() {
  if (_snapTimer) return;
  _snapTimer = setTimeout(() => {
    _snapTimer = null;
    const arr = loadBackups();
    const today = fmtDate(new Date());
    if (!arr.some(s => s.date === today && s.label === 'auto')) saveSnapshot('auto');
  }, 4000);
}
function restoreSnapshot(ts) {
  const snap = loadBackups().find(s => s.ts === ts);
  if (!snap) return;
  if (!confirm('恢复到 ' + new Date(snap.ts).toLocaleString('zh-CN') + ' 的备份？当前未备份的数据会被覆盖。')) return;
  Object.entries(snap.data).forEach(([k, v]) => {
    if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v);
  });
  reloadState();
  toast('已恢复到 ' + snap.date + ' 的备份');
  renderBackupList();
}
function deleteSnapshot(ts) {
  saveBackups(loadBackups().filter(s => s.ts !== ts));
  renderBackupList();
}
function reloadState() {
  state.settings = loadSettings();
  state.recurring = loadRecurring();
  ensureCatColors();
  refreshCategorySelect();
  renderAll();
  renderHabits();
  renderGoals();
  renderStats();
  renderBackupList();
  if (typeof bindTimer === 'function') bindTimer();
}
function openOnboard() { $('#onboardModal').hidden = false; }
function finishOnboarding() {
  state.settings.onboarded = true;
  saveSettings(state.settings);
  $('#onboardModal').hidden = true;
}
function openBackupModal() {
  $('#backupModal').hidden = false;
  renderBackupList();
}
function renderBackupList() {
  const box = $('#backupList');
  if (!box) return;
  const arr = loadBackups();
  if (!arr.length) { box.innerHTML = '<li class="tpl-empty">还没有备份。修改数据后约 4 秒会自动生成每日备份，也可点「立即备份」。</li>'; return; }
  box.innerHTML = arr.map(s => `
    <li data-ts="${s.ts}">
      <div class="bk-info">
        <span class="bk-time">${new Date(s.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        <span class="bk-label ${s.label === 'auto' ? 'auto' : 'manual'}">${s.label === 'auto' ? '自动' : '手动'}</span>
      </div>
      <div class="bk-actions">
        <button class="text-btn sm" data-act="restore">恢复</button>
        <button class="text-btn sm danger" data-act="del">删除</button>
      </div>
    </li>`).join('');
  $$('#backupList li[data-ts]').forEach(li => {
    const ts = +li.dataset.ts;
    li.querySelector('[data-act="restore"]').onclick = () => restoreSnapshot(ts);
    li.querySelector('[data-act="del"]').onclick = () => deleteSnapshot(ts);
  });
}

function getDay(dateStr) {
  const data = loadData();
  if (!data[dateStr]) data[dateStr] = { tasks: [], notes: '', focusMinutes: 0 };
  if (typeof data[dateStr].focusMinutes !== 'number') data[dateStr].focusMinutes = 0;
  return data[dateStr];
}
function updateDay(dateStr, mutator) {
  const data = loadData();
  if (!data[dateStr]) data[dateStr] = { tasks: [], notes: '' };
  mutator(data[dateStr]);
  saveData(data);
}

/* ---------- 全局状态 ---------- */
const state = {
  currentDate: fmtDate(new Date()),
  settings: loadSettings(),
  recurring: loadRecurring(),
  calMonth: new Date(),
  monthView: new Date(),
  taskFilter: 'all',
  editingId: null,
  searchTag: '',
  currentView: 'plan',
};
let draggedId = null;

/* ---------- 分类颜色映射 ---------- */
function catColor(name) {
  if (state.settings.catColors && state.settings.catColors[name]) return state.settings.catColors[name];
  const cats = state.settings.categories;
  const idx = cats.indexOf(name);
  return CAT_PALETTE[(idx >= 0 ? idx : cats.length) % CAT_PALETTE.length];
}
// 两个十六进制颜色按比例混合，t=0 取 c1，t=1 取 c2
function mixHex(c1, c2, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
}
// 应用主题色：写入 --primary / --primary-soft，深色模式自动提亮主色、压暗底色
function applyAccent() {
  const a = state.settings.accent || '#3b6cf6';
  const dark = state.settings.theme === 'dark';
  const primary = dark ? mixHex(a, '#ffffff', 0.18) : a;
  const soft = dark ? mixHex(a, '#161a22', 0.80) : mixHex(a, '#ffffff', 0.86);
  const r = document.documentElement;
  r.style.setProperty('--primary', primary);
  r.style.setProperty('--primary-soft', soft);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  $('#themeBtn').textContent = state.settings.theme === 'dark' ? '☀' : '🌙';
  applyAccent();
}
function refreshCategorySelect() {
  const sel = $('#taskCategory');
  const prev = sel.value;
  sel.innerHTML = state.settings.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (state.settings.categories.includes(prev)) sel.value = prev;
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  applyTheme();

  ensureCatColors();
  refreshCategorySelect();
  $('#datePicker').value = state.currentDate;

  // 首次加载时把默认习惯持久化，避免 ID 每次变化
  saveHabits(loadHabits());

  bindEvents();
  renderAll();
  renderHabits();
  renderGoals();
  registerSW();
  startReminderChecker();
  scheduleAutoSnapshot();
  if (!state.settings.onboarded) openOnboard();
}

function bindEvents() {
  // 日期导航
  $('#prevDay').onclick = () => shiftDate(-1);
  $('#nextDay').onclick = () => shiftDate(1);
  $('#todayBtn').onclick = () => { flushNote(); state.currentDate = fmtDate(new Date()); syncDateUI(); renderAll(); };
  $('#datePicker').onchange = (e) => { if (e.target.value) { flushNote(); state.currentDate = e.target.value; syncDateUI(); renderAll(); } };

  // 视图切换
  $$('.nav-item').forEach(btn => btn.onclick = () => switchView(btn.dataset.view));

  // 日历
  $('#calPrev').onclick = () => shiftCalMonth(-1);
  $('#calNext').onclick = () => shiftCalMonth(1);

  // 主题
  $('#themeBtn').onclick = toggleTheme;

  // 计划表单
  $('#taskForm').onsubmit = (e) => { e.preventDefault(); addTask(); };
  $$('#taskFilter .chip').forEach(c => c.onclick = () => {
    state.taskFilter = c.dataset.filter;
    $$('#taskFilter .chip').forEach(x => x.classList.toggle('active', x === c));
    $('#taskFilter').classList.toggle('show-drag', state.taskFilter === 'all');
    renderPlan();
  });

  // 笔记
  const noteArea = $('#noteArea');
  noteArea.value = getDay(state.currentDate).notes || '';
  noteArea.oninput = () => {
    clearTimeout(noteArea._t);
    $('#noteSaveState').textContent = '编辑中…';
    noteArea._t = setTimeout(() => {
      updateDay(state.currentDate, d => d.notes = noteArea.value);
      $('#noteSaveState').textContent = '已保存 ✓ ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      renderMiniStats(); renderCalendar(); checkBadges();
    }, 500);
  };
  $('#noteClear').onclick = () => {
    if (!noteArea.value || confirm('确定清空今日笔记？')) {
      noteArea.value = '';
      updateDay(state.currentDate, d => d.notes = '');
      updateNoteCount(); renderMiniStats(); renderCalendar();
    }
  };
  $('#notePreviewBtn').onclick = toggleNotePreview;

  // 导出
  $('#exportBtn').onclick = (e) => { e.stopPropagation(); $('#exportMenu').hidden = !$('#exportMenu').hidden; };
  $('#exportMenu').onclick = (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    doExport(btn.dataset.export); $('#exportMenu').hidden = true;
  };
  // 分享卡
  $('#shareClose').onclick = () => $('#shareModal').hidden = true;
  $('#shareCancel').onclick = () => $('#shareModal').hidden = true;
  $('#shareModal').onclick = (e) => { if (e.target.id === 'shareModal') $('#shareModal').hidden = true; };
  $('#shareDownload').onclick = downloadShareCard;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-wrap')) { $('#exportMenu').hidden = true; $('#settingsMenu').hidden = true; }
  });

  // 搜索
  $('#searchBtn').onclick = () => { switchView('search'); $('#searchInput').focus(); };
  $('#searchInput').oninput = (e) => renderSearch(e.target.value);

  // 设置菜单
  $('#gearBtn').onclick = (e) => { e.stopPropagation(); $('#settingsMenu').hidden = !$('#settingsMenu').hidden; $('#exportMenu').hidden = true; };
  $('#settingsMenu').onclick = (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const act = btn.dataset.act;
    $('#settingsMenu').hidden = true;
    if (act === 'cats') openCatModal();
    else if (act === 'habits') openHabitModal();
    else if (act === 'goals') openGoalModal();
    else if (act === 'tpl') openTplModal();
    else if (act === 'backup') openBackupModal();
    else if (act === 'appearance') openAppearanceModal();
    else if (act === 'exportAll') exportAll();
    else if (act === 'import') $('#importFile').click();
    else if (act === 'sample') loadSample();
    else if (act === 'help') openHelp();
    else if (act === 'onboard') openOnboard();
    else if (act === 'clear') clearAll();
  };
  $('#importFile').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
  $('#copyPlanBtn').onclick = copyPlanToTomorrow;

  // 每日目标
  $('#goalInput').onchange = (e) => {
    state.settings.dailyGoal = Math.max(0, Math.min(50, +e.target.value || 0));
    saveSettings(state.settings);
    renderPlan(); renderMiniStats();
  };

  // 周视图
  $('#weekJumpBtn').onclick = () => { state.currentDate = fmtDate(new Date()); syncDateUI(); renderWeek(); };

  // 月视图
  $('#monthPrev').onclick = () => { state.monthView.setMonth(state.monthView.getMonth() - 1); renderMonth(); };
  $('#monthNext').onclick = () => { state.monthView.setMonth(state.monthView.getMonth() + 1); renderMonth(); };
  $('#monthToday').onclick = () => { state.monthView = new Date(); renderMonth(); };

  // 分类管理弹窗
  $('#catClose').onclick = () => $('#catModal').hidden = true;
  $('#catModal').onclick = (e) => { if (e.target.id === 'catModal') $('#catModal').hidden = true; };
  $('#catAddBtn').onclick = addCategory;

  // 模板弹窗
  $('#tplClose').onclick = () => $('#tplModal').hidden = true;
  $('#tplModal').onclick = (e) => { if (e.target.id === 'tplModal') $('#tplModal').hidden = true; };
  $('#tplAddBtn').onclick = saveTemplateFromDay;

  // 习惯管理弹窗
  $('#habitClose').onclick = () => $('#habitModal').hidden = true;
  $('#habitModal').onclick = (e) => { if (e.target.id === 'habitModal') $('#habitModal').hidden = true; };
  $('#habitAddBtn').onclick = addHabit;
  $('#habitManageBtn').onclick = openHabitModal;

  // 学习目标弹窗
  $('#goalClose').onclick = () => $('#goalModal').hidden = true;
  $('#goalModal').onclick = (e) => { if (e.target.id === 'goalModal') $('#goalModal').hidden = true; };
  $('#goalAddBtn').onclick = addGoal;
  $('#goalManageBtn').onclick = openGoalModal;

  // 周复盘弹窗
  $('#reviewBtn').onclick = openReviewModal;
  $('#reviewClose').onclick = () => $('#reviewModal').hidden = true;
  $('#reviewModal').onclick = (e) => { if (e.target.id === 'reviewModal') $('#reviewModal').hidden = true; };
  $('#reviewCopyBtn').onclick = reviewCopy;
  $('#reviewInsertBtn').onclick = reviewInsertNote;
  $('#reviewExportBtn').onclick = reviewExport;

  // 数据保险箱弹窗
  $('#backupClose').onclick = () => $('#backupModal').hidden = true;
  $('#backupModal').onclick = (e) => { if (e.target.id === 'backupModal') $('#backupModal').hidden = true; };
  $('#backupNowBtn').onclick = () => { saveSnapshot('manual'); renderBackupList(); toast('已立即备份'); };
  $('#exportDataBtn').onclick = exportDataFile;
  $('#importDataBtn').onclick = () => $('#importDataFile').click();
  $('#importDataFile').onchange = (e) => { if (e.target.files && e.target.files[0]) importDataFile(e.target.files[0]); e.target.value = ''; };

  // 外观设置弹窗
  $('#appearanceClose').onclick = () => $('#appearanceModal').hidden = true;
  $('#appearanceModal').onclick = (e) => { if (e.target.id === 'appearanceModal') $('#appearanceModal').hidden = true; };
  $('#accentCustom').oninput = (e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setAccent(e.target.value); };

  // 今日复盘弹窗
  $('#reviewDayBtn').onclick = openDayReview;
  $('#drClose').onclick = () => $('#dayReviewModal').hidden = true;
  $('#dayReviewModal').onclick = (e) => { if (e.target.id === 'dayReviewModal') $('#dayReviewModal').hidden = true; };
  $('#drSave').onclick = saveDayReview;
  $('#drClose2').onclick = () => $('#dayReviewModal').hidden = true;
  $('#drStars').querySelectorAll('.star').forEach(s => s.onclick = () => drSetRating(+s.dataset.star));

  // 周目标
  $('#weeklyGoalInput').onchange = (e) => {
    state.settings.weeklyGoal = Math.max(0, Math.min(200, +e.target.value || 0));
    saveSettings(state.settings);
    renderMiniStats(); renderStats();
  };

  // 统计页「回到今天」快捷入口：重置日期到今天并跳回计划视图
  $('#statsTodayBtn').onclick = () => {
    flushNote();
    state.currentDate = fmtDate(new Date());
    syncDateUI();
    switchView('plan');
    renderAll();
    toast('已回到今天');
  };

  // 帮助弹窗
  $('#helpClose').onclick = closeHelp;
  $('#helpModal').onclick = (e) => { if (e.target.id === 'helpModal') closeHelp(); };

  // 首次引导弹窗
  $('#onboardStart').onclick = finishOnboarding;
  $('#onboardModal').onclick = (e) => { if (e.target.id === 'onboardModal') finishOnboarding(); };

  // 专注浮标
  $('#focusBadge').onclick = () => switchView('focus');

  // 专注计时
  bindTimer();

  // 空状态引导按钮
  $('#emptyAddBtn').onclick = () => { switchView('plan'); $('#taskTitle').focus(); };
  $('#emptySampleBtn').onclick = () => loadSample();

  // 全局键盘快捷键
  bindHotkeys();
}

function bindHotkeys() {
  document.addEventListener('keydown', (e) => {
    // Esc：优先关闭弹窗 / 菜单 / 取消编辑
    if (e.key === 'Escape') {
      if (!$('#catModal').hidden) { $('#catModal').hidden = true; return; }
      if (!$('#tplModal').hidden) { $('#tplModal').hidden = true; return; }
      if (!$('#habitModal').hidden) { $('#habitModal').hidden = true; return; }
      if (!$('#goalModal').hidden) { $('#goalModal').hidden = true; return; }
      if (!$('#reviewModal').hidden) { $('#reviewModal').hidden = true; return; }
      if (!$('#dayReviewModal').hidden) { $('#dayReviewModal').hidden = true; return; }
      if (!$('#backupModal').hidden) { $('#backupModal').hidden = true; return; }
      if (!$('#appearanceModal').hidden) { $('#appearanceModal').hidden = true; return; }
      if (!$('#recurEditModal').hidden) { $('#recurEditModal').hidden = true; return; }
      if (!$('#shareModal').hidden) { $('#shareModal').hidden = true; return; }
      if (document.body.classList.contains('immersive')) { toggleImmersive(); return; }
      if (!$('#helpModal').hidden) { closeHelp(); return; }
      if (!$('#exportMenu').hidden) { $('#exportMenu').hidden = true; return; }
      if (!$('#settingsMenu').hidden) { $('#settingsMenu').hidden = true; return; }
      if (state.editingId) { state.editingId = null; renderPlan(); return; }
      if (!$('#onboardModal').hidden) { finishOnboarding(); return; }
    }
    const el = e.target;
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const viewMap = { '1': 'plan', '2': 'week', '3': 'month', '4': 'notes', '5': 'stats', '6': 'focus' };
    if (viewMap[e.key]) { switchView(viewMap[e.key]); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (k === 'n') { switchView('plan'); setTimeout(() => $('#taskTitle').focus(), 0); e.preventDefault(); }
    else if (k === 't') { flushNote(); state.currentDate = fmtDate(new Date()); syncDateUI(); renderAll(); e.preventDefault(); }
    else if (k === 'c') { copyPlanToTomorrow(); e.preventDefault(); }
    else if (k === 'w') { switchView('week'); e.preventDefault(); }
    else if (k === 'm') { switchView('month'); e.preventDefault(); }
    else if (k === '/') { switchView('search'); $('#searchInput').focus(); e.preventDefault(); }
    else if (k === 'f' && state.currentView === 'focus') { toggleImmersive(); e.preventDefault(); }
    else if (e.key === '?') { openHelp(); e.preventDefault(); }
  });
}

/* ============================================================
   日期 & 日历
   ============================================================ */
function shiftDate(n) {
  flushNote();
  const d = parseDate(state.currentDate);
  d.setDate(d.getDate() + n);
  state.currentDate = fmtDate(d);
  syncDateUI(); renderAll();
}
function syncDateUI() {
  $('#datePicker').value = state.currentDate;
  $('#weekdayLabel').textContent = weekdayCN(state.currentDate);
}
function shiftCalMonth(n) {
  state.calMonth.setMonth(state.calMonth.getMonth() + n);
  renderCalendar();
}
function renderCalendar() {
  const y = state.calMonth.getFullYear();
  const m = state.calMonth.getMonth();
  $('#calTitle').textContent = `${y} 年 ${m + 1} 月`;
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // 周一为起点
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  const data = loadData();
  const todayStr = fmtDate(new Date());

  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell muted"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = fmtDate(new Date(y, m, day));
    const cls = ['cal-cell'];
    if (ds === todayStr) cls.push('today');
    if (ds === state.currentDate) cls.push('selected');
    const entry = data[ds];
    if (entry && (entry.tasks.length || (entry.notes && entry.notes.trim()))) cls.push('has-data');
    cells.push(`<div class="${cls.join(' ')}" data-date="${ds}">${day}</div>`);
  }
  const grid = $('#calGrid');
  grid.innerHTML = cells.join('');
  $$('.cal-cell[data-date]', grid).forEach(c => c.onclick = () => {
    state.currentDate = c.dataset.date; syncDateUI(); renderAll();
  });
}

/* ============================================================
   计划
   ============================================================ */
/* 智能快速输入：从标题里解析
   - 开头/结尾的 HH:MM  → 时间
   - #分类（需匹配已有分类，忽略大小写）→ 分类
   - !高/!中/!低 或 !high/!mid/!low → 优先级
   返回 { title, time, category, priority }，未命中的字段返回 null。 */
function parseQuickInput(raw) {
  let text = ' ' + raw + ' ';
  const res = { title: '', time: null, category: null, priority: null, repeat: null };

  // 优先级 !高/!中/!低 / !h !m !l / !high...
  const priMap = { '高': '高', '中': '中', '低': '低', 'h': '高', 'm': '中', 'l': '低', 'high': '高', 'mid': '中', 'low': '低' };
  text = text.replace(/(^|\s)!([\u9ad8\u4e2d\u4f4e]|high|mid|low|[hml])(?=\s)/gi, (m, sp, p) => {
    res.priority = priMap[p.toLowerCase()] || priMap[p] || null;
    return ' ';
  });

  // 分类 #xxx（匹配已有分类）
  text = text.replace(/(^|\s)#([^\s#]+)(?=\s)/g, (m, sp, name) => {
    const hit = state.settings.categories.find(c => c.toLowerCase() === name.toLowerCase());
    if (hit) { res.category = hit; return ' '; }
    return m; // 非已知分类，保留原文
  });

  // 重复标记 *每天 / *每日 / *daily / *周 / *每周 / *weekly（置 repeat 字段并移除 token）
  // 注意：长匹配放前面（每周 先于 周），避免 *每周 被拆成 *周 + 残留「每」
  const repeatMap = { '每天': 'daily', '每日': 'daily', 'daily': 'daily', '每周': 'weekly', '周': 'weekly', 'weekly': 'weekly' };
  text = text.replace(/(^|\s)\*(每周|每日|每天|daily|weekly|周)(?=\s|$)/gi, (m, sp, r) => {
    res.repeat = repeatMap[r.toLowerCase()] || null;
    return ' ';
  });

  // 时间 HH:MM（开头或结尾）
  const timeRe = /(^|\s)((?:[01]?\d|2[0-3])[:：][0-5]\d)(?=\s)/;
  const tm = text.match(timeRe);
  if (tm) {
    res.time = tm[2].replace('：', ':');
    if (res.time.indexOf(':') === 1) res.time = '0' + res.time; // 9:30 → 09:30
    text = text.replace(timeRe, ' ');
  }

  res.title = text.replace(/\s+/g, ' ').trim();
  return res;
}
/* 标签：从文本里提取 #标签（分类标记已在 parseQuickInput 中消费，这里补充剩余标签）
   标签为 2-20 位中英文/数字/下划线，返回去重后的数组。 */
function extractTags(text) {
  const set = new Set();
  String(text).replace(/#([\u4e00-\u9fa5\w]{2,20})/g, (m, tag) => { set.add(tag); return m; });
  return [...set];
}
function renderTagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<span class="task-tags">${tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</span>`;
}
/* 本周已完成任务数（用于周目标进度） */
function weeklyDoneCount() {
  const data = loadData();
  let n = 0;
  weekRange().forEach(ds => { const e = data[ds]; if (e) n += e.tasks.filter(t => t.done).length; });
  return n;
}
function addTask() {
  const raw = $('#taskTitle').value.trim();
  if (!raw) return;
  const p = parseQuickInput(raw);
  const title = p.title || raw;
  if (!title) return;
  if (p.repeat) { addRecurring(p); return; }
  const task = {
    id: uid(),
    time: p.time || $('#taskTime').value || '',
    title,
    category: p.category || $('#taskCategory').value,
    priority: p.priority || $('#taskPriority').value,
    done: false,
    tags: extractTags(p.title),
    order: getDay(state.currentDate).tasks.length,
  };
  updateDay(state.currentDate, d => d.tasks.push(task));
  $('#taskTitle').value = '';
  $('#taskTime').value = '';
  renderPlan(); renderMiniStats(); renderCalendar(); renderStats();
  const extra = [p.time && '时间', p.category && '分类', p.priority && '优先级'].filter(Boolean);
  toast(extra.length ? '已添加（智能识别：' + extra.join('/') + '）' : '已添加任务');
  setTimeout(() => $('#taskTitle').focus(), 0);
}
function toggleTask(id) {
  updateDay(state.currentDate, d => {
    const t = d.tasks.find(t => t.id === id);
    if (t) { t.done = !t.done; if (t.done) t.doneAt = new Date().toISOString(); }
  });
  renderPlan(); renderMiniStats(); renderCalendar(); renderStats();
  checkBadges();
}
function deleteTask(id) {
  updateDay(state.currentDate, d => { d.tasks = d.tasks.filter(t => t.id !== id); });
  renderPlan(); renderMiniStats(); renderCalendar(); renderStats();
}
/* ============================================================
   重复任务（每天 / 每周自动出现，按日期记录完成）
   ============================================================ */
function addRecurring(p) {
  const title = (p && p.title) || $('#taskTitle').value.trim();
  if (!title) return;
  const entry = {
    id: uid(),
    title,
    cat: (p && p.category) || $('#taskCategory').value,
    priority: (p && p.priority) || $('#taskPriority').value,
    repeat: (p && p.repeat) || 'daily',
    created: fmtDate(new Date()),
    done: {},
    paused: false,
  };
  state.recurring.push(entry);
  saveRecurring(state.recurring);
  $('#taskTitle').value = '';
  $('#taskTime').value = '';
  renderRecurring(); renderMiniStats(); renderCalendar(); renderStats();
  toast('已添加重复任务（' + (entry.repeat === 'daily' ? '每天' : '每周') + '）：' + title);
  setTimeout(() => $('#taskTitle').focus(), 0);
}
function toggleRecurring(id) {
  const r = state.recurring.find(x => x.id === id);
  if (!r) return;
  const date = state.currentDate;
  if (r.done[date]) delete r.done[date]; else r.done[date] = true;
  saveRecurring(state.recurring);
  renderRecurring(); renderMiniStats(); renderCalendar(); renderStats();
  checkBadges();
}
function deleteRecurring(id) {
  state.recurring = state.recurring.filter(x => x.id !== id);
  saveRecurring(state.recurring);
  renderRecurring(); renderMiniStats(); renderCalendar(); renderStats();
}
function renderRecurring() {
  const box = $('#recurList');
  if (!box) return;
  const sec = $('#recurSection');
  if (!state.recurring.length) { sec.hidden = true; box.innerHTML = ''; return; }
  sec.hidden = false;
  const date = state.currentDate;
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';
  box.innerHTML = state.recurring.map(r => {
    const done = !!r.done[date];
    const paused = !!r.paused;
    let extra = '';
    if (done) {
      const st = recurStreak(r);
      extra = st.cur >= 2
        ? `<span class="recur-streak" title="最长连续 ${st.best} 天">🔥 连续 ${st.cur} 天</span>`
        : `<span class="recur-streak" title="累计 ${st.total} 次 · 最长 ${st.best} 天">✓ 已打卡 ${st.total} 次</span>`;
    } else if (!paused) {
      const pending = r.repeat === 'daily'
        ? '⏳ 待打卡'
        : (weekRange().some(d => r.done[d]) ? '' : '⏳ 本周待打卡');
      if (pending) extra = `<span class="recur-pending">${pending}</span>`;
    }
    const pauseAct = paused ? 'resume' : 'pause';
    const pauseIco = paused ? '▶' : '⏸';
    const pauseTip = paused ? '恢复' : '暂停';
    return `
    <li class="task-item recur-item ${done ? 'done' : ''} ${paused ? 'paused' : ''}" data-id="${r.id}">
      <div class="task-check" data-act="check">${done ? CHECK : ''}</div>
      <span class="task-title">${escapeHtml(r.title)}</span>
      <span class="task-cat" style="background:${catColor(r.cat)}">${escapeHtml(r.cat)}</span>
      <span class="recur-badge ${r.repeat}">${r.repeat === 'daily' ? '🔁 每天' : '🔁 每周'}</span>
      ${paused ? '<span class="recur-paused-badge">⏸ 已暂停</span>' : ''}
      ${extra}
      <button class="recur-ico" data-act="edit" title="编辑">✎</button>
      <button class="recur-ico" data-act="${pauseAct}" title="${pauseTip}">${pauseIco}</button>
      <button class="task-del" data-act="del" title="删除">×</button>
    </li>`;
  }).join('');
  $$('.recur-item', box).forEach(li => {
    const id = li.dataset.id;
    li.querySelector('[data-act="check"]').onclick = () => toggleRecurring(id);
    li.querySelector('[data-act="del"]').onclick = () => deleteRecurring(id);
    li.querySelector('[data-act="edit"]').onclick = () => openRecurEdit(id);
    const pe = li.querySelector('[data-act="pause"],[data-act="resume"]');
    if (pe) pe.onclick = () => toggleRecurPause(id);
  });
}
function openRecurEdit(id) {
  const r = state.recurring.find(x => x.id === id);
  if (!r) return;
  const sel = $('#recurEditCat');
  sel.innerHTML = state.settings.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sel.value = state.settings.categories.includes(r.cat) ? r.cat : (state.settings.categories[0] || r.cat);
  $('#recurEditTitle').value = r.title;
  $('#recurEditRepeat').value = r.repeat;
  $('#recurEditModal').dataset.id = id;
  $('#recurEditModal').hidden = false;
  $('#recurEditClose').onclick = () => $('#recurEditModal').hidden = true;
  $('#recurEditCancel').onclick = () => $('#recurEditModal').hidden = true;
  $('#recurEditModal').onclick = (e) => { if (e.target.id === 'recurEditModal') $('#recurEditModal').hidden = true; };
  $('#recurEditSave').onclick = saveRecurEdit;
  setTimeout(() => $('#recurEditTitle').focus(), 0);
}
function saveRecurEdit() {
  const id = $('#recurEditModal').dataset.id;
  const r = state.recurring.find(x => x.id === id);
  if (!r) { $('#recurEditModal').hidden = true; return; }
  const title = $('#recurEditTitle').value.trim();
  if (!title) { toast('标题不能为空'); return; }
  r.title = title;
  r.cat = $('#recurEditCat').value;
  r.repeat = $('#recurEditRepeat').value;
  saveRecurring(state.recurring);
  $('#recurEditModal').hidden = true;
  renderRecurring(); renderMiniStats(); renderCalendar(); renderStats();
  toast('已保存修改');
}
function toggleRecurPause(id) {
  const r = state.recurring.find(x => x.id === id);
  if (!r) return;
  r.paused = !r.paused;
  saveRecurring(state.recurring);
  renderRecurring();
  toast(r.paused ? '已暂停：' + r.title : '已恢复：' + r.title);
}
/* 重复任务连续打卡统计：返回 { cur, best, total }
   cur = 截至今天/昨天的当前连续天数（昨天完成视为未断）；best = 历史最长连续；total = 累计打卡次数 */
function recurStreak(r) {
  const dates = Object.keys(r.done || {}).sort();
  const total = dates.length;
  if (!total) return { cur: 0, best: 0, total: 0 };
  let best = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const gap = (parseDate(dates[i]) - parseDate(dates[i - 1])) / 86400000;
    if (gap === 1) run++; else run = 1;
    best = Math.max(best, run);
  }
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = fmtDate(y);
  const today = fmtDate(new Date());
  const last = dates[dates.length - 1];
  let cur = 0;
  if (last === today || last === yesterday) {
    cur = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const gap = (parseDate(dates[i]) - parseDate(dates[i - 1])) / 86400000;
      if (gap === 1) cur++; else break;
    }
  }
  return { cur, best, total };
}
function reorderByDrop(srcId, targetId) {  if (srcId === targetId) return;
  updateDay(state.currentDate, d => {
    const from = d.tasks.findIndex(t => t.id === srcId);
    if (from < 0) return;
    const [moved] = d.tasks.splice(from, 1);
    let to = d.tasks.findIndex(t => t.id === targetId);
    if (to < 0) to = d.tasks.length;
    d.tasks.splice(to, 0, moved);
    d.tasks.forEach((t, i) => { t.order = i; });
  });
  renderPlan(); renderCalendar();
}
function renderPlan() {
  const day = getDay(state.currentDate);
  $('#planDateTitle').textContent = `${state.currentDate} ${weekdayCN(state.currentDate)} · 计划`;
  const total = day.tasks.length;
  const done = day.tasks.filter(t => t.done).length;
  const goal = state.settings.dailyGoal || 0;
  $('#planProgressFill').style.width = total ? (done / total * 100) + '%' : '0%';
  $('#planProgressText').textContent = `${done}/${total}` + (goal ? ` · 目标 ${goal}` : '');
  $('#goalInput').value = goal || '';

  let list = [...day.tasks];
  if (state.taskFilter === 'pending') list = list.filter(t => !t.done);
  else if (state.taskFilter === 'done') list = list.filter(t => t.done);
  list.sort((a, b) => ((a.order ?? 99) - (b.order ?? 99)) || (a.time || '99').localeCompare(b.time || '99'));

  const ul = $('#taskList');
  $('#planEmpty').hidden = (total !== 0) || state.recurring.length > 0;
  ul.innerHTML = list.map(t => {
    if (t.id === state.editingId) {
      const opts = state.settings.categories.map(c => `<option value="${escapeHtml(c)}" ${c === t.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      const pris = ['高', '中', '低'].map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p}优先级</option>`).join('');
      return `
        <li class="task-item editing" data-id="${t.id}">
          <input class="edit-time" type="time" value="${t.time || ''}" />
          <input class="edit-title" type="text" value="${escapeHtml(t.title)}" maxlength="120" />
          <select class="edit-cat">${opts}</select>
          <select class="edit-pri">${pris}</select>
          <button class="edit-save" data-act="save">保存</button>
          <button class="edit-cancel" data-act="cancel">取消</button>
        </li>`;
    }
    return `
    <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="task-check" data-act="check">${t.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ''}</div>
      ${t.time ? `<span class="task-time">${escapeHtml(t.time)}</span>` : ''}
      <span class="task-title">${escapeHtml(t.title)}</span>
      <span class="task-cat" style="background:${catColor(t.category)}">${escapeHtml(t.category)}</span>
      <span class="task-pri pri-${t.priority}">${t.priority}</span>
      ${t.focusMin ? `<span class="task-focus" title="累计专注">⏱${t.focusMin}分</span>` : ''}
      ${renderTagChips(t.tags)}
      <button class="task-edit" data-act="edit" title="编辑">✎</button>
      <button class="task-del" data-act="del" title="删除">×</button>
    </li>`;
  }).join('');

  $$('.task-item', ul).forEach(li => {
    const id = li.dataset.id;
    if (li.classList.contains('editing')) {
      const save = () => saveTaskEdit(id, li);
      li.querySelector('[data-act="save"]').onclick = save;
      li.querySelector('[data-act="cancel"]').onclick = () => { state.editingId = null; renderPlan(); };
      li.querySelector('.edit-title').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      li.querySelector('.edit-title').focus();
    } else {
      li.querySelector('[data-act="check"]').onclick = () => toggleTask(id);
      li.querySelector('[data-act="del"]').onclick = () => deleteTask(id);
      li.querySelector('[data-act="edit"]').onclick = () => { state.editingId = id; renderPlan(); };
      if (state.taskFilter === 'all') {
        li.draggable = true;
        li.style.cursor = 'grab';
        li.addEventListener('dragstart', (e) => {
          draggedId = id; li.classList.add('dragging');
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
        });
        li.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; });
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedId && draggedId !== id) reorderByDrop(draggedId, id);
          draggedId = null; li.classList.remove('dragging');
        });
        li.addEventListener('dragend', () => { draggedId = null; li.classList.remove('dragging'); });
      }
    }
  });
  renderRating();
  renderFocusTaskSelect();
  renderRecurring();
}
function saveTaskEdit(id, li) {
  const title = li.querySelector('.edit-title').value.trim();
  if (!title) { toast('标题不能为空'); return; }
  updateDay(state.currentDate, d => {
    const t = d.tasks.find(t => t.id === id);
    if (t) {
      t.title = title;
      t.time = li.querySelector('.edit-time').value || '';
      t.category = li.querySelector('.edit-cat').value;
      t.priority = li.querySelector('.edit-pri').value;
      t.tags = extractTags(title);
    }
  });
  state.editingId = null;
  renderPlan(); renderMiniStats(); renderCalendar(); renderStats();
  toast('已保存修改');
}

/* ============================================================
   笔记
   ============================================================ */
function updateNoteCount() {
  $('#noteCount').textContent = ($('#noteArea').value.length) + ' 字';
}
function flushNote() {
  const area = $('#noteArea');
  const saved = getDay(state.currentDate).notes || '';
  if (area.value !== saved) updateDay(state.currentDate, d => d.notes = area.value);
}
function mdInline(t) {
  return t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const safe = /^(https?:|\/|#)/i.test(url) ? url : '#';
      return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener">${txt}</a>`;
    });
}
function renderMarkdown(src) {
  if (!src || !src.trim()) return '<p class="md-empty">（空）</p>';
  const lines = escapeHtml(src).split('\n');
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const line of lines) {
    if (/^### /.test(line)) { closeList(); out.push('<h3>' + mdInline(line.slice(4)) + '</h3>'); }
    else if (/^## /.test(line)) { closeList(); out.push('<h2>' + mdInline(line.slice(3)) + '</h2>'); }
    else if (/^# /.test(line)) { closeList(); out.push('<h1>' + mdInline(line.slice(2)) + '</h1>'); }
    else if (/^&gt; /.test(line)) { closeList(); out.push('<blockquote>' + mdInline(line.slice(5)) + '</blockquote>'); }
    else if (/^\s*[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + mdInline(line.replace(/^\s*[-*] /, '')) + '</li>');
    }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); out.push('<p>' + mdInline(line) + '</p>'); }
  }
  closeList();
  return out.join('\n');
}
function toggleNotePreview() {
  const area = $('#noteArea'), prev = $('#notePreview'), btn = $('#notePreviewBtn');
  if (prev.hidden) {
    flushNote();
    prev.innerHTML = renderMarkdown(area.value);
    prev.hidden = false; area.hidden = true; $('.note-foot').hidden = true;
    btn.textContent = '✏️ 编辑'; btn.classList.add('active');
  } else {
    prev.hidden = true; area.hidden = false; $('.note-foot').hidden = false;
    btn.textContent = '👁 预览'; btn.classList.remove('active');
  }
}

/* ============================================================
   统计
   ============================================================ */
function computeStats() {
  const data = loadData();
  let totalTasks = 0, totalDone = 0, daysWithData = 0, daysWithDone = 0, focusTotal = 0;
  const catCount = {};
  const today = new Date();
  // 重复任务完成日期集合：用于纳入连续打卡统计
  const recurDoneDates = new Set();
  let recurDoneTotal = 0;
  state.recurring.forEach(r => { if (r.done) { Object.keys(r.done).forEach(d => recurDoneDates.add(d)); recurDoneTotal += Object.keys(r.done).length; } });
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    const e = data[ds];
    const recurringDone = recurDoneDates.has(ds);
    if (!e && !recurringDone) { if (i === 0) continue; else break; }
    const hasContent = (e && (e.tasks.length || (e.notes && e.notes.trim()))) || recurringDone;
    if (hasContent) daysWithData++;
    const ddone = (e ? e.tasks.filter(t => t.done).length : 0) + (recurringDone ? 1 : 0);
    if (ddone > 0) { daysWithDone++; streak++; } else if (i === 0) { /* 今天还没完成，不算断 */ } else break;
    if (e && typeof e.focusMinutes === 'number') focusTotal += e.focusMinutes;
    if (e) e.tasks.forEach(t => {
      totalTasks++; if (t.done) totalDone++;
      catCount[t.category] = (catCount[t.category] || 0) + 1;
    });
  }
  // 历史最佳连续打卡
  const doneDates = Object.keys(data)
    .filter(ds => (data[ds].tasks || []).some(t => t.done))
    .sort();
  let bestStreak = 0, run = 0, prev = null;
  for (const ds of doneDates) {
    if (prev && (parseDate(ds) - parseDate(prev)) / 86400000 === 1) run++;
    else run = 1;
    bestStreak = Math.max(bestStreak, run);
    prev = ds;
  }
  const sessionCount = loadSessions().length;
  return { totalTasks, totalDone, daysWithData, daysWithDone, catCount, streak, bestStreak, focusTotal, sessionCount, recurDoneTotal };
}
function weekFocusByCat(offsetWeeks) {
  const out = {};
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 周一为一周起点
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - offsetWeeks * 7);
  const data = loadData();
  for (let i = 0; i < 7; i++) {
    const ds = fmtDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    const e = data[ds];
    if (e && e.focusByCat) Object.entries(e.focusByCat).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  }
  return out;
}
function renderStats() {
  const s = computeStats();
  const rate = s.totalTasks ? Math.round(s.totalDone / s.totalTasks * 100) : 0;
  const todayFocus = getDay(state.currentDate).focusMinutes || 0;
  renderBadges();

  // 近 7 天 & 平均评分
  const data = loadData();
  let rs = 0, rc = 0;
  Object.values(data).forEach(d => { if (d.rating > 0) { rs += d.rating; rc++; } });
  const avgRating = rc ? (rs / rc).toFixed(1) : '—';
  const wGoal = state.settings.weeklyGoal || 0;
  const wDone = weeklyDoneCount();
  const wRate = wGoal ? Math.round(wDone / wGoal * 100) : 0;
  const wgi = $('#weeklyGoalInput'); if (wgi) wgi.value = state.settings.weeklyGoal || '';
  $('#statCards').innerHTML = `
    <div class="stat-card"><div class="sc-val">${rate}%</div><div class="sc-label">总任务完成率</div></div>
    <div class="stat-card"><div class="sc-val">${s.totalDone}/${s.totalTasks}</div><div class="sc-label">完成任务 / 总任务</div></div>
    <div class="stat-card"><div class="sc-val">🔥 ${s.streak}</div><div class="sc-label">连续打卡（最佳 ${s.bestStreak}）</div></div>
    <div class="stat-card"><div class="sc-val">⏱ ${todayFocus}</div><div class="sc-label">今日专注（分钟）</div></div>
    <div class="stat-card"><div class="sc-val">${(s.focusTotal / 60).toFixed(1)}h</div><div class="sc-label">累计专注时长</div></div>
    <div class="stat-card"><div class="sc-val">${s.sessionCount}</div><div class="sc-label">专注记录数 🍅</div></div>
    <div class="stat-card"><div class="sc-val">📆 ${s.recurDoneTotal}</div><div class="sc-label">重复任务打卡（次）</div></div>
    <div class="stat-card"><div class="sc-val">${avgRating}</div><div class="sc-label">平均每日评分</div></div>
    <div class="stat-card"><div class="sc-val">${wGoal ? wDone + '/' + wGoal : '—'}</div><div class="sc-label">本周目标完成${wGoal ? '（' + wRate + '%）' : '（未设置）'}</div></div>`;

  // 近 7 天
  const today = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const ds = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    const e = data[ds] || { tasks: [] };
    const tot = e.tasks.length, don = e.tasks.filter(t => t.done).length;
    week.push({ label: (i === 0 ? '今天' : `${parseDate(ds).getMonth() + 1}/${parseDate(ds).getDate()}`), rate: tot ? Math.round(don / tot * 100) : 0 });
  }
  $('#weekChart').innerHTML = week.map(w => `
    <div class="bar-col">
      <div class="bar-val" style="--h:${w.rate}%" title="${w.rate}%"></div>
      <div class="bar-label">${w.label}</div>
      <div class="bar-label">${w.rate}%</div>
    </div>`).join('');

  // 近 7 天专注时长
  const focusWeek = [];
  for (let i = 6; i >= 0; i--) {
    const ds = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    const e = data[ds] || { focusMinutes: 0 };
    focusWeek.push({ label: (i === 0 ? '今天' : `${parseDate(ds).getMonth() + 1}/${parseDate(ds).getDate()}`), val: e.focusMinutes || 0 });
  }
  const fmax = Math.max(1, ...focusWeek.map(w => w.val));
  $('#focusChart').innerHTML = focusWeek.map(w => `
    <div class="bar-col">
      <div class="bar-val focus" style="--h:${Math.round(w.val / fmax * 100)}%" title="${w.val} 分"></div>
      <div class="bar-label">${w.label}</div>
      <div class="bar-label">${w.val}分</div>
    </div>`).join('');

  // 专注主题分布（时间都花在哪）
  const themeMap = {};
  Object.values(data).forEach(d => {
    if (d.focusByCat) Object.entries(d.focusByCat).forEach(([k, v]) => { themeMap[k] = (themeMap[k] || 0) + v; });
  });
  const themes = Object.entries(themeMap).sort((a, b) => b[1] - a[1]);
  const tmax = themes.length ? themes[0][1] : 1;
  const tsum = themes.reduce((a, [, v]) => a + v, 0);
  const ftc = $('#focusThemeChart');
  if (ftc) ftc.innerHTML = themes.length ? themes.map(([name, min]) => `
    <div class="cat-row">
      <span class="cat-dot" style="background:${name === '未分类' ? 'var(--text-soft)' : catColor(name)}"></span>
      <span style="min-width:54px">${escapeHtml(name)}</span>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${min / tmax * 100}%;background:${name === '未分类' ? 'var(--text-soft)' : catColor(name)}"></div></div>
      <span class="cat-count">${min}分 · ${tsum ? Math.round(min / tsum * 100) : 0}%</span>
    </div>`).join('') : '<p class="empty-hint">还没有专注记录，去番茄钟专注一轮吧</p>';

  // 近两周专注主题对比（本周 vs 上周）
  const tw = weekFocusByCat(0), lw = weekFocusByCat(1);
  const trendCats = [...new Set([...Object.keys(tw), ...Object.keys(lw)])]
    .sort((a, b) => ((tw[b] || 0) + (lw[b] || 0)) - ((tw[a] || 0) + (lw[a] || 0)));
  const wMax = Math.max(1, ...trendCats.map(c => tw[c] || 0));
  const lMax = Math.max(1, ...trendCats.map(c => lw[c] || 0));
  const ftc2 = $('#focusTrendChart');
  if (ftc2) ftc2.innerHTML = trendCats.length ? trendCats.map(cat => {
    const w = tw[cat] || 0, p = lw[cat] || 0;
    const delta = w - p;
    const dCls = delta > 0 ? ' up' : delta < 0 ? ' down' : '';
    const dTxt = delta > 0 ? '▲ +' + delta : delta < 0 ? '▼ ' + delta : '±0';
    return `
    <div class="trend-row">
      <span class="trend-cat">${escapeHtml(cat)}</span>
      <div class="trend-bars">
        <div class="trend-bar-line"><div class="trend-bar this" style="width:${Math.round(w / wMax * 100)}%"></div><span class="trend-val">${w}</span></div>
        <div class="trend-bar-line"><div class="trend-bar last" style="width:${Math.round(p / lMax * 100)}%"></div><span class="trend-val">${p}</span></div>
      </div>
      <span class="trend-delta${dCls}">${dTxt}</span>
    </div>`;
  }).join('') : '<p class="empty-hint">近两周还没有专注记录</p>';

  // 分类分布
  const cats = Object.entries(s.catCount).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;
  $('#catChart').innerHTML = cats.length ? cats.map(([name, cnt]) => `
    <div class="cat-row">
      <span class="cat-dot" style="background:${catColor(name)}"></span>
      <span style="min-width:54px">${escapeHtml(name)}</span>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${cnt / max * 100}%;background:${catColor(name)}"></div></div>
      <span class="cat-count">${cnt}</span>
    </div>`).join('') : '<p class="empty-hint">暂无数据</p>';

  // 近期专注记录（番茄日志）
  const sessions = loadSessions().slice().sort((a, b) => b.ts - a.ts).slice(0, 12);
  const fl = $('#focusLog');
  if (fl) {
    if (!sessions.length) {
      fl.innerHTML = '<p class="empty-hint">还没有专注记录，去番茄钟专注一轮，这里会留下你的足迹 🍅</p>';
    } else {
      fl.innerHTML = sessions.map(s2 => {
        const c = s2.cat === '未分类' ? 'var(--text-soft)' : catColor(s2.cat);
        const t = s2.title ? '· ' + escapeHtml(s2.title) : '';
        return `<div class="fl-row">
          <span class="cat-dot" style="background:${c}"></span>
          <span class="fl-cat">${escapeHtml(s2.cat)}</span>
          <span class="fl-dur">${s2.duration} 分</span>
          <span class="fl-title">${t}</span>
          <span class="fl-date">${s2.date.slice(5)}</span>
        </div>`;
      }).join('');
    }
  }

  // 活跃度热力图
  renderHeatmap();
}
function renderHeatmap() {
  const data = loadData();
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 26 * 7);
  const startDow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startDow); // 对齐到周一
  const cells = [];
  const cur = new Date(start);
  const endStr = fmtDate(today);
  while (fmtDate(cur) <= endStr) {
    const ds = fmtDate(cur);
    const e = data[ds];
    let level = 0, tip = ds;
    if (e && (e.tasks.length || (e.notes && e.notes.trim()))) {
      const tot = e.tasks.length;
      const don = e.tasks.filter(t => t.done).length;
      if (tot === 0 && e.notes && e.notes.trim()) level = 1;
      else if (don === 0) level = 1;
      else { const r = don / tot; level = r >= 1 ? 4 : r >= 0.5 ? 3 : 2; }
      tip += ` · 完成 ${don}/${tot}` + (tot ? `（${Math.round(don / tot * 100)}%）` : '');
    }
    cells.push(`<div class="hm-cell hm-${level}" title="${tip}"></div>`);
    cur.setDate(cur.getDate() + 1);
  }
  $('#heatmap').innerHTML = cells.join('');
}

/* ============================================================
   周视图
   ============================================================ */
function renderWeek() {
  const d = parseDate(state.currentDate);
  const dow = (d.getDay() + 6) % 7; // 周一为起点
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const data = loadData();
  const todayStr = fmtDate(new Date());
  const dows = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const ds = fmtDate(cur);
    const e = data[ds] || { tasks: [] };
    const tot = e.tasks.length;
    const don = e.tasks.filter(t => t.done).length;
    const pct = tot ? Math.round(don / tot * 100) : 0;
    const top = [...e.tasks]
      .sort((a, b) => ((a.order ?? 99) - (b.order ?? 99)) || (a.time || '99').localeCompare(b.time || '99'))
      .slice(0, 4);
    const more = tot - top.length;
    cells.push(`
      <div class="week-day ${ds === todayStr ? 'today' : ''}" data-date="${ds}">
        <div class="wd-head">
          <span class="wd-dow">${dows[i]}</span>
          <span class="wd-date">${cur.getMonth() + 1}/${cur.getDate()}</span>
        </div>
        <div class="week-ring" style="--p:${pct}"><span>${don}/${tot}</span></div>
        <ul class="week-tasks">
          ${top.map(t => `<li class="${t.done ? 'done' : ''}"><span class="dot"></span><span>${escapeHtml(t.title)}</span></li>`).join('') || '<li class="week-none">（无任务）</li>'}
          ${more > 0 ? `<li class="week-more">+${more} 项…</li>` : ''}
        </ul>
      </div>`);
  }
  const grid = $('#weekGrid');
  grid.innerHTML = cells.join('');
  $$('.week-day', grid).forEach(c => c.onclick = () => {
    state.currentDate = c.dataset.date; syncDateUI(); switchView('plan'); renderAll();
  });
}

/* ============================================================
   月视图
   ============================================================ */
function renderMonth() {
  const y = state.monthView.getFullYear();
  const m = state.monthView.getMonth();
  $('#monthTitle').textContent = `${y} 年 ${m + 1} 月`;
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const data = loadData();
  const todayStr = fmtDate(new Date());
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="mcell muted"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = fmtDate(new Date(y, m, day));
    const e = data[ds];
    const tot = e ? e.tasks.length : 0;
    const don = e ? e.tasks.filter(t => t.done).length : 0;
    const pct = tot ? Math.round(don / tot * 100) : 0;
    const rating = e && e.rating ? e.rating : 0;
    const cls = ['mcell'];
    if (ds === todayStr) cls.push('today');
    if (ds === state.currentDate) cls.push('selected');
    if (e && (tot || (e.notes && e.notes.trim()))) cls.push('has-data');
    cells.push(`
      <div class="${cls.join(' ')}" data-date="${ds}">
        <div class="mcell-head"><span class="mday">${day}</span>${rating ? `<span class="mrating">${'★'.repeat(rating)}</span>` : ''}</div>
        <div class="mcell-bar"><div class="mcell-fill" style="width:${pct}%"></div></div>
        <div class="mcell-meta">${tot ? don + '/' + tot : ''}</div>
      </div>`);
  }
  const grid = $('#monthGrid');
  grid.innerHTML = cells.join('');
  $$('.mcell[data-date]', grid).forEach(c => c.onclick = () => {
    state.currentDate = c.dataset.date; syncDateUI(); switchView('plan'); renderAll();
  });
}

/* ============================================================
   每日评分
   ============================================================ */
function renderRating() {
  const day = getDay(state.currentDate);
  const r = day.rating || 0;
  const box = $('#dayRating');
  box.innerHTML = [1, 2, 3, 4, 5].map(i => `<button class="star ${i <= r ? 'on' : ''}" data-star="${i}" title="${i} 星">★</button>`).join('');
  $$('#dayRating .star').forEach(b => b.onclick = () => setRating(+b.dataset.star));
}
function setRating(v) {
  updateDay(state.currentDate, d => { d.rating = (d.rating === v ? 0 : v); });
  renderRating(); renderMonth(); renderStats(); renderMiniStats();
}

/* ============================================================
   任务到点提醒
   ============================================================ */
const reminded = {};
function startReminderChecker() {
  try { setInterval(checkDueTasks, 30000); } catch (e) { /* 环境不支持则忽略 */ }
  checkDueTasks();
}
function checkDueTasks() {
  const now = new Date();
  const today = fmtDate(now);
  if (state.currentDate !== today) return;
  const day = getDay(today);
  if (!day.tasks.length) return;
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  day.tasks.forEach(t => {
    if (t.done || !t.time) return;
    if (t.time <= hhmm) {
      if (!reminded[today]) reminded[today] = new Set();
      if (reminded[today].has(t.id)) return;
      reminded[today].add(t.id);
      const msg = '⏰ 该做「' + t.title + '」了（计划 ' + t.time + '）';
      toast(msg);
      notify('⏰ 任务提醒', '该做「' + t.title + '」啦（计划 ' + t.time + '）');
    }
  });
}

/* ============================================================
   专注完成提示音
   ============================================================ */
function playChime() {
  if (state.settings.soundOn === false) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.62);
    o.onended = () => { try { ctx.close(); } catch (e) {} };
  } catch (e) { /* 不支持则忽略 */ }
}

/* ============================================================
   迷你统计
   ============================================================ */
function renderMiniStats() {
  const day = getDay(state.currentDate);
  const done = day.tasks.filter(t => t.done).length;
  const noteLen = (day.notes || '').length;
  const focus = day.focusMinutes || 0;
  const goal = state.settings.dailyGoal || 0;
  const habits = loadHabits();
  const dayHabits = getDayHabits(state.currentDate);
  const habitDone = habits.length ? habits.filter(h => dayHabits[h.id]).length : 0;
  let goalRow = '';
  if (goal > 0) {
    const diff = goal - done;
    goalRow = `<div class="ms-row"><span>每日目标</span><b>${diff > 0 ? '还差 ' + diff + ' 项' : '已达成 🎉'}</b></div>`;
  }
  let weekRow = '';
  const wGoal = state.settings.weeklyGoal || 0;
  if (wGoal > 0) {
    const wDone = weeklyDoneCount();
    const wPct = Math.min(100, Math.round(wDone / wGoal * 100));
    weekRow = `<div class="ms-row ms-week"><span>本周目标</span><b>${wDone}/${wGoal}${wDone >= wGoal ? ' 🎉' : ''}</b></div>
      <div class="ms-week-bar"><div class="ms-week-fill" style="width:${wPct}%"></div></div>`;
  }
  $('#miniStats').innerHTML = `
    <div class="ms-row"><span>今日任务</span><b>${done}/${day.tasks.length}</b></div>
    <div class="ms-row"><span>今日专注</span><b>⏱ ${focus} 分</b></div>
    <div class="ms-row"><span>习惯打卡</span><b>${habitDone}/${habits.length}</b></div>
    <div class="ms-row"><span>笔记字数</span><b>${noteLen}</b></div>
    <div class="ms-row"><span>连续打卡</span><b>🔥 ${computeStats().streak}</b></div>
    ${goalRow}
    ${weekRow}`;
}

/* ============================================================
   专注计时（番茄钟）
   ============================================================ */
const timer = { id: null, remain: 0, total: 0, mode: 'focus', round: 1, running: false, taskId: '' };

// 填充「关联任务」下拉：列出当天未完成任务，保留当前选择
function renderFocusTaskSelect() {
  const sel = $('#focusTaskSel');
  if (!sel) return;
  const day = getDay(state.currentDate);
  const pending = day.tasks.filter(t => !t.done);
  // 若当前关联的任务已不在待办列表（被完成/删除/切换日期），清空关联
  if (timer.taskId && !pending.some(t => t.id === timer.taskId)) timer.taskId = '';
  const opts = ['<option value="">不关联（自由专注）</option>']
    .concat(pending.map(t => {
      const label = (t.time ? t.time + ' ' : '') + t.title + (t.focusMin ? ` · 已专注${t.focusMin}分` : '');
      return `<option value="${escapeHtml(t.id)}" ${t.id === timer.taskId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }));
  sel.innerHTML = opts.join('');
}
const RING_LEN = 2 * Math.PI * 100;

function notify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'icon.svg' });
    }
  } catch (e) { /* 忽略通知异常 */ }
}

function updateFocusBadge() {
  const badge = $('#focusBadge');
  if (timer.running) {
    badge.hidden = false;
    badge.classList.toggle('break', timer.mode === 'break');
    $('#focusBadgeTime').textContent = $('#timerTime').textContent;
    $('#focusBadgeMode').textContent = timer.mode === 'focus' ? '专注' : '休息';
  } else badge.hidden = true;
}

function bindTimer() {
  $('#focusMin').value = state.settings.focusMin;
  $('#breakMin').value = state.settings.breakMin;
  $('#soundOn').checked = state.settings.soundOn !== false;
  $('#soundOn').onchange = (e) => { state.settings.soundOn = e.target.checked; saveSettings(state.settings); };
  $('#focusMin').onchange = (e) => { state.settings.focusMin = +e.target.value || 25; saveSettings(state.settings); if (!timer.running && timer.mode === 'focus') resetTimer(); };
  $('#breakMin').onchange = (e) => { state.settings.breakMin = +e.target.value || 5; saveSettings(state.settings); if (!timer.running && timer.mode === 'break') resetTimer(); };
  $('#timerToggle').onclick = () => {
    if (!timer.running && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch (e) { /* 不支持则忽略 */ }
    }
    toggleTimer();
  };
  $('#timerReset').onclick = resetTimer;
  $('#immersiveBtn').onclick = toggleImmersive;
  $('#immersiveExit').onclick = toggleImmersive;
  const sel = $('#focusTaskSel');
  if (sel) sel.onchange = (e) => { timer.taskId = e.target.value; };
  renderFocusTaskSelect();
  resetTimer();
}
function resetTimer() {
  clearInterval(timer.id); timer.running = false;
  timer.total = (timer.mode === 'focus' ? state.settings.focusMin : state.settings.breakMin) * 60;
  timer.remain = timer.total;
  $('#timerToggle').textContent = '开始';
  paintTimer();
  updateFocusBadge();
}
function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.id); timer.running = false; $('#timerToggle').textContent = '继续';
  } else {
    timer.running = true; $('#timerToggle').textContent = '暂停';
    timer.id = setInterval(tick, 1000);
  }
  updateFocusBadge();
}
function tick() {
  timer.remain--;
  if (timer.remain <= 0) {
    clearInterval(timer.id); timer.running = false;
    if (timer.mode === 'focus') {
      const mins = state.settings.focusMin;
      let linkedTitle = '';
      const focusTask = timer.taskId ? (getDay(state.currentDate).tasks.find(x => x.id === timer.taskId) || null) : null;
      const focusCat = focusTask ? focusTask.category : '未分类';
      updateDay(state.currentDate, d => {
        d.focusMinutes = (d.focusMinutes || 0) + mins;
        if (!d.focusByCat) d.focusByCat = {};
        d.focusByCat[focusCat] = (d.focusByCat[focusCat] || 0) + mins;
        if (focusTask) {
          const t = d.tasks.find(x => x.id === focusTask.id);
          if (t) { t.focusMin = (t.focusMin || 0) + mins; linkedTitle = t.title; }
        }
      });
      // 记录一条专注 session（番茄日志）
      recordFocusSession(mins, focusCat, focusTask ? focusTask.id : '', linkedTitle);
      // 关联「专注型」目标：番茄钟专注自动累计进度
      const goals = loadGoals();
      const lkGoals = goals.filter(g => g.type === 'focus' && (g.linkCat || '') === focusCat);
      if (lkGoals.length) {
        lkGoals.forEach(g => {
          const target = Math.max(1, g.focusTarget || 1);
          const before = g.focusMin || 0;
          g.focusMin = before + mins;
          if (before < target && g.focusMin >= target) toast('🎉 目标达成：' + g.name);
        });
        saveGoals(goals);
        renderGoals();
      }
      toast(linkedTitle ? `专注完成！「${linkedTitle}」+${mins} 分 ☕` : '专注完成！已记录 ' + mins + ' 分钟 ☕');
      notify('专注完成 ☕', (linkedTitle ? `「${linkedTitle}」` : '') + `已记录 ${mins} 分钟，休息一下吧`);
      playChime();
      renderPlan(); renderMiniStats(); renderStats(); renderFocusTaskSelect(); checkBadges();
      timer.mode = 'break'; timer.round++;
    } else {
      toast('休息结束，继续加油 💪');
      notify('休息结束 💪', '开始下一轮专注吧！');
      playChime();
      timer.mode = 'focus';
    }
    resetTimer();
    return;
  }
  paintTimer();
}
function paintTimer() {
  const m = String(Math.floor(timer.remain / 60)).padStart(2, '0');
  const s = String(timer.remain % 60).padStart(2, '0');
  $('#timerTime').textContent = `${m}:${s}`;
  $('#timerMode').textContent = timer.mode === 'focus' ? '专注' : '休息';
  $('#timerRound').textContent = `第 ${timer.round} 轮`;
  const ratio = timer.remain / timer.total;
  const fg = $('#ringFg');
  fg.style.strokeDasharray = RING_LEN;
  fg.style.strokeDashoffset = RING_LEN * (1 - ratio);
  fg.style.stroke = timer.mode === 'focus' ? 'var(--primary)' : 'var(--success)';
  updateFocusBadge();
}

/* ============================================================
   视图切换
   ============================================================ */
function switchView(view) {
  state.currentView = view;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'stats') renderStats();
  if (view === 'week') renderWeek();
  if (view === 'month') renderMonth();
  if (view === 'notes' && !$('#notePreview').hidden) $('#notePreview').innerHTML = renderMarkdown($('#noteArea').value);
  if (view === 'search') renderSearch($('#searchInput').value);
  if (view === 'focus') renderFocusTaskSelect();
}

/* ============================================================
   主题
   ============================================================ */
function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveSettings(state.settings);
}

/* ============================================================
   导出
   ============================================================ */
function doExport(type) {
  const day = getDay(state.currentDate);
  if (type === 'md') exportMarkdown(day);
  else if (type === 'csv') exportCsv(day);
  else if (type === 'pdf') exportPdf(day);
  else if (type === 'week') exportRangeMarkdown(weekRange(), '本周');
  else if (type === 'month') exportRangeMarkdown(monthRange(), '本月');
  else if (type === 'card') openShareCard();
}
function weekRange() {
  const d = parseDate(state.currentDate);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d); monday.setDate(d.getDate() - dow);
  const arr = [];
  for (let i = 0; i < 7; i++) { const c = new Date(monday); c.setDate(monday.getDate() + i); arr.push(fmtDate(c)); }
  return arr;
}
function monthRange() {
  const y = state.monthView.getFullYear(), m = state.monthView.getMonth();
  const arr = [];
  const n = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= n; day++) arr.push(fmtDate(new Date(y, m, day)));
  return arr;
}
function exportRangeMarkdown(dates, label) {
  const data = loadData();
  const lines = [`# 学习计划 · ${label}（${dates[0]} ~ ${dates[dates.length - 1]}）`, ''];
  let any = false;
  dates.forEach(ds => {
    const e = data[ds];
    if (!e || (!e.tasks.length && !(e.notes && e.notes.trim()))) return;
    any = true;
    const don = e.tasks.filter(t => t.done).length;
    lines.push(`## ${ds} ${weekdayCN(ds)} ｜ 完成 ${don}/${e.tasks.length}` + (e.rating ? ` ｜ 评分 ${e.rating}★` : ''));
    if (e.tasks.length) e.tasks.forEach(t => lines.push(`- ${t.time ? t.time + ' ' : ''}${t.title}（${t.category}·${t.priority}）${t.done ? ' ✅' : ''}`));
    if (e.notes && e.notes.trim()) lines.push('', '> ' + e.notes.replace(/\n/g, '\n> '));
    lines.push('');
  });
  if (!any) lines.push('_（该区间暂无记录）_');
  download(`${label}-${dates[0]}.md`, lines.join('\n'), 'text/markdown');
  toast('已导出' + label);
}
/* ============================================================
   分享卡（把当日战绩渲染成可下载的图片）
   ============================================================ */
function buildShareCard(date) {
  const d = getDay(date);
  const tasks = (d.tasks || []).map(t => ({ title: t.title, done: !!t.done, cat: t.category, time: t.time || '' }));
  const done = tasks.filter(t => t.done).length;
  const focusMin = typeof d.focusMinutes === 'number' ? d.focusMinutes : 0;
  const rating = d.rating || 0;
  const st = computeStats();
  return {
    date, weekday: weekdayCN(date),
    tasks, done, total: tasks.length,
    focusMin, rating,
    streak: st.streak,
    accent: state.settings.accent || '#3b6cf6',
  };
}
function renderShareCard() {
  const c = buildShareCard(state.currentDate);
  const prev = $('#sharePreview');
  const taskHtml = c.tasks.slice(0, 12).map(t => `
    <div class="sc-task ${t.done ? 'done' : ''}">
      <span class="sc-check">${t.done ? '✓' : ''}</span>
      <span class="sc-dot" style="background:${catColor(t.cat)}"></span>
      <span class="sc-title">${escapeHtml(t.title)}</span>
      <span class="sc-cat">${escapeHtml(t.cat)}</span>
    </div>`).join('') || '<div class="sc-empty">今天还没有任务，去计划页添加吧～</div>';
  prev.innerHTML = `
  <div class="share-card" style="--sc-accent:${c.accent}">
    <div class="sc-top">
      <span class="sc-logo">📚 LearnLog</span>
      <span class="sc-date">${c.date} · ${c.weekday}</span>
    </div>
    <div class="sc-stats">
      <div class="sc-stat"><b>${c.done}/${c.total}</b><span>完成</span></div>
      <div class="sc-stat"><b>🔥 ${c.streak}</b><span>连续天</span></div>
      <div class="sc-stat"><b>⏱ ${c.focusMin}</b><span>专注分</span></div>
      <div class="sc-stat"><b>${c.rating ? c.rating + '★' : '—'}</b><span>评分</span></div>
    </div>
    <div class="sc-list">${taskHtml}</div>
    <div class="sc-foot">学而时习之 · 用 LearnLog 记录每一天</div>
  </div>`;
}
function openShareCard() { renderShareCard(); $('#shareModal').hidden = false; }
function scShade(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function downloadShareCard() {
  const c = buildShareCard(state.currentDate);
  const cv = document.createElement('canvas');
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) { toast('当前环境不支持导出图片'); return; }
  const W = 1080, H = 1350, PAD = 64;
  cv.width = W; cv.height = H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, c.accent); bg.addColorStop(1, scShade(c.accent, -28));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 白色面板
  const rx = PAD, ry = PAD, rw = W - PAD * 2, rh = H - PAD * 2, rr = 36;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, rr); else ctx.rect(rx, ry, rw, rh);
  ctx.fill();
  const M = rx + 56;
  let y = ry + 80;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.accent;
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.fillText('📚 LearnLog', M, y);
  ctx.fillStyle = '#9aa0ad';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(c.date + ' · ' + c.weekday, rx + rw - 56, y);
  ctx.textAlign = 'left';
  y += 56;
  ctx.strokeStyle = '#eef0f4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(rx + rw - 56, y); ctx.stroke();
  // 统计
  y += 90;
  const stats = [['完成', c.done + '/' + c.total], ['连续天', '🔥 ' + c.streak], ['专注分', '⏱ ' + c.focusMin], ['评分', c.rating ? c.rating + '★' : '—']];
  const sw = (rw - 112) / 4;
  stats.forEach((s, i) => {
    const sx = M + i * sw;
    ctx.fillStyle = c.accent; ctx.font = '700 46px system-ui, sans-serif';
    ctx.fillText(s[1], sx, y + 10);
    ctx.fillStyle = '#9aa0ad'; ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillText(s[0], sx, y + 50);
  });
  y += 110;
  ctx.strokeStyle = '#eef0f4'; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(rx + rw - 56, y); ctx.stroke();
  // 任务列表
  y += 70;
  ctx.font = '500 30px system-ui, sans-serif';
  c.tasks.slice(0, 12).forEach(t => {
    ctx.fillStyle = t.done ? c.accent : '#cfd3da';
    ctx.fillText(t.done ? '✓' : '○', M, y);
    ctx.fillStyle = t.done ? '#2b2f36' : '#9aa0ad';
    const label = (t.time ? t.time + ' ' : '') + t.title;
    ctx.fillText(label.length > 26 ? label.slice(0, 26) + '…' : label, M + 50, y);
    ctx.fillStyle = catColor(t.cat); ctx.font = '600 22px system-ui, sans-serif';
    const catw = ctx.measureText(t.cat).width;
    ctx.fillText(t.cat, rx + rw - 56 - catw, y);
    ctx.font = '500 30px system-ui, sans-serif';
    y += 58;
  });
  if (!c.tasks.length) {
    ctx.fillStyle = '#9aa0ad'; ctx.fillText('今天还没有任务，去计划页添加吧～', M, y);
  }
  // 页脚
  ctx.fillStyle = '#b6bcc6'; ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('学而时习之 · 用 LearnLog 记录每一天', M, ry + rh - 48);
  cv.toBlob((blob) => {
    if (!blob) { toast('生成图片失败'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `LearnLog-${c.date}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已下载分享卡');
  });
}
function exportMarkdown(day) {
  const lines = [];
  lines.push(`# 学习计划 · ${state.currentDate} ${weekdayCN(state.currentDate)}`);
  lines.push('');
  const done = day.tasks.filter(t => t.done).length;
  lines.push(`> 完成进度：${done}/${day.tasks.length}`);
  lines.push('');
  lines.push('## 任务清单');
  if (day.tasks.length) {
    lines.push('| 时间 | 任务 | 分类 | 优先级 | 状态 |');
    lines.push('| --- | --- | --- | --- | --- |');
    [...day.tasks].sort((a, b) => ((a.order ?? 99) - (b.order ?? 99)) || (a.time || '99').localeCompare(b.time || '99'))
      .forEach(t => lines.push(`| ${t.time || '-'} | ${t.title} | ${t.category} | ${t.priority} | ${t.done ? '✅ 已完成' : '⬜ 待完成'} |`));
  } else lines.push('_（无任务）_');
  if (day.notes && day.notes.trim()) {
    lines.push('');
    lines.push('## 笔记');
    lines.push('');
    lines.push(day.notes);
  }
  download(`${state.currentDate}-计划.md`, lines.join('\n'), 'text/markdown');
  toast('已导出 Markdown');
}
function exportCsv(day) {
  const rows = [['时间', '任务', '分类', '优先级', '状态']];
  [...day.tasks].sort((a, b) => ((a.order ?? 99) - (b.order ?? 99)) || (a.time || '99').localeCompare(b.time || '99'))
    .forEach(t => rows.push([t.time || '', t.title, t.category, t.priority, t.done ? '已完成' : '待完成']));
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(`${state.currentDate}-计划.csv`, csv, 'text/csv');
  toast('已导出 CSV');
}
function exportPdf(day) {
  const done = day.tasks.filter(t => t.done).length;
  let html = `<h1>学习计划</h1><div class="print-date">${state.currentDate} ${weekdayCN(state.currentDate)} ｜ 完成进度 ${done}/${day.tasks.length}</div>`;
  html += '<h2>任务清单</h2><table><thead><tr><th>时间</th><th>任务</th><th>分类</th><th>优先级</th><th>状态</th></tr></thead><tbody>';
  if (day.tasks.length) {
    [...day.tasks].sort((a, b) => ((a.order ?? 99) - (b.order ?? 99)) || (a.time || '99').localeCompare(b.time || '99')).forEach(t => {
      html += `<tr><td>${t.time || '-'}</td><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.category)}</td><td>${t.priority}</td><td class="${t.done ? 'done-mark' : 'pending-mark'}">${t.done ? '已完成' : '待完成'}</td></tr>`;
    });
  } else html += '<tr><td colspan="5">（无任务）</td></tr>';
  html += '</tbody></table>';
  if (day.notes && day.notes.trim()) {
    html += '<h2>笔记</h2><pre style="white-space:pre-wrap;font-family:inherit;line-height:1.7">' + escapeHtml(day.notes) + '</pre>';
  }
  const pa = $('#printArea');
  pa.innerHTML = html;
  pa.hidden = false;
  setTimeout(() => { window.print(); pa.hidden = true; }, 100);
}
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* ============================================================
   数据文件备份（导出 / 导入 .json）
   ============================================================ */
function serializeAll() {
  return {
    app: 'LearnLog', version: 1,
    exportedAt: new Date().toISOString(),
    data: loadData(),
    settings: loadSettings(),
    templates: loadTemplates(),
    badges: loadBadges(),
    habits: loadHabits(),
    goals: loadGoals(),
    sessions: loadSessions(),
    recurring: loadRecurring(),
    backups: loadBackups(),
  };
}
function exportDataFile() {
  const pkg = serializeAll();
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  download('LearnLog-数据备份-' + stamp + '.json', JSON.stringify(pkg, null, 2), 'application/json');
  toast('已导出数据备份文件');
}
function importDataObject(obj) {
  if (!obj || typeof obj !== 'object') { toast('文件格式不正确'); return false; }
  const safe = (v, d) => (v && typeof v === 'object' ? v : d);
  saveData(safe(obj.data, {}));
  saveSettings(safe(obj.settings, loadSettings()));
  saveTemplates(safe(obj.templates, []));
  saveBadges(safe(obj.badges, {}));
  saveHabits(safe(obj.habits, []));
  saveGoals(safe(obj.goals, []));
  saveSessions(safe(obj.sessions, []));
  saveRecurring(safe(obj.recurring, []));
  saveBackups(safe(obj.backups, []));
  reloadState();
  renderRecurring();
  return true;
}
function importDataFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result));
      const ok = importDataObject(obj);
      if (ok) { toast('已从文件恢复数据'); if (!$('#backupModal').hidden) renderBackupList(); }
    } catch (e) { toast('解析失败：不是有效的备份文件'); }
  };
  reader.onerror = () => toast('读取文件失败');
  reader.readAsText(file);
}

/* ============================================================
   分类管理
   ============================================================ */
function openCatModal() { $('#catModal').hidden = false; renderCatList(); }
function renderCatList() {
  const cats = state.settings.categories;
  $('#catList').innerHTML = cats.map((c, i) => `
    <li data-i="${i}">
      <input type="color" value="${state.settings.catColors[c] || CAT_PALETTE[i % CAT_PALETTE.length]}" data-act="color" />
      <input type="text" class="cat-name" value="${escapeHtml(c)}" maxlength="12" data-act="name" />
      <button class="cat-del" data-act="del" title="删除">×</button>
    </li>`).join('');
  $$('#catList li').forEach(li => {
    const i = +li.dataset.i;
    li.querySelector('[data-act="color"]').oninput = (e) => {
      state.settings.catColors[cats[i]] = e.target.value; saveSettings(state.settings);
      refreshCategorySelect(); renderPlan(); renderStats();
    };
    li.querySelector('[data-act="name"]').onchange = (e) => renameCategory(cats[i], e.target.value.trim());
    li.querySelector('[data-act="del"]').onclick = () => deleteCategory(cats[i]);
  });
}
function renameCategory(oldName, newName) {
  if (!newName || newName === oldName) { renderCatList(); return; }
  if (state.settings.categories.includes(newName)) { toast('分类已存在'); renderCatList(); return; }
  const idx = state.settings.categories.indexOf(oldName);
  state.settings.categories[idx] = newName;
  state.settings.catColors[newName] = state.settings.catColors[oldName];
  delete state.settings.catColors[oldName];
  const data = loadData();
  Object.values(data).forEach(d => (d.tasks || []).forEach(t => { if (t.category === oldName) t.category = newName; }));
  saveData(data); saveSettings(state.settings);
  refreshCategorySelect(); renderCatList(); renderPlan(); renderStats(); renderCalendar();
  toast('已重命名分类');
}
function deleteCategory(name) {
  if (state.settings.categories.length <= 1) { toast('至少保留一个分类'); return; }
  const fallback = state.settings.categories.find(c => c !== name);
  if (!confirm(`删除分类「${name}」？相关任务将归入「${fallback}」`)) return;
  state.settings.categories = state.settings.categories.filter(c => c !== name);
  delete state.settings.catColors[name];
  const data = loadData();
  Object.values(data).forEach(d => (d.tasks || []).forEach(t => { if (t.category === name) t.category = fallback; }));
  saveData(data); saveSettings(state.settings);
  refreshCategorySelect(); renderCatList(); renderPlan(); renderStats(); renderCalendar();
  toast('已删除分类');
}
function addCategory() {
  const name = $('#catNewName').value.trim();
  if (!name) { toast('请输入分类名称'); return; }
  if (state.settings.categories.includes(name)) { toast('分类已存在'); return; }
  state.settings.categories.push(name);
  state.settings.catColors[name] = $('#catNewColor').value;
  saveSettings(state.settings);
  $('#catNewName').value = '';
  refreshCategorySelect(); renderCatList(); renderPlan();
  toast('已添加分类');
}

/* ============================================================
   计划模板
   ============================================================ */
function openTplModal() { $('#tplModal').hidden = false; renderTplList(); $('#tplName').focus(); }
function renderTplList() {
  const tpls = loadTemplates();
  $('#tplList').innerHTML = tpls.length ? tpls.map(t => `
    <li data-id="${t.id}">
      <span class="tpl-name">${escapeHtml(t.name)}</span>
      <span class="tpl-count">${t.tasks.length} 项</span>
      <button class="tpl-load" data-act="load">载入</button>
      <button class="tpl-del" data-act="del" title="删除">×</button>
    </li>`).join('') : '<li class="tpl-empty">还没有模板，保存当前计划为模板吧</li>';
  $$('#tplList li[data-id]').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('[data-act="load"]').onclick = () => loadTemplate(id);
    li.querySelector('[data-act="del"]').onclick = () => deleteTemplate(id);
  });
}
function saveTemplateFromDay() {
  const name = $('#tplName').value.trim();
  if (!name) { toast('请输入模板名称'); return; }
  const day = getDay(state.currentDate);
  if (!day.tasks.length) { toast('今日暂无任务可保存'); return; }
  const tpls = loadTemplates();
  if (tpls.some(t => t.name === name)) { toast('同名模板已存在'); return; }
  tpls.push({
    id: uid(), name,
    tasks: day.tasks.map(t => ({ time: t.time, title: t.title, category: t.category, priority: t.priority })),
  });
  saveTemplates(tpls);
  $('#tplName').value = '';
  renderTplList();
  toast('已保存模板「' + name + '」');
}
function loadTemplate(id) {
  const tpls = loadTemplates();
  const tpl = tpls.find(t => t.id === id);
  if (!tpl) return;
  let added = 0;
  updateDay(state.currentDate, day => {
    tpl.tasks.forEach(t => {
      if (day.tasks.some(x => x.title === t.title && x.category === t.category)) return;
      day.tasks.push({ id: uid(), time: t.time, title: t.title, category: t.category, priority: t.priority, done: false, order: day.tasks.length });
      added++;
    });
  });
  $('#tplModal').hidden = true;
  renderAll();
  toast('已载入模板「' + tpl.name + '」（+' + added + ' 项）');
}
function deleteTemplate(id) {
  const tpls = loadTemplates();
  const tpl = tpls.find(t => t.id === id);
  if (!tpl) return;
  if (!confirm('删除模板「' + tpl.name + '」？')) return;
  saveTemplates(tpls.filter(t => t.id !== id));
  renderTplList();
  toast('已删除模板');
}

/* ============================================================
   数据备份 / 恢复
   ============================================================ */
function exportAll() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), data: loadData(), settings: state.settings };
  download(`learnlog-全部数据-${fmtDate(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json');
  toast('已导出全部数据');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj.data || typeof obj.data !== 'object') throw new Error('文件格式不正确');
      if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
      saveData(obj.data);
      if (obj.settings) { state.settings = { ...state.settings, ...obj.settings }; ensureCatColors(); saveSettings(state.settings); }
      refreshCategorySelect(); renderAll();
      toast('导入成功');
    } catch (err) { toast('导入失败：' + err.message); }
  };
  reader.readAsText(file);
}
function loadSample() {
  if (!confirm('将生成示例数据（覆盖今天及前 3 天），确定？')) return;
  const base = {
    tasks: [
      { time: '09:00', title: '阅读《深入理解计算机系统》第3章', category: '学习', priority: '高', done: true },
      { time: '14:00', title: '完成算法练习题 5 道', category: '学习', priority: '中', done: false },
      { time: '19:30', title: '英语听力 30 分钟', category: '学习', priority: '低', done: false },
      { time: '21:00', title: '健身房：胸+三头', category: '健身', priority: '中', done: true },
    ],
    notes: '今天效率不错，上午专注读了两小时书。\n明天计划把算法题补完，并预习下一周内容。',
    focusMinutes: 50,
  };
  const data = loadData();
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const ds = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    const entry = JSON.parse(JSON.stringify(base));
    entry.tasks = entry.tasks.map((t, idx) => ({ ...t, id: uid(), order: idx }));
    entry.focusMinutes = i === 0 ? 50 : 25 * (i + 1);
    data[ds] = entry;
  }
  saveData(data);
  renderAll();
  toast('已生成示例数据');
}
function clearAll() {
  if (!confirm('确定清空全部数据？此操作不可恢复！')) return;
  localStorage.removeItem(DATA_KEY);
  renderAll();
  toast('已清空全部数据');
}
function copyPlanToTomorrow() {
  const src = getDay(state.currentDate);
  if (!src.tasks.length) { toast('今日暂无任务可复制'); return; }
  const d = parseDate(state.currentDate); d.setDate(d.getDate() + 1);
  const target = fmtDate(d);
  let added = 0;
  updateDay(target, day => {
    src.tasks.forEach(t => {
      if (day.tasks.some(x => x.title === t.title && x.category === t.category)) return;
      day.tasks.push({ id: uid(), time: t.time, title: t.title, category: t.category, priority: t.priority, done: false, order: day.tasks.length });
      added++;
    });
  });
  if (!added) { toast('明天的任务已存在，无需重复添加'); return; }
  state.currentDate = target; syncDateUI(); renderAll();
  toast('已复制到明天（+' + added + ' 项）');
}

/* ============================================================
   全局搜索
   ============================================================ */
function renderSearch(q) {
  const box = $('#searchResults');
  const tagBar = $('#tagBar');
  q = q.trim().toLowerCase();
  const data = loadData();

  // 标签栏：汇总全部标签，可点击筛选
  const allTags = new Map();
  Object.values(data).forEach(e => {
    (e.tasks || []).forEach(t => (t.tags || []).forEach(tg => allTags.set(tg, (allTags.get(tg) || 0) + 1)));
    extractTags(e.notes || '').forEach(tg => allTags.set(tg, (allTags.get(tg) || 0) + 1));
  });
  tagBar.innerHTML = allTags.size ? '<span class="tag-bar-label">标签</span>' + [...allTags.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `<button class="tag-chip search-tag ${state.searchTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}<i>${c}</i></button>`)
    .join('') : '';
  tagBar.querySelectorAll('.search-tag').forEach(b => b.onclick = () => {
    state.searchTag = state.searchTag === b.dataset.tag ? '' : b.dataset.tag;
    renderSearch($('#searchInput').value);
  });

  if (!q && !state.searchTag) { box.innerHTML = '<p class="empty-hint">输入关键词，或点上方标签筛选跨日期的任务与笔记</p>'; return; }
  const results = [];
  Object.keys(data).sort().reverse().forEach(ds => {
    const e = data[ds];
    const items = [];
    (e.tasks || []).forEach(t => {
      const tagHit = state.searchTag ? (t.tags || []).includes(state.searchTag) : true;
      const qHit = !q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      if (tagHit && qHit)
        items.push(`<li><span class="sr-tag">任务</span>${highlight(t.title, q || state.searchTag)} <span style="color:var(--text-soft)">· ${escapeHtml(t.category)} ${t.done ? '✅' : '⬜'}${(t.tags || []).map(tg => ' #' + escapeHtml(tg)).join('')}</span></li>`);
    });
    if (e.notes) {
      const nt = extractTags(e.notes);
      const tagHit = state.searchTag ? nt.includes(state.searchTag) : true;
      const qHit = !q || e.notes.toLowerCase().includes(q);
      if (tagHit && qHit) items.push(`<li><span class="sr-tag">笔记</span>${highlight(e.notes, q || state.searchTag, 80)}</li>`);
    }
    if (items.length) results.push(`<div class="search-day"><div class="search-day-head">${ds} ${weekdayCN(ds)}</div><ul>${items.join('')}</ul></div>`);
  });
  box.innerHTML = results.length ? results.join('') : '<p class="empty-hint">未找到匹配内容</p>';
}
function highlight(text, q, len) {
  text = String(text);
  let shown = text;
  if (len && text.length > len) {
    const i = text.toLowerCase().indexOf(q);
    const start = Math.max(0, i - 20);
    shown = (start > 0 ? '…' : '') + text.slice(start, start + len) + (text.length > start + len ? '…' : '');
  }
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return escapeHtml(shown).replace(re, '<mark>$1</mark>');
}

/* ============================================================
   渲染聚合 & Toast
   ============================================================ */
function renderAll() {
  syncDateUI();
  renderPlan();
  $('#noteArea').value = getDay(state.currentDate).notes || '';
  updateNoteCount();
  $('#noteSaveState').textContent = '';
  renderCalendar();
  renderMiniStats();
  renderHabits();
  renderGoals();
  renderStats();
  if ($('#view-search').classList.contains('active')) renderSearch($('#searchInput').value);
  if ($('#view-week').classList.contains('active')) renderWeek();
  if ($('#view-month').classList.contains('active')) renderMonth();
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 1800);
}

/* ============================================================
   PWA：注册 Service Worker（特性检测，失败静默）
   ============================================================ */
function registerSW() {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* 不支持则忽略，不影响主功能 */ }
}

/* ============================================================
   帮助弹窗
   ============================================================ */
function openHelp() { $('#helpModal').hidden = false; }
function closeHelp() { $('#helpModal').hidden = true; }

/* ============================================================
   成就徽章
   ============================================================ */
const BADGE_DEFS = {
  first_task: { icon: '🏁', name: '初出茅庐', desc: '完成第一个任务' },
  task_10: { icon: '🔟', name: '小有所成', desc: '累计完成 10 个任务' },
  task_50: { icon: '💯', name: '渐入佳境', desc: '累计完成 50 个任务' },
  task_100: { icon: '👑', name: '百炼成钢', desc: '累计完成 100 个任务' },
  streak_3: { icon: '🔥', name: '三连击', desc: '连续打卡 3 天' },
  streak_7: { icon: '⚡', name: '一周坚持', desc: '连续打卡 7 天' },
  streak_30: { icon: '🌟', name: '月度达人', desc: '连续打卡 30 天' },
  focus_first: { icon: '⏱', name: '专注入门', desc: '完成第一次专注' },
  focus_100: { icon: '🧠', name: '百日专注', desc: '累计专注 100 分钟' },
  focus_500: { icon: '🚀', name: '专注达人', desc: '累计专注 500 分钟' },
  note_first: { icon: '📝', name: '第一次记录', desc: '写下第一条笔记' },
  perfect_day: { icon: '🌈', name: '完美一天', desc: '一天完成所有任务（至少 3 项）' },
  early_bird: { icon: '🐦', name: '早起的鸟', desc: '在 8:00 前完成一个任务' },
  night_owl: { icon: '🦉', name: '夜猫子', desc: '在 22:00 后完成一个任务' },
  goal_done: { icon: '🏆', name: '目标达成', desc: '完成一个长期学习目标' },
};
function checkBadges() {
  const b = loadBadges();
  const earned = new Set(b.earned || []);
  const s = computeStats();
  const data = loadData();
  const now = new Date();
  const today = fmtDate(now);
  const todayDay = getDay(today);
  const justEarned = [];

  const tryAward = (id) => {
    if (BADGE_DEFS[id] && !earned.has(id)) {
      earned.add(id); justEarned.push(id);
    }
  };

  if (s.totalDone >= 1) tryAward('first_task');
  if (s.totalDone >= 10) tryAward('task_10');
  if (s.totalDone >= 50) tryAward('task_50');
  if (s.totalDone >= 100) tryAward('task_100');
  if (s.streak >= 3) tryAward('streak_3');
  if (s.streak >= 7) tryAward('streak_7');
  if (s.streak >= 30) tryAward('streak_30');
  if (s.focusTotal >= 25) tryAward('focus_first');
  if (s.focusTotal >= 100) tryAward('focus_100');
  if (s.focusTotal >= 500) tryAward('focus_500');
  if (Object.values(data).some(d => d.notes && d.notes.trim())) tryAward('note_first');
  if (todayDay.tasks.length >= 3 && todayDay.tasks.every(t => t.done)) tryAward('perfect_day');
  if (loadGoals().some(g => goalReached(g))) tryAward('goal_done');

  // 早鸟 / 夜猫子
  Object.values(data).forEach(d => {
    (d.tasks || []).forEach(t => {
      if (!t.done || !t.doneAt) return;
      const h = new Date(t.doneAt).getHours();
      if (h < 8) tryAward('early_bird');
      if (h >= 22) tryAward('night_owl');
    });
  });

  if (justEarned.length) {
    b.earned = [...earned];
    saveBadges(b);
    renderBadges();
    justEarned.forEach(id => toast('🏅 获得徽章：' + BADGE_DEFS[id].name));
  }
}
function renderBadges() {
  const b = loadBadges();
  const earned = new Set(b.earned || []);
  const box = $('#badges');
  if (!box) return;
  box.innerHTML = Object.entries(BADGE_DEFS).map(([id, def]) => `
    <div class="badge ${earned.has(id) ? 'earned' : ''}" title="${def.desc}">
      <div class="badge-icon">${def.icon}</div>
      <div class="badge-info">
        <span class="badge-name">${def.name}</span>
        <span class="badge-desc">${def.desc}</span>
      </div>
    </div>`).join('');
}

/* ============================================================
   习惯打卡
   ============================================================ */
function renderHabits() {
  const habits = loadHabits();
  const list = $('#habitsList');
  if (!list) return;
  if (!habits.length) {
    list.innerHTML = '<li class="habits-empty">暂无习惯，点击管理添加</li>';
    return;
  }
  const dayHabits = getDayHabits(state.currentDate);
  list.innerHTML = habits.map(h => {
    const done = !!dayHabits[h.id];
    return `
      <li data-id="${h.id}">
        <span class="hb-check ${done ? 'done' : ''}">${done ? '✓' : ''}</span>
        <span class="hb-name ${done ? 'done' : ''}">${escapeHtml(h.name)}</span>
      </li>`;
  }).join('');
  $$('#habitsList li').forEach(li => {
    li.onclick = () => toggleHabit(li.dataset.id);
  });
}
function toggleHabit(id) {
  updateDay(state.currentDate, d => {
    if (!d.habits) d.habits = {};
    d.habits[id] = !d.habits[id];
  });
  renderHabits(); renderMiniStats(); renderStats();
}
function openHabitModal() {
  $('#habitModal').hidden = false;
  renderHabitEditList();
  $('#habitNewName').focus();
}
function renderHabitEditList() {
  const habits = loadHabits();
  const list = $('#habitEditList');
  list.innerHTML = habits.length ? habits.map(h => `
    <li data-id="${h.id}">
      <span class="habit-name">${escapeHtml(h.name)}</span>
      <button class="habit-del" data-act="del" title="删除">×</button>
    </li>`).join('') : '<li class="tpl-empty">还没有习惯，添加一个吧</li>';
  $$('#habitEditList li[data-id]').forEach(li => {
    li.querySelector('[data-act="del"]').onclick = () => deleteHabit(li.dataset.id);
  });
}
function addHabit() {
  const name = $('#habitNewName').value.trim();
  if (!name) { toast('请输入习惯名称'); return; }
  const habits = loadHabits();
  if (habits.some(h => h.name === name)) { toast('习惯已存在'); return; }
  habits.push({ id: uid(), name, created: fmtDate(new Date()) });
  saveHabits(habits);
  $('#habitNewName').value = '';
  renderHabitEditList();
  renderHabits();
  toast('已添加习惯');
}
function deleteHabit(id) {
  let habits = loadHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return;
  if (!confirm('删除习惯「' + h.name + '」？')) return;
  habits = habits.filter(x => x.id !== id);
  saveHabits(habits);
  renderHabitEditList();
  renderHabits();
  toast('已删除习惯');
}

/* ============================================================
   学习目标（长期）
   ============================================================ */
function goalReached(g) {
  const t = g.type === 'focus' ? Math.max(1, g.focusTarget || 1) : Math.max(1, g.target || 1);
  const c = g.type === 'focus' ? Math.max(0, g.focusMin || 0) : Math.max(0, g.current || 0);
  return c >= t;
}
function renderGoals() {
  const goals = loadGoals();
  const list = $('#goalsList');
  if (!list) return;
  if (!goals.length) {
    list.innerHTML = '<li class="goals-empty">还没有目标，点「管理」添加一个长期目标吧</li>';
    return;
  }
  const todayStr = fmtDate(new Date());
  list.innerHTML = goals.map(g => {
    const isFocus = g.type === 'focus';
    const target = isFocus ? Math.max(1, g.focusTarget || 1) : Math.max(1, g.target || 1);
    const cur = isFocus ? Math.max(0, g.focusMin || 0) : Math.max(0, g.current || 0);
    const pct = Math.min(100, Math.round(cur / target * 100));
    const reached = goalReached(g);
    const unit = isFocus ? '分' : (g.unit || '');
    const sub = isFocus ? `<span class="goal-sub">🍅 ${escapeHtml(g.linkCat || '未分类')}</span>` : '';
    let ddl = '';
    if (g.deadline) {
      const left = Math.round((parseDate(g.deadline) - parseDate(todayStr)) / 86400000);
      ddl = reached ? '' : (left < 0 ? `<span class="goal-ddl over">已逾期</span>`
        : left === 0 ? `<span class="goal-ddl soon">今天截止</span>`
        : `<span class="goal-ddl${left <= 3 ? ' soon' : ''}">剩 ${left} 天</span>`);
    }
    const btns = isFocus
      ? '<span class="goal-auto">番茄钟自动累计</span>'
      : `<div class="goal-btns"><button class="goal-dec" data-act="dec" title="减一">−</button><button class="goal-inc" data-act="inc" title="加一">＋</button></div>`;
    return `
      <li data-id="${g.id}" class="${reached ? 'reached' : ''}">
        <div class="goal-top">
          <span class="goal-name">${reached ? '🏆 ' : ''}${escapeHtml(g.name)}</span>
          <span class="goal-num">${cur}/${target}${unit ? ' ' + escapeHtml(unit) : ''}</span>
        </div>
        ${sub}
        <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-foot">
          ${ddl || '<span class="goal-ddl none"></span>'}
          ${btns}
        </div>
      </li>`;
  }).join('');
  $$('#goalsList li[data-id]').forEach(li => {
    const id = li.dataset.id;
    const inc = li.querySelector('[data-act="inc"]');
    const dec = li.querySelector('[data-act="dec"]');
    if (inc) inc.onclick = () => incGoal(id, 1);
    if (dec) dec.onclick = () => incGoal(id, -1);
  });
}
function incGoal(id, delta) {
  const goals = loadGoals();
  const g = goals.find(x => x.id === id);
  if (!g || g.type === 'focus') return;
  const target = Math.max(1, g.target || 1);
  const before = g.current || 0;
  g.current = Math.max(0, before + delta);
  saveGoals(goals);
  renderGoals();
  if (before < target && goalReached(g)) {
    toast('🎉 目标达成：' + g.name);
    checkBadges();
  }
}
function openGoalModal() {
  $('#goalModal').hidden = false;
  $('#goalNewCat').innerHTML = state.settings.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  bindGoalTypeToggle();
  renderGoalEditList();
  $('#goalNewName').focus();
}
function bindGoalTypeToggle() {
  const sync = () => {
    const focus = document.querySelector('input[name="goalType"]:checked').value === 'focus';
    $('#goalNewTarget').style.display = focus ? 'none' : '';
    $('#goalNewUnit').style.display = focus ? 'none' : '';
    $('#goalNewCat').hidden = !focus;
    $('#goalNewFocusTarget').hidden = !focus;
  };
  $$('input[name="goalType"]').forEach(r => r.onchange = sync);
  sync();
}
function renderGoalEditList() {
  const goals = loadGoals();
  const list = $('#goalEditList');
  list.innerHTML = goals.length ? goals.map(g => {
    const meta = g.type === 'focus'
      ? `🍅 ${g.focusMin || 0}/${g.focusTarget}分 · ${escapeHtml(g.linkCat || '未分类')}`
      : `${Math.max(0, g.current || 0)}/${Math.max(1, g.target || 1)}${g.unit ? ' ' + escapeHtml(g.unit) : ''}`;
    return `
    <li data-id="${g.id}">
      <span class="goal-edit-name">${escapeHtml(g.name)}</span>
      <span class="goal-edit-meta">${meta}${g.deadline ? ' · ' + g.deadline : ''}</span>
      <button class="habit-del" data-act="del" title="删除">×</button>
    </li>`;
  }).join('') : '<li class="tpl-empty">还没有目标，添加一个吧</li>';
  $$('#goalEditList li[data-id]').forEach(li => {
    li.querySelector('[data-act="del"]').onclick = () => deleteGoal(li.dataset.id);
  });
}
function addGoal() {
  const name = $('#goalNewName').value.trim();
  if (!name) { toast('请输入目标名称'); return; }
  const type = document.querySelector('input[name="goalType"]:checked').value;
  const deadline = $('#goalNewDeadline').value || '';
  const goals = loadGoals();
  if (goals.some(g => g.name === name)) { toast('同名目标已存在'); return; }
  let goal;
  if (type === 'focus') {
    goal = {
      id: uid(), name, type,
      focusTarget: Math.max(1, parseInt($('#goalNewFocusTarget').value, 10) || 1),
      linkCat: $('#goalNewCat').value || '未分类',
      focusMin: 0, deadline, created: fmtDate(new Date()),
    };
  } else {
    goal = {
      id: uid(), name, type: 'count',
      target: Math.max(1, parseInt($('#goalNewTarget').value, 10) || 1),
      unit: $('#goalNewUnit').value.trim(),
      current: 0, deadline, created: fmtDate(new Date()),
    };
  }
  goals.push(goal);
  saveGoals(goals);
  $('#goalNewName').value = ''; $('#goalNewTarget').value = ''; $('#goalNewUnit').value = ''; $('#goalNewFocusTarget').value = ''; $('#goalNewDeadline').value = '';
  renderGoalEditList(); renderGoals();
  toast(type === 'focus' ? '已添加专注型目标（番茄钟自动累计）' : '已添加目标');
}
function deleteGoal(id) {
  let goals = loadGoals();
  const g = goals.find(x => x.id === id);
  if (!g) return;
  if (!confirm('删除目标「' + g.name + '」？')) return;
  goals = goals.filter(x => x.id !== id);
  saveGoals(goals);
  renderGoalEditList(); renderGoals();
  toast('已删除目标');
}

/* ============================================================
   一键周复盘
   ============================================================ */
function generateWeekReview() {
  const dates = weekRange();
  const data = loadData();
  const habits = loadHabits();
  let totTasks = 0, totDone = 0, focusSum = 0, ratingSum = 0, ratingCnt = 0, activeDays = 0;
  const catCount = {};
  const habitCount = {};
  const dayLines = [];
  dates.forEach(ds => {
    const e = data[ds];
    if (!e) return;
    const tot = (e.tasks || []).length;
    const don = (e.tasks || []).filter(t => t.done).length;
    const hasContent = tot || (e.notes && e.notes.trim());
    if (hasContent) activeDays++;
    totTasks += tot; totDone += don;
    focusSum += e.focusMinutes || 0;
    if (e.rating) { ratingSum += e.rating; ratingCnt++; }
    (e.tasks || []).forEach(t => { catCount[t.category] = (catCount[t.category] || 0) + 1; });
    if (e.habits) habits.forEach(h => { if (e.habits[h.id]) habitCount[h.name] = (habitCount[h.name] || 0) + 1; });
    if (hasContent) {
      dayLines.push(`- **${ds.slice(5)} ${weekdayCN(ds)}**：完成 ${don}/${tot}` +
        (e.focusMinutes ? ` · 专注 ${e.focusMinutes} 分` : '') +
        (e.rating ? ` · ${'★'.repeat(e.rating)}` : ''));
    }
  });
  const rate = totTasks ? Math.round(totDone / totTasks * 100) : 0;
  const avgRating = ratingCnt ? (ratingSum / ratingCnt).toFixed(1) : '—';
  const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topHabits = Object.entries(habitCount).sort((a, b) => b[1] - a[1]);

  // 自动点评
  let comment;
  if (totTasks === 0) comment = '本周还没有记录任务，下周先定个小计划开始吧。';
  else if (rate >= 80) comment = `完成率 ${rate}%，非常出色，保持这个节奏！`;
  else if (rate >= 50) comment = `完成率 ${rate}%，稳步推进，可以再挑战一下自己。`;
  else comment = `完成率 ${rate}%，下周试着减少任务数、聚焦重点，把节奏找回来。`;

  const lines = [
    `# 本周复盘 · ${dates[0]} ~ ${dates[6]}`,
    '',
    '## 一周概览',
    `- 活跃天数：${activeDays}/7`,
    `- 任务完成：${totDone}/${totTasks}（${rate}%）`,
    `- 专注时长：${focusSum} 分钟`,
    `- 平均评分：${avgRating}`,
  ];
  if (topCats.length) lines.push(`- 主要投入：${topCats.map(([n, c]) => `${n}(${c})`).join('、')}`);
  if (topHabits.length) lines.push(`- 习惯打卡：${topHabits.map(([n, c]) => `${n} ${c}/7`).join('、')}`);
  lines.push('', '## 每日明细');
  lines.push(dayLines.length ? dayLines.join('\n') : '_（本周暂无记录）_');
  lines.push('', '## 小结', '> ' + comment, '', '## 下周计划', '- ', '- ', '- ');
  return lines.join('\n');
}
function openReviewModal() {
  const md = generateWeekReview();
  $('#reviewText').value = md;
  $('#reviewModal').hidden = false;
}
function reviewCopy() {
  const ta = $('#reviewText');
  ta.select();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value);
    else document.execCommand('copy');
    toast('已复制到剪贴板');
  } catch (e) { toast('复制失败，可手动选择文本'); }
}
function reviewInsertNote() {
  const md = $('#reviewText').value;
  const cur = getDay(state.currentDate).notes || '';
  const merged = cur.trim() ? cur.trimEnd() + '\n\n' + md : md;
  updateDay(state.currentDate, d => d.notes = merged);
  $('#noteArea').value = merged;
  updateNoteCount(); renderMiniStats(); renderCalendar();
  $('#reviewModal').hidden = true;
  switchView('notes');
  toast('复盘已插入今日笔记');
}
function reviewExport() {
  const dates = weekRange();
  download(`周复盘-${dates[0]}.md`, $('#reviewText').value, 'text/markdown');
  toast('已导出周复盘');
}

/* ============================================================
   今日复盘（轻量，结束一天时填写；写入今日笔记并与周复盘联动）
   ============================================================ */
function openDayReview() {
  $('#drDate').textContent = state.currentDate;
  $('#drBest').value = ''; $('#drImprove').value = ''; $('#drTomorrow').value = '';
  drSetRating(0);
  $('#dayReviewModal').hidden = false;
}
function drSetRating(n) {
  $('#drRating').value = n;
  $$('#drStars .star').forEach(s => s.classList.toggle('on', +s.dataset.star <= n));
}
function saveDayReview() {
  const best = $('#drBest').value.trim();
  const imp = $('#drImprove').value.trim();
  const tom = $('#drTomorrow').value.trim();
  const rating = +$('#drRating').value;
  if (!best && !imp && !tom && !rating) { toast('写点什么再保存吧'); return; }
  const lines = [
    '## 今日复盘（' + state.currentDate + '）',
    rating ? '- ⭐ 评分：' + rating + '/5' : '- ⭐ 评分：未评',
    '- 最满意：' + (best || '—'),
    '- 可改进：' + (imp || '—'),
    '- 明天首要：' + (tom || '—'),
  ];
  const md = lines.join('\n');
  const cur = getDay(state.currentDate).notes || '';
  const merged = cur.trim() ? cur.trimEnd() + '\n\n' + md : md;
  updateDay(state.currentDate, d => d.notes = merged);
  $('#noteArea').value = merged; updateNoteCount();
  renderMiniStats(); renderCalendar();
  $('#dayReviewModal').hidden = true;
  toast('复盘已写入今日笔记');
}

/* ---------- 外观设置（自定义主题色） ---------- */
function openAppearanceModal() {
  $('#appearanceModal').hidden = false;
  renderAccentSwatches();
  $('#accentCustom').value = state.settings.accent || '#3b6cf6';
  $('#accentHex').textContent = state.settings.accent || '#3b6cf6';
}
function renderAccentSwatches() {
  const cur = (state.settings.accent || '#3b6cf6').toLowerCase();
  $('#accentSwatches').innerHTML = ACCENT_PRESETS.map(c =>
    `<button class="accent-swatch${c.toLowerCase() === cur ? ' active' : ''}" data-accent="${c}" style="background:${c}" title="${c}"></button>`
  ).join('');
  $$('#accentSwatches .accent-swatch').forEach(b => {
    b.onclick = () => setAccent(b.dataset.accent);
  });
}
function setAccent(hex) {
  state.settings.accent = hex;
  saveSettings(state.settings);
  applyAccent();
  renderAccentSwatches();
  $('#accentCustom').value = hex;
  $('#accentHex').textContent = hex;
  toast('已更新主题色');
}

/* ---------- 专注沉浸模式 ---------- */
function toggleImmersive() {
  const on = document.body.classList.toggle('immersive');
  $('#immersiveBtn').textContent = on ? '退出沉浸' : '沉浸';
  if (on) $('#immersiveExit').hidden = false; else $('#immersiveExit').hidden = true;
}

/* ---------- 启动 ---------- */
init();
