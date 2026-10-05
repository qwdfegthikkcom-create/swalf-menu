# Productivity Hub - PROJECT MAP

## [TECH_STACK]
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Storage:** Local Storage API (no backend)
- **Hosting:** GitHub Pages (static site)
- **Monetization:** Google AdSense
- **Date:** 2026-06-12

## [SYSTEM_FLOW]
1. User opens index.html → App initializes
2. Tab navigation (To-Do / Pomodoro / Notes / Habits)
3. Each tab operates independently via Local Storage
4. No login required, no network requests
5. AdSense ads load in designated slots

### User Journey (RTL / Arabic)
```
[Header: Productivity Hub]
  ├── [Tab: المهام]    → To-Do List
  ├── [Tab: المؤقت]     → Pomodoro Timer
  ├── [Tab: الملاحظات]  → Notes App
  └── [Tab: العادات]    → Habit Tracker
[Ad Banner]
[Active Tab Content]
[Footer: © 2026]
```

## [ARCHITECTURE]

### File Structure
```
productivity-hub/
├── index.html        # Main HTML (RTL, Arabic)
├── style.css         # All styles (responsive)
├── app.js            # All logic (modular)
├── ads.txt           # AdSense verification
└── PROJECT_MAP.md    # This file
```

### JS Module Pattern
```
App { init(), switchTab() }
├── Todo { tasks[], load(), save(), add(), toggle(), delete(), render() }
├── Pomodoro { workTime, breakTime, state, start(), pause(), reset(), render() }
├── Notes { items[], load(), save(), add(), edit(), delete(), render() }
└── Habits { habits[], logs{}, load(), save(), add(), toggle(), delete(), render() }
```

### Data Schema (LocalStorage)
| Key | Type | Description |
|-----|------|-------------|
| `todo_tasks` | JSON Array | `{id, title, done, priority, createdAt}` |
| `pomodoro_settings` | JSON Object | `{workMin, breakMin}` |
| `pomodoro_state` | JSON Object | `{remaining, isRunning, isWork, lastTick}` |
| `notes` | JSON Array | `{id, title, content, updatedAt}` |
| `habits` | JSON Array | `{id, name, createdAt}` |
| `habit_logs` | JSON Object | `{"YYYY-MM-DD": [habitId, ...]}` |

## [ORPHANS & PENDING]
- [x] AdSense code placeholder (replace `pub-xxxxxxxxxxxxxx` with your ID)
- [x] ads.txt placeholder (replace `pub-xxxxxxxxxxxxxx` with your ID)
- [ ] GitHub Pages deployment (user: `git init && git add . && git commit -m "v1"` then push to repo)
- [ ] Custom domain (optional)
- [ ] PWA manifest for offline support (optional)

### Status: MVP Complete & Fully Functional
| Feature | Status |
|---------|--------|
| To-Do List (add, toggle, delete, priority) | ✅ Done |
| Pomodoro Timer (start, pause, reset, settings) | ✅ Done |
| Notes App (add, edit, delete) | ✅ Done |
| Habit Tracker (add, daily toggle, streak) | ✅ Done |
| RTL Arabic UI | ✅ Done |
| Responsive Design | ✅ Done |
| AdSense integration | ✅ Placeholder ready |
| Local Storage persistence | ✅ Done |
