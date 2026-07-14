/* 逻辑冒烟测试：用 jsdom 真实加载并执行 app.js，验证核心交互路径不抛错且 DOM 正确更新。
   不依赖像素渲染，只验证运行时正确性与数据/视图行为。 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:\\Users\\A26075029\\.workbuddy\\binaries\\node\\workspace\\node_modules\\jsdom');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<script src="app.js"></script>', '');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
const doc = window.document;

// ---- 浏览器 API 桩 ----
window.print = () => {};
window.confirm = () => true;
window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:test');
window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});

const errors = [];
window.addEventListener('error', e => errors.push(String(e.error || e.message)));
dom.virtualConsole && dom.virtualConsole.on('jsdomError', e => errors.push('jsdomError: ' + e.message));

// 执行应用脚本（间接 eval → 全局作用域）
window.eval(appSrc);

const results = [];
function assert(cond, msg) { results.push((cond ? 'PASS ' : 'FAIL ') + msg); }
function nextDay(str) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + 1);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

setTimeout(() => {
  try {
    const $ = s => doc.querySelector(s);
    const $$ = s => [...doc.querySelectorAll(s)];

    // 1. 初始渲染
    assert($('#planDateTitle') && $('#planDateTitle').textContent.includes('计划'), '初始计划视图已渲染');
    assert($('#calGrid').children.length > 0, '日历已渲染');

    // 2. 载入示例数据
    window.loadSample();
    assert($$('#taskList .task-item').length === 4, '示例数据生成 4 个任务（实际 ' + $$('#taskList .task-item').length + '）');

    // 3. 勾选任务完成 + 进度文本
    const firstId = $('.task-item').dataset.id;
    window.toggleTask(firstId);
    assert($('.task-item.done') !== null, '任务可标记为已完成');
    assert($('#planProgressText').textContent === '1/4', '进度文本更新为 1/4（实际 ' + $('#planProgressText').textContent + '）');

    // 4. 内联编辑（真实点击编辑按钮进入编辑态）
    $('.task-item [data-act="edit"]').click();
    const editLi = $('.task-item.editing');
    assert(editLi !== null, '点击编辑按钮进入编辑态');
    if (editLi) {
      editLi.querySelector('.edit-title').value = '改过的标题';
      editLi.querySelector('[data-act="save"]').click();
      assert($('#taskList').textContent.includes('改过的标题'), '内联编辑保存生效');
    }

    // 5. 添加任务（表单提交）
    $('#taskTitle').value = '冒烟测试新增任务';
    $('#taskForm').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    assert($('#taskList').textContent.includes('冒烟测试新增任务'), '表单添加任务生效');

    // 6. 筛选：待完成（此时含示例2个未完成+新增1个=3？ 见下方校验）
    $$('#taskFilter .chip').find(c => c.dataset.filter === 'pending').click();
    const pendingCount = $$('#taskList .task-item').length;
    // 示例：t1(改后,undone) t2(undone) t3(undone) t4(done)；新增(undone) => 共 4 个未完成
    assert(pendingCount === 4, '筛选待完成剩 4 项（实际 ' + pendingCount + '）');
    $$('#taskFilter .chip').find(c => c.dataset.filter === 'all').click();

    // 7. 统计视图
    window.switchView('stats');
    assert($('#statCards').innerHTML.includes('%'), '统计卡片渲染');
    assert($('#weekChart').children.length === 7, '近 7 天柱状图 7 列');
    assert($('#heatmap').children.length > 100, '活跃度热力图渲染单元格（实际 ' + $('#heatmap').children.length + '）');

    // 8. 搜索（跨日期）
    window.switchView('search');
    $('#searchInput').value = '算法';
    $('#searchInput').dispatchEvent(new window.Event('input', { bubbles: true }));
    assert($('#searchResults').textContent.includes('算法'), '搜索命中关键词');

    // 9. 导出 PDF（写入打印区，不真正打印）
    window.doExport('pdf');
    assert($('#printArea').innerHTML.includes('任务清单'), 'PDF 导出内容已写入打印区');
    $('#printArea').hidden = true;

    // 10. 复制到明天 + 去重
    const cur = $('#datePicker').value;
    const tomorrow = nextDay(cur);
    const before = JSON.parse(window.localStorage.getItem('learnlog_data_v1'));
    const dupBefore = (before[tomorrow] && before[tomorrow].tasks.length) || 0;
    window.copyPlanToTomorrow();
    const after = JSON.parse(window.localStorage.getItem('learnlog_data_v1'));
    const dupAfter = (after[tomorrow] && after[tomorrow].tasks.length) || 0;
    assert(dupAfter >= dupBefore, '复制到明天生效（' + dupBefore + ' -> ' + dupAfter + '）');
    window.copyPlanToTomorrow(); // 二次复制应去重（不影响明天本身数量）
    const after2 = JSON.parse(window.localStorage.getItem('learnlog_data_v1'));
    const dupAfter2 = (after2[tomorrow] && after2[tomorrow].tasks.length) || 0;
    assert(dupAfter2 === dupAfter, '二次复制已去重（仍是 ' + dupAfter2 + '）');

    // 11. 专注浮标：开始计时后应显示，暂停后隐藏
    window.switchView('focus');
    $('#timerToggle').click();
    assert($('#focusBadge').hidden === false, '专注计时进行中顶栏浮标显示');
    $('#timerToggle').click();
    assert($('#focusBadge').hidden === true, '暂停后浮标隐藏');

    // 12. 键盘快捷键（先让焦点离开输入框，避免被 typing 守卫拦截）
    $('#taskTitle').blur();
    doc.body.focus();
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
    assert($('#view-week').classList.contains('active'), '快捷键 2 切到周视图（导航顺序）');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));
    assert($('#view-plan').classList.contains('active'), '快捷键 1 切换回计划视图');

    // 13. Esc 关闭弹窗/菜单（打开分类弹窗后按 Esc）
    $('#gearBtn').click();
    $('#settingsMenu').querySelector('[data-act="cats"]').click();
    assert($('#catModal').hidden === false, '分类弹窗可打开');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert($('#catModal').hidden === true, 'Esc 关闭弹窗');

    // 14. 主题切换不报错
    const t0 = doc.documentElement.getAttribute('data-theme');
    $('#themeBtn').click();
    assert(doc.documentElement.getAttribute('data-theme') !== t0, '主题可切换');

    // 15. Markdown 渲染安全与正确
    const xss = window.renderMarkdown('<script>alert(1)</script>');
    assert(!xss.includes('<script>') && xss.includes('&lt;script&gt;'), 'Markdown 转义防止 XSS');
    assert(window.renderMarkdown('# 标题').includes('<h1>标题</h1>'), 'Markdown 标题渲染');
    assert(window.renderMarkdown('[x](javascript:alert(1))').includes('href="#"') && !window.renderMarkdown('[x](javascript:alert(1))').includes('javascript:'), 'Markdown 危险链接被拦截');
    assert(window.renderMarkdown('- a\n- b').includes('<ul>'), 'Markdown 列表渲染');

    // 16. 每日目标
    window.switchView('plan');
    $('#goalInput').value = '3';
    $('#goalInput').dispatchEvent(new window.Event('change', { bubbles: true }));
    assert($('#planProgressText').textContent.includes('目标'), '目标显示于计划进度（实际 ' + $('#planProgressText').textContent + '）');
    assert($('#miniStats').innerHTML.includes('每日目标'), '目标显示于迷你统计');

    // 17. 拖拽排序改变顺序并持久化
    const ids = $$('#taskList .task-item').map(li => li.dataset.id);
    if (ids.length >= 2) {
      const dsKey = $('#datePicker').value;
      const before = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[dsKey].tasks.map(t => t.id).join(',');
      window.reorderByDrop(ids[0], ids[ids.length - 1]);
      const after = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[dsKey].tasks.map(t => t.id).join(',');
      assert(before !== after, '拖拽排序改变任务顺序');
      assert(JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[dsKey].tasks.map(t => t.id)[0] !== ids[0], '拖拽后原首项不再在最前');
    } else assert(true, '任务不足 2 个，跳过排序断言');

    // 18. 帮助浮层：? 打开 / Esc 关闭
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?', bubbles: true }));
    assert($('#helpModal').hidden === false, '? 键打开帮助浮层');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert($('#helpModal').hidden === true, 'Esc 关闭帮助浮层');

    // 19. 周视图
    assert($$('.nav-item').some(b => b.dataset.view === 'week'), '侧边栏含周视图入口');
    window.switchView('week');
    assert($('#view-week').classList.contains('active'), '周视图可激活');
    const days = $$('#weekGrid .week-day');
    assert(days.length === 7, '周视图渲染 7 天（实际 ' + days.length + '）');
    assert(days.every(d => d.dataset.date), '周视图每天含 data-date');
    const curDate = $('#datePicker').value;
    const targetDay = days.find(d => d.dataset.date !== curDate) || days[0];
    targetDay.click();
    assert($('#view-plan').classList.contains('active'), '点击周视图某天跳转到计划视图');
    assert($('#datePicker').value === targetDay.dataset.date, '点击周视图某天更新当前日期');

    // 20. 计划模板：保存 / 渲染 / 去重载入 / 添加载入 / 删除
    window.switchView('plan');
    $('#tplName').value = '晨间流程';
    $('#tplAddBtn').click();
    const tpls = JSON.parse(window.localStorage.getItem('learnlog_templates_v1') || '[]');
    assert(tpls.length === 1 && tpls[0].name === '晨间流程', '保存模板生效');
    assert($$('#tplList li[data-id]').length === 1, '模板列表渲染 1 项');
    const beforeLoad = $$('#taskList .task-item').length;
    $('#tplList li[data-id] [data-act="load"]').click(); // 同一天载入应去重
    assert($$('#taskList .task-item').length === beforeLoad, '载入模板按标题去重（数量不变 ' + beforeLoad + '）');
    // 切到空日期再载入应新增
    $('#datePicker').value = '2030-01-01';
    $('#datePicker').dispatchEvent(new window.Event('change', { bubbles: true }));
    assert($$('#taskList .task-item').length === 0, '切到空日期任务为 0');
    window.openTplModal();
    $('#tplList li[data-id] [data-act="load"]').click();
    assert($$('#taskList .task-item').length === 4, '载入模板向空日期添加 4 项（实际 ' + $$('#taskList .task-item').length + '）');
    window.deleteTemplate(tpls[0].id);
    const tpls2 = JSON.parse(window.localStorage.getItem('learnlog_templates_v1') || '[]');
    assert(tpls2.length === 0, '删除模板生效');

    // 21. 专注趋势图
    window.switchView('stats');
    assert($('#focusChart').children.length === 7, '专注趋势图 7 列（实际 ' + $('#focusChart').children.length + '）');

    // 22. 周视图快捷键 5 / w
    window.switchView('plan');
    $('#taskTitle').blur(); doc.body.focus();
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    assert($('#view-week').classList.contains('active'), '快捷键 w 打开周视图');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '5', bubbles: true }));
    assert($('#view-stats').classList.contains('active'), '快捷键 5 切到统计视图');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '6', bubbles: true }));
    assert($('#view-focus').classList.contains('active'), '快捷键 6 切到专注视图');

    // 23. 每日评分
    function fmtD(d){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const da=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+da;}
    const realToday = fmtD(new Date());
    $('#datePicker').value = realToday;
    $('#datePicker').dispatchEvent(new window.Event('change', { bubbles: true }));
    window.switchView('plan');
    const star4 = $$('#dayRating .star').find(s => s.dataset.star === '4');
    assert(star4 !== undefined, '评分控件渲染 5 颗星');
    star4.click();
    let dayData = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[realToday];
    assert(dayData && dayData.rating === 4, '点击 4 星设置评分（实际 ' + (dayData && dayData.rating) + '）');
    assert($$('#dayRating .star.on').length === 4, '评分高亮 4 颗星');
    $$('#dayRating .star').find(s => s.dataset.star === '4').click(); // 再点取消
    dayData = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[realToday];
    assert(dayData.rating === 0, '再次点击同一星取消评分');

    // 24. 月视图
    assert($$('.nav-item').some(b => b.dataset.view === 'month'), '侧边栏含月视图入口');
    window.switchView('month');
    assert($('#view-month').classList.contains('active'), '月视图可激活');
    const mcells = $$('#monthGrid .mcell[data-date]');
    const dim = new Date(); const dimDays = new Date(dim.getFullYear(), dim.getMonth() + 1, 0).getDate();
    assert(mcells.length === dimDays, '月视图渲染当月 ' + dimDays + ' 天（实际 ' + mcells.length + '）');
    assert(mcells.every(c => c.dataset.date), '月视图每天含 data-date');
    const mtarget = mcells.find(c => c.dataset.date !== realToday) || mcells[0];
    mtarget.click();
    assert($('#datePicker').value === mtarget.dataset.date, '点击月视图某天更新当前日期');
    assert($('#view-plan').classList.contains('active'), '点击月视图某天跳转到计划视图');

    // 25. 任务到点提醒
    $('#datePicker').value = realToday;
    $('#datePicker').dispatchEvent(new window.Event('change', { bubbles: true }));
    window.switchView('plan');
    $('#taskTime').value = '00:00';
    $('#taskTitle').value = '提醒测试任务';
    $('#taskForm').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    window.checkDueTasks();
    assert($('#toast').textContent.includes('该做'), '到点任务触发提醒 toast（实际 ' + $('#toast').textContent + '）');

    // 26. 周/月导出（不抛错，提示正确）
    window.doExport('week');
    assert($('#toast').textContent.includes('已导出本周'), '导出本周生效');
    window.doExport('month');
    assert($('#toast').textContent.includes('已导出本月'), '导出本月生效');

    // 27. 专注提示音（AudioContext 缺失环境应静默，不抛错）
    assert($('#soundOn') !== null, '提示音开关存在');
    window.playChime();
    $('#soundOn').checked = false;
    $('#soundOn').dispatchEvent(new window.Event('change', { bubbles: true }));
    window.playChime();

    // 28. 月视图快捷键 3 / m
    $('#taskTitle').blur(); doc.body.focus();
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
    assert($('#view-month').classList.contains('active'), '快捷键 3 打开月视图');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    assert($('#view-month').classList.contains('active'), '快捷键 m 打开月视图');
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));

    // 29. 帮助弹窗关闭按钮（真实 bug 修复验证）
    $('#gearBtn').click();
    $('#settingsMenu').querySelector('[data-act="help"]').click();
    assert($('#helpModal').hidden === false, '帮助弹窗可打开');
    $('#helpClose').click();
    assert($('#helpModal').hidden === true, '点击 X 关闭帮助弹窗');

    // 30. 成就徽章：渲染且完成任务后获得 first_task
    window.switchView('plan');
    window.localStorage.setItem('learnlog_badges_v1', JSON.stringify({ earned: [] }));
    window.checkBadges();
    assert($('#badges').innerHTML.includes('初出茅庐'), '徽章区域渲染「初出茅庐」');
    const badges = JSON.parse(window.localStorage.getItem('learnlog_badges_v1')) || { earned: [] };
    assert(badges.earned.includes('first_task'), '完成首个任务后获得 first_task 徽章');

    // 31. 习惯打卡：侧边栏渲染、可切换完成
    assert($$('#habitsList li').length > 0, '侧边栏习惯列表渲染');
    const habitLi = $('#habitsList li');
    const firstHabitId = habitLi.dataset.id;
    habitLi.click();
    const habitDate = $('#datePicker').value;
    const habitDayData = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[habitDate] || {};
    const dayHabits = habitDayData.habits || {};
    assert(dayHabits[firstHabitId] === true, '点击习惯后完成状态已持久化');
    assert($('#habitsList li .hb-check').classList.contains('done'), '习惯完成样式生效');

    // 32. 习惯管理弹窗：打开 / 添加 / 删除
    const habitsBefore = window.loadHabits().length;
    window.openHabitModal();
    assert($('#habitModal').hidden === false, '习惯管理弹窗可打开');
    $('#habitNewName').value = '测试习惯';
    $('#habitAddBtn').click();
    const habitsAfter = window.loadHabits().length;
    assert(habitsAfter === habitsBefore + 1, '添加习惯后数量 +1');
    $('#habitModal').hidden = true;

    // 33. 智能快速输入解析
    const p1 = window.parseQuickInput('09:30 背单词 #学习 !高');
    assert(p1.time === '09:30' && p1.category === '学习' && p1.priority === '高' && p1.title === '背单词', '快速输入解析时间/分类/优先级（title=' + p1.title + '）');
    const p2 = window.parseQuickInput('9:5 写代码'); // 非法分钟不解析为时间
    assert(p2.time === null && p2.title.includes('写代码'), '非法时间不误解析');
    const p3 = window.parseQuickInput('#学习 !中 复习');
    assert(p3.category === '学习' && p3.priority === '中' && p3.title === '复习', '前置标记也可解析');
    // 真实经由表单添加，验证落库
    window.switchView('plan');
    $('#datePicker').value = '2031-02-02';
    $('#datePicker').dispatchEvent(new window.Event('change', { bubbles: true }));
    $('#taskTitle').value = '08:00 晨跑 #健身 !高';
    $('#taskForm').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    const qd = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))['2031-02-02'].tasks.slice(-1)[0];
    assert(qd.time === '08:00' && qd.title === '晨跑' && qd.category === '健身' && qd.priority === '高', '智能输入经表单落库正确');

    // 34. 学习目标：添加 / 渲染 / +1 / 达成徽章 / 删除
    window.localStorage.removeItem('learnlog_goals_v1');
    window.openGoalModal();
    assert($('#goalModal').hidden === false, '目标管理弹窗可打开');
    $('#goalNewName').value = '读完5本书';
    $('#goalNewTarget').value = '2';
    $('#goalNewUnit').value = '本';
    $('#goalAddBtn').click();
    let goals = window.loadGoals();
    assert(goals.length === 1 && goals[0].target === 2, '添加目标生效');
    $('#goalModal').hidden = true;
    window.renderGoals();
    assert($$('#goalsList li[data-id]').length === 1, '侧边栏目标卡片渲染');
    const gid = goals[0].id;
    window.localStorage.setItem('learnlog_badges_v1', JSON.stringify({ earned: [] }));
    window.incGoal(gid, 1);
    window.incGoal(gid, 1); // 达到 target=2
    goals = window.loadGoals();
    assert(goals[0].current === 2, '目标 +1 累加到达成值');
    const gbadges = JSON.parse(window.localStorage.getItem('learnlog_badges_v1'));
    assert(gbadges.earned.includes('goal_done'), '目标达成获得 goal_done 徽章');
    assert($('#goalsList li').classList.contains('reached'), '达成目标显示 reached 样式');
    window.incGoal(gid, -1); // 减一不为负
    assert(window.loadGoals()[0].current === 1, '目标 -1 生效');
    window.deleteGoal(gid);
    assert(window.loadGoals().length === 0, '删除目标生效');

    // 35. 周复盘：生成内容 / 弹窗 / 插入笔记
    const realToday2 = fmtD(new Date());
    $('#datePicker').value = realToday2;
    $('#datePicker').dispatchEvent(new window.Event('change', { bubbles: true }));
    const md = window.generateWeekReview();
    assert(md.includes('# 本周复盘') && md.includes('任务完成') && md.includes('下周计划'), '周复盘生成含关键段落');
    window.openReviewModal();
    assert($('#reviewModal').hidden === false && $('#reviewText').value.includes('本周复盘'), '复盘弹窗打开并填充文本');
    window.switchView('stats');
    $('#reviewBtn').click();
    assert($('#reviewModal').hidden === false, '统计页按钮可打开复盘');
    window.reviewInsertNote();
    const noteNow = JSON.parse(window.localStorage.getItem('learnlog_data_v1'))[realToday2].notes || '';
    assert(noteNow.includes('本周复盘'), '复盘可插入今日笔记');
    assert($('#reviewModal').hidden === true, '插入后复盘弹窗关闭');

    // 36. 新弹窗 Esc 关闭
    window.openGoalModal();
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert($('#goalModal').hidden === true, 'Esc 关闭目标弹窗');
    window.openReviewModal();
    doc.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert($('#reviewModal').hidden === true, 'Esc 关闭复盘弹窗');

    console.log(results.join('\n'));
    console.log(errors.length ? ('\nRUNTIME_ERRORS:\n' + errors.join('\n')) : '\nNO_RUNTIME_ERRORS');
    const failed = results.filter(r => r.startsWith('FAIL')).length;
    console.log('\nSUMMARY: ' + (results.length - failed) + '/' + results.length + ' passed' + (errors.length ? ', with ' + errors.length + ' runtime error(s)' : ''));
    process.exit(failed || errors.length ? 1 : 0);
  } catch (e) {
    console.log(results.join('\n'));
    console.log('TEST_THREW: ' + e.message + '\n' + e.stack);
    if (errors.length) console.log('RUNTIME_ERRORS: ' + errors.join('\n'));
    process.exit(1);
  }
}, 500);
