(function () {
  'use strict';

  // =========================================
  // UTILITY
  // =========================================
  const LS = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
      catch { return def; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // =========================================
  // APP
  // =========================================
  const App = {
    currentTab: 'todo',

    init() {
      this.switchTab('todo');

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
      });

      Todo.init();
      Pomodoro.init();
      Notes.init();
      Habits.init();
    },

    switchTab(tab) {
      this.currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
    },

    log(level, msg) {
      const t = new Date().toISOString();
      if (level === 'error') console.error(`[${t}] ERROR: ${msg}`);
      else if (level === 'warn') console.warn(`[${t}] WARN: ${msg}`);
      else console.log(`[${t}] INFO: ${msg}`);
    }
  };

  // =========================================
  // TO-DO
  // =========================================
  const Todo = {
    tasks: [],

    init() {
      this.tasks = LS.get('todo_tasks', []);
      this.render();

      document.getElementById('todoAddBtn').addEventListener('click', () => this.add());
      document.getElementById('todoInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.add(); });
    },

    save() { LS.set('todo_tasks', this.tasks); },

    add() {
      const input = document.getElementById('todoInput');
      const title = input.value.trim();
      if (!title) return;

      const priority = document.getElementById('todoPriority').value;
      this.tasks.unshift({ id: uid(), title, done: false, priority, createdAt: Date.now() });
      this.save();
      this.render();
      input.value = '';
      input.focus();
    },

    toggle(id) {
      const task = this.tasks.find(t => t.id === id);
      if (task) { task.done = !task.done; this.save(); this.render(); }
    },

    delete(id) {
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.save();
      this.render();
    },

    render() {
      const container = document.getElementById('todoList');
      if (!this.tasks.length) {
        container.innerHTML = '<div class="todo-empty">لا توجد مهام حالياً. أضف مهمة جديدة!</div>';
        return;
      }
      container.innerHTML = this.tasks.map(t => `
        <div class="todo-item${t.done ? ' done' : ''}">
          <input type="checkbox" class="todo-check" ${t.done ? 'checked' : ''} data-id="${t.id}" />
          <span class="todo-text">${this.esc(t.title)}</span>
          <span class="todo-priority ${t.priority}">${this.priLabel(t.priority)}</span>
          <button class="todo-delete" data-id="${t.id}" title="حذف">&times;</button>
        </div>
      `).join('');

      container.querySelectorAll('.todo-check').forEach(cb => {
        cb.addEventListener('change', () => this.toggle(cb.dataset.id));
      });
      container.querySelectorAll('.todo-delete').forEach(btn => {
        btn.addEventListener('click', () => this.delete(btn.dataset.id));
      });
    },

    priLabel(p) { return { high: 'عالي', medium: 'متوسط', low: 'منخفض' }[p] || 'متوسط'; },
    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  };

  // =========================================
  // POMODORO
  // =========================================
  const Pomodoro = {
    workTime: 25,
    breakTime: 5,
    remaining: 25 * 60,
    isRunning: false,
    isWork: true,
    interval: null,

    init() {
      const saved = LS.get('pomodoro_settings', { workMin: 25, breakMin: 5 });
      this.workTime = saved.workMin;
      this.breakTime = saved.breakMin;
      this.remaining = this.workTime * 60;

      const state = LS.get('pomodoro_state', null);
      if (state && state.lastTick) {
        const elapsed = Math.floor((Date.now() - state.lastTick) / 1000);
        if (state.isRunning) {
          state.remaining = Math.max(0, state.remaining - elapsed);
        }
        this.remaining = state.remaining;
        this.isRunning = state.isRunning;
        this.isWork = state.isWork;
      }

      document.getElementById('pomodoroWork').value = this.workTime;
      document.getElementById('pomodoroBreak').value = this.breakTime;

      document.getElementById('pomodoroStartBtn').addEventListener('click', () => this.start());
      document.getElementById('pomodoroPauseBtn').addEventListener('click', () => this.pause());
      document.getElementById('pomodoroResetBtn').addEventListener('click', () => this.reset());
      document.getElementById('pomodoroApplyBtn').addEventListener('click', () => this.applySettings());

      if (this.isRunning) this.resumeTick();
      this.render();
    },

    saveSettings() { LS.set('pomodoro_settings', { workMin: this.workTime, breakMin: this.breakTime }); },

    saveState() {
      LS.set('pomodoro_state', { remaining: this.remaining, isRunning: this.isRunning, isWork: this.isWork, lastTick: this.isRunning ? Date.now() : 0 });
    },

    start() {
      if (this.isRunning) return;
      if (this.remaining <= 0) this.reset();
      this.isRunning = true;
      this.saveState();
      this.resumeTick();
      this.render();
    },

    pause() {
      this.isRunning = false;
      if (this.interval) { clearInterval(this.interval); this.interval = null; }
      this.saveState();
      this.render();
    },

    reset() {
      this.pause();
      this.isWork = true;
      this.remaining = this.workTime * 60;
      this.saveState();
      this.render();
    },

    resumeTick() {
      if (this.interval) clearInterval(this.interval);
      this.interval = setInterval(() => {
        if (this.remaining > 0) {
          this.remaining--;
          this.saveState();
          this.render();
        } else {
          this.pause();
          this.isWork = !this.isWork;
          this.remaining = (this.isWork ? this.workTime : this.breakTime) * 60;
          this.saveState();
          this.render();
        }
      }, 1000);
    },

    applySettings() {
      const w = parseInt(document.getElementById('pomodoroWork').value, 10);
      const b = parseInt(document.getElementById('pomodoroBreak').value, 10);
      if (w < 1 || w > 90 || b < 1 || b > 30) return;
      this.workTime = w;
      this.breakTime = b;
      this.saveSettings();
      this.reset();
    },

    render() {
      const m = String(Math.floor(this.remaining / 60)).padStart(2, '0');
      const s = String(this.remaining % 60).padStart(2, '0');
      document.getElementById('pomodoroDisplay').textContent = m + ':' + s;
      document.getElementById('pomodoroLabel').textContent = this.isWork ? 'وقت العمل' : 'وقت الراحة';
      document.getElementById('pomodoroStartBtn').textContent = this.isRunning ? 'جارٍ...' : '\u25B6 بدء';
    }
  };

  // =========================================
  // NOTES
  // =========================================
  const Notes = {
    items: [],

    init() {
      this.items = LS.get('notes', []);
      this.render();

      document.getElementById('noteAddBtn').addEventListener('click', () => this.add());
      document.getElementById('noteTitleInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.add(); });
    },

    save() { LS.set('notes', this.items); },

    add() {
      const title = document.getElementById('noteTitleInput').value.trim();
      const content = document.getElementById('noteContentInput').value.trim();
      if (!title) return;

      this.items.unshift({ id: uid(), title, content, updatedAt: Date.now() });
      this.save();
      this.render();
      document.getElementById('noteTitleInput').value = '';
      document.getElementById('noteContentInput').value = '';
    },

    edit(id) {
      const item = this.items.find(n => n.id === id);
      if (!item) return;

      const newTitle = prompt('عنوان جديد:', item.title);
      if (newTitle === null) return;
      const newContent = prompt('محتوى جديد:', item.content);
      if (newContent === null) return;

      item.title = newTitle.trim();
      item.content = newContent.trim();
      item.updatedAt = Date.now();
      this.save();
      this.render();
    },

    delete(id) {
      if (!confirm('حذف الملاحظة؟')) return;
      this.items = this.items.filter(n => n.id !== id);
      this.save();
      this.render();
    },

    render() {
      const container = document.getElementById('notesList');
      if (!this.items.length) {
        container.innerHTML = '<div class="notes-empty">لا توجد ملاحظات. أضف ملاحظة جديدة!</div>';
        return;
      }
      container.innerHTML = this.items.map(n => `
        <div class="note-item">
          <div class="note-header">
            <span class="note-title">${this.esc(n.title)}</span>
            <div class="note-actions">
              <button class="btn-small note-edit-btn" data-id="${n.id}">تعديل</button>
              <button class="btn-danger note-del-btn" data-id="${n.id}">حذف</button>
            </div>
          </div>
          <div class="note-content">${this.esc(n.content || '(بدون محتوى)')}</div>
          <div class="note-date">${new Date(n.updatedAt).toLocaleString('ar-SA')}</div>
        </div>
      `).join('');

      container.querySelectorAll('.note-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => this.edit(btn.dataset.id));
      });
      container.querySelectorAll('.note-del-btn').forEach(btn => {
        btn.addEventListener('click', () => this.delete(btn.dataset.id));
      });
    },

    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  };

  // =========================================
  // HABITS
  // =========================================
  const Habits = {
    habits: [],
    logs: {},

    init() {
      this.habits = LS.get('habits', []);
      this.logs = LS.get('habit_logs', {});
      this.renderStats();
      this.render();

      document.getElementById('habitAddBtn').addEventListener('click', () => this.add());
      document.getElementById('habitInput').addEventListener('keydown', e => { if (e.key === 'Enter') this.add(); });
    },

    save() { LS.set('habits', this.habits); LS.set('habit_logs', this.logs); },

    add() {
      const input = document.getElementById('habitInput');
      const name = input.value.trim();
      if (!name) return;

      this.habits.push({ id: uid(), name, createdAt: Date.now() });
      this.save();
      this.render();
      this.renderStats();
      input.value = '';
    },

    toggle(id) {
      const d = today();
      if (!this.logs[d]) this.logs[d] = [];
      const idx = this.logs[d].indexOf(id);
      if (idx > -1) {
        this.logs[d].splice(idx, 1);
        if (this.logs[d].length === 0) delete this.logs[d];
      } else {
        this.logs[d].push(id);
      }
      this.save();
      this.render();
      this.renderStats();
    },

    delete(id) {
      if (!confirm('حذف هذه العادة؟')) return;
      this.habits = this.habits.filter(h => h.id !== id);
      Object.keys(this.logs).forEach(d => {
        this.logs[d] = this.logs[d].filter(hid => hid !== id);
        if (this.logs[d].length === 0) delete this.logs[d];
      });
      this.save();
      this.render();
      this.renderStats();
    },

    calcStreak(id) {
      let streak = 0;
      const d = new Date();
      while (true) {
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (this.logs[key] && this.logs[key].indexOf(id) > -1) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    },

    renderStats() {
      const todayId = today();
      const doneToday = this.logs[todayId] ? this.logs[todayId].length : 0;
      const total = this.habits.length;
      document.getElementById('habitStats').textContent = total
        ? '\u2705 أنجزت ' + doneToday + ' من ' + total + ' عادة اليوم'
        : '\uD83D\uDCC5 أضف عاداتك اليومية وابدأ التتبع';
    },

    render() {
      const container = document.getElementById('habitsList');
      if (!this.habits.length) {
        container.innerHTML = '<div class="habits-empty">لا توجد عادات. أضف عادة جديدة!</div>';
        return;
      }

      const d = today();
      const todayLogs = this.logs[d] || [];

      container.innerHTML = this.habits.map(h => {
        const checked = todayLogs.indexOf(h.id) > -1;
        const streak = this.calcStreak(h.id);
        return `
          <div class="habit-item">
            <input type="checkbox" class="habit-check" ${checked ? 'checked' : ''} data-id="${h.id}" />
            <span class="habit-name">${this.esc(h.name)}</span>
            <span class="habit-streak">🔥 ${streak} يوم</span>
            <button class="habit-delete" data-id="${h.id}" title="حذف">&times;</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.habit-check').forEach(cb => {
        cb.addEventListener('change', () => this.toggle(cb.dataset.id));
      });
      container.querySelectorAll('.habit-delete').forEach(btn => {
        btn.addEventListener('click', () => this.delete(btn.dataset.id));
      });
    },

    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  };

  // =========================================
  // INIT
  // =========================================
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
