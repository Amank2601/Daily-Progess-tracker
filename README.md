# Daily Progress Tracker

Track your daily study/work schedule by simply uploading your timetable file.  
The app extracts **time + task** entries, lets you tick completed items, and stores everything in your browser so progress is never lost between sessions.

---

## ✨ Features

- **Multi-format upload:** Excel (.xlsx/.xls), PDF, Word (.docx), or images (.jpg/.png).  
- **Automatic extraction:** Reads each file and pulls only lines that look like “8:30 – 10:30 (Task)”.  
- **Smart filtering:** Ignores headers like “Time Monday Tuesday …”.  
- **Interactive checklist:** Tick/untick tasks; progress bar updates live.  
- **Date + Day selector:** Work on any calendar date and see the weekday auto-fill.  
- **Local persistence:** Press **Save Progress** (or enable auto-save) to write to `localStorage`.  
- **Reports:** One-click weekly & monthly summaries with completion stats.  
- **Export / backup:** Download all saved data as `progress_data.json`.  
- **Responsive UI:** Tailwind CSS, works on mobile and desktop.  
- **100 % client-side:** No server, runs offline once loaded.

---

## ⚡ Quick Start

1. **Clone / download** this repo.  
2. Open `index.html` directly in your browser (or serve via `npx serve` for nicer URLs).  
3. Upload a timetable file and start tracking!

> Tip: Excel sheets with two columns (`Time` | `Task`) yield the cleanest extraction.

---


All external libraries are pulled from CDNs:

- Tailwind (UI)  
- SheetJS/xlsx (Excel)  
- pdf.js (PDF)  
- mammoth.js (Word)  
- Tesseract.js (OCR for images)

---

## 🖇️ Saving & Persistence

- Clicking **Save Progress** writes a JSON object to `localStorage` under `progress_YYYY-MM-DD`.  
- Each date has its own key, so data for different days never overwrites.  
- Data remains until you clear browser storage or use Incognito.  
- To auto-save on every checkbox change, uncomment the `this.saveProgress();` line in `renderTasks()`.

---

## 🗂️ Exporting / Restoring

1. Press **Export Data** — a file named `progress_data.json` downloads.  
2. To restore, open DevTools → Console and run:


---

## 🔧 Customisation

- **Task parsing:** Edit regexes in `parseTaskEntry()` if your timetable format differs.  
- **Auto-save:** Enable as described above.  
- **Theme:** Tailwind utility classes let you restyle quickly.  

---
