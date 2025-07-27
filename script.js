class ProgressTracker {
    constructor() {
        this.tasks = [];
        this.currentDate = new Date().toISOString().split('T')[0];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setCurrentDate();
        this.loadTasksForDate();
        this.updateDayDisplay();
    }

    setupEventListeners() {
        // File upload
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Date selector
        document.getElementById('dateSelector').addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.updateDayDisplay();
            this.loadTasksForDate();
        });

        // Day selector
        document.getElementById('daySelector').addEventListener('change', (e) => {
            // Optional: You can add logic here if needed
        });

        // Buttons
        document.getElementById('saveProgress').addEventListener('click', () => this.saveProgress());
        document.getElementById('clearTasks').addEventListener('click', () => this.clearTasks());
        document.getElementById('weeklyReport').addEventListener('click', () => this.generateReport('weekly'));
        document.getElementById('monthlyReport').addEventListener('click', () => this.generateReport('monthly'));
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
    }

    setCurrentDate() {
        document.getElementById('dateSelector').value = this.currentDate;
    }

    updateDayDisplay() {
        const date = new Date(this.currentDate);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIndex = date.getDay();
        document.getElementById('daySelector').value = dayNames[dayIndex];
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showUploadStatus('Processing file...', 'blue');
        
        try {
            let extractedTasks = [];
            const fileExtension = file.name.split('.').pop().toLowerCase();

            switch (fileExtension) {
                case 'xlsx':
                case 'xls':
                    extractedTasks = await this.extractFromExcel(file);
                    break;
                case 'pdf':
                    extractedTasks = await this.extractFromPDF(file);
                    break;
                case 'docx':
                    extractedTasks = await this.extractFromDocx(file);
                    break;
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                    extractedTasks = await this.extractFromImage(file);
                    break;
                default:
                    throw new Error('Unsupported file type');
            }

            this.tasks = extractedTasks.map((taskEntry, index) => ({
                id: index,
                text: taskEntry.fullText,
                taskName: taskEntry.taskName,
                timeRange: taskEntry.timeRange,
                completed: false
            }));

            this.renderTasks();
            this.showUploadStatus(`Successfully extracted ${this.tasks.length} tasks!`, 'green');
            this.showToast('Tasks extracted successfully!');
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showUploadStatus('Error processing file. Please try again.', 'red');
            this.showToast('Error processing file', 'error');
        }
    }

    async extractFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    
                    const tasks = [];
                    
                    rows.forEach((row, rowIndex) => {
                        if (row.length > 0) {
                            // Skip first few rows that are likely headers
                            if (rowIndex < 2) {
                                return; // Skip potential header rows
                            }
                            
                            // Process each cell individually if it looks like a task
                            row.forEach((cell, cellIndex) => {
                                if (cell && typeof cell === 'string') {
                                    const cellText = cell.trim();
                                    if (cellIndex > 0 && cellText.length > 3) { // Skip first column (likely time column)
                                        const parsed = this.parseTaskEntry(cellText);
                                        if (parsed) {
                                            tasks.push(parsed);
                                        }
                                    }
                                }
                            });
                            
                            // Also try combining the row as before
                            const rowText = row.join(' ').trim();
                            if (rowText.length > 3) {
                                const parsed = this.parseTaskEntry(rowText);
                                if (parsed) {
                                    tasks.push(parsed);
                                }
                            }
                        }
                    });
                    
                    // Remove duplicates based on taskName
                    const uniqueTasks = [];
                    const seenTasks = new Set();
                    
                    tasks.forEach(task => {
                        const key = task.taskName.toLowerCase();
                        if (!seenTasks.has(key)) {
                            seenTasks.add(key);
                            uniqueTasks.push(task);
                        }
                    });
                    
                    resolve(uniqueTasks);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async extractFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const typedArray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    
                    const tasks = this.parseTextToTasks(fullText);
                    resolve(tasks);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async extractFromDocx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    const tasks = this.parseTextToTasks(result.value);
                    resolve(tasks);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async extractFromImage(file) {
        return new Promise((resolve, reject) => {
            this.showUploadStatus('Processing image with OCR...', 'blue');
            
            Tesseract.recognize(file, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        this.showUploadStatus(`OCR Progress: ${Math.round(m.progress * 100)}%`, 'blue');
                    }
                }
            }).then(({ data: { text } }) => {
                const tasks = this.parseTextToTasks(text);
                resolve(tasks);
            }).catch(reject);
        });
    }

    parseTextToTasks(text) {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const tasks = [];
        
        lines.forEach(line => {
            line = line.trim();
            if (line.length > 3) {
                const parsed = this.parseTaskEntry(line);
                if (parsed) {
                    tasks.push(parsed);
                }
            }
        });
        
        return tasks.filter(task => task !== null);
    }

    parseTaskEntry(text) {
        // Clean up the text
        text = text.trim();
        
        // ENHANCED FILTER OUT UNWANTED TEXT
        const unwantedPatterns = [
            /weekly\s+schedule/i,
            /months?\s+plan/i,
            /\d{1,2}\/\d{1,2}\/\d{4}/,  // Dates like 01/07/2025
            /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
            /^(mon|tue|wed|thu|fri|sat|sun)$/i,
            /^time$/i,
            /^tasks?$/i,
            /^today'?s?\s+tasks?/i,
            /^save\s+progress$/i,
            /^clear\s+tasks$/i,
            /^pending$/i,
            /^\d{4}$/,  // Just years like "2025"
            /^[\d\s\-\/]+$/,  // Just numbers, spaces, dashes, slashes
            
            // NEW: Enhanced patterns for table headers
            /^time\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
            /^time\s+(mon|tue|wed|thu|fri|sat|sun)/i,
            /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(tuesday|wednesday|thursday|friday|saturday|sunday)/i,
            /(mon|tue|wed|thu|fri|sat|sun)\s+(tue|wed|thu|fri|sat|sun)/i,
            /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
            
            // Pattern to catch multiple day names in sequence
            /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)){2,}/i,
            /(?:mon|tue|wed|thu|fri|sat|sun)(?:\s+(?:mon|tue|wed|thu|fri|sat|sun)){2,}/i,
            
            // Pattern for "Time Monday Tuesday Wednesday Thursday Friday Saturday Sunday"
            /^time\s+(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*){3,}/i,
            /^time\s+(?:(?:mon|tue|wed|thu|fri|sat|sun)\s*){3,}/i,
            
            // Pattern for rows that are just day names
            /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*$/i,
            /^(?:mon|tue|wed|thu|fri|sat|sun)(?:\s+(?:mon|tue|wed|thu|fri|sat|sun))*$/i,
            
            // Pattern for common schedule headers
            /run\s+101\s+run\s+101/i,  // Repeated headers like "RUN 101 RUN 101 RUN 101"
            /gym\s+101\s+gym\s+101/i,
            /fs\s+201\s+fs\s+201/i,
            /fullstack\s+stuff\s+idk\s+fullstack\s+stuff\s+idk/i,
            
            // Pattern for empty or generic cells
            /^empty$/i,
            /^n\/a$/i,
            /^-+$/,  // Just dashes
            /^\.+$/,  // Just dots
        ];

        // Check if text matches any unwanted pattern
        for (let pattern of unwantedPatterns) {
            if (pattern.test(text)) {
                return null; // Skip this text
            }
        }

        // Skip if text is too short or just whitespace
        if (text.length < 4) {
            return null;
        }

        // Additional check: If text contains 3+ day names, it's likely a header
        const dayCount = (text.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi) || []).length;
        if (dayCount >= 3) {
            return null;
        }

        // Additional check: If text is mostly repeated words
        const words = text.toLowerCase().split(/\s+/);
        const uniqueWords = [...new Set(words)];
        if (words.length > 4 && uniqueWords.length < words.length / 2) {
            return null; // Likely repeated content like "RUN 101 RUN 101 RUN 101"
        }

        // Pattern 1: "8:30 - 10:30 (Fullstack work IDK)" or "8:30-10:30 Fullstack work"
        const timeRangePattern1 = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*[\(\[]?(.*?)[\)\]]?$/;
        const match1 = text.match(timeRangePattern1);
        
        if (match1) {
            const startTime = match1[1];
            const endTime = match1[2];
            const taskName = match1[3].trim();
            
            if (taskName.length > 0) {
                return {
                    fullText: `${startTime} - ${endTime} (${taskName})`,
                    timeRange: `${startTime} - ${endTime}`,
                    taskName: taskName
                };
            }
        }
        
        // Pattern 2: "8:30 Fullstack work" (single time)
        const singleTimePattern = /(\d{1,2}:\d{2})\s+(.+)/;
        const match2 = text.match(singleTimePattern);
        
        if (match2) {
            const time = match2[1];
            const taskName = match2[2].trim();
            
            // Make sure task name is meaningful and not just "AM" or "PM"
            if (taskName.length > 2 && !taskName.match(/^(am|pm)$/i)) {
                return {
                    fullText: `${time} (${taskName})`,
                    timeRange: time,
                    taskName: taskName
                };
            }
        }
        
        // Pattern 3: Text with parentheses but no time
        const taskOnlyPattern = /^(.+?)[\(\[](.+?)[\)\]]?$/;
        const match3 = text.match(taskOnlyPattern);
        
        if (match3) {
            const taskName = match3[2].trim();
            if (taskName.length > 2) {
                return {
                    fullText: text,
                    timeRange: null,
                    taskName: taskName
                };
            }
        }
        
        // Pattern 4: Simple meaningful text (fallback)
        // Only if it contains letters and is meaningful
        if (text.length > 3 && /[a-zA-Z]/.test(text) && !text.match(/^\d+[\:\.\-\s]*\d*$/)) {
            // Additional check: must contain actual words
            if (text.split(' ').some(word => word.length > 2)) {
                return {
                    fullText: text,
                    timeRange: null,
                    taskName: text
                };
            }
        }
        
        return null;
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        
        if (this.tasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No tasks available for this date</p>';
            document.getElementById('progressBar').classList.add('hidden');
            return;
        }

        container.innerHTML = '';
        document.getElementById('progressBar').classList.remove('hidden');

        this.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `flex items-center p-4 border rounded-lg transition-all ${
                task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-300'
            }`;
            
            taskElement.innerHTML = `
                <input type="checkbox" id="task-${task.id}" class="mr-4 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" ${task.completed ? 'checked' : ''}>
                <div class="flex-1 cursor-pointer">
                    <label for="task-${task.id}" class="block ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}">
                        ${task.timeRange ? 
                            `<span class="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full mr-3">${task.timeRange}</span>` : 
                            ''
                        }
                        <span class="text-base">${task.taskName}</span>
                    </label>
                </div>
                <div class="ml-4">
                    ${task.completed ? 
                        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Done</span>' :
                        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Pending</span>'
                    }
                </div>
            `;

            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            
            // Make the entire task clickable
            taskElement.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    task.completed = checkbox.checked;
                    this.renderTasks();
                    this.updateProgress();
                }
            });

            checkbox.addEventListener('change', () => {
                task.completed = checkbox.checked;
                this.renderTasks();
                this.updateProgress();
            });

            container.appendChild(taskElement);
        });

        this.updateProgress();
    }

    updateProgress() {
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const totalTasks = this.tasks.length;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        document.getElementById('progressText').textContent = `${percentage}% (${completedTasks}/${totalTasks})`;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    saveProgress() {
        const data = {
            date: this.currentDate,
            tasks: this.tasks,
            completedCount: this.tasks.filter(task => task.completed).length,
            totalCount: this.tasks.length,
            percentage: this.tasks.length > 0 ? Math.round((this.tasks.filter(task => task.completed).length / this.tasks.length) * 100) : 0
        };

        localStorage.setItem(`progress_${this.currentDate}`, JSON.stringify(data));
        this.showToast('Progress saved successfully!');
    }

    loadTasksForDate() {
        const savedData = localStorage.getItem(`progress_${this.currentDate}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            this.tasks = data.tasks || [];
            this.renderTasks();
        } else {
            this.tasks = [];
            this.renderTasks();
        }
    }

    clearTasks() {
        if (confirm('Are you sure you want to clear all tasks for this date?')) {
            this.tasks = [];
            localStorage.removeItem(`progress_${this.currentDate}`);
            this.renderTasks();
            this.showToast('Tasks cleared!');
        }
    }

    generateReport(type) {
        const reportContainer = document.getElementById('reportContainer');
        const reportTitle = document.getElementById('reportTitle');
        const reportContent = document.getElementById('reportContent');

        let startDate, endDate;
        const today = new Date();

        if (type === 'weekly') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = today;
            reportTitle.textContent = 'Weekly Report (Last 7 Days)';
        } else {
            startDate = new Date(today);
            startDate.setDate(1);
            endDate = today;
            reportTitle.textContent = 'Monthly Report';
        }

        const reportData = this.getReportData(startDate, endDate);
        reportContent.innerHTML = this.formatReportData(reportData);
        reportContainer.classList.remove('hidden');
    }

    getReportData(startDate, endDate) {
        const data = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateString = currentDate.toISOString().split('T')[0];
            const savedData = localStorage.getItem(`progress_${dateString}`);
            
            if (savedData) {
                const dayData = JSON.parse(savedData);
                data.push({
                    date: dateString,
                    completed: dayData.completedCount,
                    total: dayData.totalCount,
                    percentage: dayData.percentage,
                    tasks: dayData.tasks || []
                });
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return data;
    }

    formatReportData(data) {
        if (data.length === 0) {
            return '<p class="text-gray-500">No data available for this period.</p>';
        }

        const totalCompleted = data.reduce((sum, day) => sum + day.completed, 0);
        const totalTasks = data.reduce((sum, day) => sum + day.total, 0);
        const averagePercentage = data.reduce((sum, day) => sum + day.percentage, 0) / data.length;

        let html = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-100 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-blue-800">${totalCompleted}</div>
                    <div class="text-blue-600">Tasks Completed</div>
                </div>
                <div class="bg-green-100 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-green-800">${totalTasks}</div>
                    <div class="text-green-600">Total Tasks</div>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-purple-800">${Math.round(averagePercentage)}%</div>
                    <div class="text-purple-600">Average Completion</div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full table-auto">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="px-4 py-2 text-left">Date</th>
                            <th class="px-4 py-2 text-left">Completed</th>
                            <th class="px-4 py-2 text-left">Total</th>
                            <th class="px-4 py-2 text-left">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(day => {
            html += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-2">${new Date(day.date).toLocaleDateString()}</td>
                    <td class="px-4 py-2">${day.completed}</td>
                    <td class="px-4 py-2">${day.total}</td>
                    <td class="px-4 py-2">
                        <div class="flex items-center">
                            <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div class="bg-blue-600 h-2 rounded-full" style="width: ${day.percentage}%"></div>
                            </div>
                            ${day.percentage}%
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        return html;
    }

    exportData() {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('progress_')) {
                allData[key] = JSON.parse(localStorage.getItem(key));
            }
        }

        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'progress_data.json';
        link.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Data exported successfully!');
    }

    showUploadStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        const messageSpan = document.getElementById('uploadMessage');
        
        statusDiv.classList.remove('hidden');
        messageSpan.textContent = message;
        
        statusDiv.className = `mt-4 px-4 py-3 rounded ${
            type === 'green' ? 'bg-green-100 border border-green-400 text-green-700' :
            type === 'red' ? 'bg-red-100 border border-red-400 text-red-700' :
            'bg-blue-100 border border-blue-400 text-blue-700'
        }`;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        
        const toastDiv = toast.querySelector('div');
        toastDiv.className = `px-6 py-3 rounded-lg shadow-lg ${
            type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProgressTracker();
});
