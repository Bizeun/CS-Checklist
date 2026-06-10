// API base URL - adjust for your Vercel deployment
const API_BASE = window.location.origin + '/api';

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const calendarHeader = document.getElementById('calendar-header');
const monthYearSpan = document.getElementById('current-month-year');
const prevButton = document.getElementById('prev-month');
const nextButton = document.getElementById('next-month');

// State
let currentViewDate = new Date(); // Tracks the month currently being viewed
let totalMasterItems = 0; // NEW: Global variable to store total item count

// --- Utility Functions ---

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
    // Uses local date components to avoid UTC/timezone confusion in a calendar view
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in YYYY-MM-DD format for comparison.
 * @returns {string}
 */
function getTodayDate() {
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

/**
 * Calculates the start and end date (YYYY-MM-DD) for the month being viewed.
 * @param {Date} dateInMonth 
 * @returns {{startDate: string, endDate: string}}
 */
function getStartAndEndDate(dateInMonth) {
    const year = dateInMonth.getFullYear();
    const month = dateInMonth.getMonth();

    // Start of the month (YYYY-MM-01)
    const startDate = new Date(year, month, 1);

    // End of the month (Last day of the month)
    const endDate = new Date(year, month + 1, 0);

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}

// --- Fetching Data ---
async function fetchSummaryData(date) {
    const { startDate, endDate } = getStartAndEndDate(date);
    
    try {
        const response = await fetch(`${API_BASE}/summary/calendar?start_date=${startDate}&end_date=${endDate}`);
        
        if (!response.ok) {
             throw new Error(`API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        // Returns {summaryData: {...}, totalMasterItems: N}
        return data; 
    } catch (error) {
        console.error('Error fetching calendar summary:', error);
        calendarGrid.innerHTML = `<p style="text-align: center; color: red;">Failed to load data: ${error.message}</p>`;
        return {};
    }
}

// --- Rendering Logic ---

// ===== Tailwind 클래스 정의 (달력 스타일) =====
const CAL_CLASSES = {
    // 요일 헤더 (Sun ~ Sat)
    header: 'grid grid-cols-7 gap-2 mb-2',
    headerDay: 'text-center text-sm font-bold text-gray-500 py-2',
    // 달력 그리드
    grid: 'grid grid-cols-7 gap-2',
    // 날짜 칸 (기본)
    day: 'block min-h-[110px] p-2 border-2 border-gray-200 rounded-lg bg-white text-gray-800 no-underline transition-all',
    // 클릭 가능한 칸 (링크)
    clickable: 'hover:border-brand-purple hover:shadow-md cursor-pointer',
    // 빈 칸 (이전 달 패딩)
    empty: 'min-h-[110px] border-2 border-transparent',
    // 상태별 배경
    submitted: 'bg-green-50 border-green-400',       // 전부 완료
    incomplete: 'bg-red-50 border-red-300',          // 미완료
    // 날짜 숫자
    dayNumber: 'text-sm font-bold mb-1',
    // 요약 내용
    details: 'text-[11px] leading-tight space-y-0.5',
    statusChecked: 'font-semibold text-green-600',
    statusOngoing: 'font-semibold text-amber-600',
    statusIncomplete: 'font-semibold text-red-600',
    summaryText: 'text-gray-500',
};

function renderHeader() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    calendarHeader.className = CAL_CLASSES.header;
    calendarHeader.innerHTML = days.map(day => `<div class="${CAL_CLASSES.headerDay}">${day}</div>`).join('');
}

/**
 * Renders the calendar grid and populates cells with summary data.
 * @param {Object} summaryData - Data keyed by date string (YYYY-MM-DD).
 * @param {number} totalItemsCount - The total number of master checklist items.
 */
function renderCalendar(summaryData, totalItemsCount) { // UPDATED SIGNATURE
    calendarGrid.innerHTML = '';
    calendarGrid.className = CAL_CLASSES.grid;

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    // Set Month/Year display
    monthYearSpan.textContent = currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // 1. Determine the first day of the month and the day of the week
    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); 

    // 2. Determine the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    // 3. Add padding (empty) cells for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarGrid.innerHTML += `<div class="${CAL_CLASSES.empty}"></div>`;
    }

    const actualToday = getTodayDate(); // Get today for comparison

    // 4. Render days
    for (let day = 1; day <= lastDayOfMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const dayData = summaryData[dateStr];
        
        let content = `<div class="${CAL_CLASSES.dayNumber}">${day}</div>`;
        let dayClass = CAL_CLASSES.day;

        // Logic to determine if the day should be a link
        const isClickable = !!dayData || dateStr >= actualToday;
        
        let elementTag = isClickable ? 'a' : 'div';
        const linkAttribute = isClickable ? `href="index.html?date=${dateStr}"` : '';
        if (isClickable) {
            dayClass += ` ${CAL_CLASSES.clickable}`;
        }

        const periodMap = {
            "1": "Daily",
            "3": "Bi-Weekly", // Example based on period '3' being present
            "7": "Weekly",
            "30": "Monthly",
            "90": "Quarterly",
            "120": "Every three Month"

        };

        if (dayData) {
            const summaryLines = [];
            for (const periodKey in dayData.period_checks) {
                const checkedCount = dayData.period_checks[periodKey] || 0;
                const dueCount = dayData.period_due_counts[periodKey] || 0; 
                const periodName = periodMap[periodKey] || `Period ${periodKey}`;
            
                summaryLines.push(`<p class="${CAL_CLASSES.summaryText}">${periodName}: ${checkedCount}/${dueCount}</p>`);
            }
            const periodSummaries = summaryLines.join('\n');
            
            // --- STATUS LOGIC ---
            let statusText;
            let statusClass;
            const checkedCount = dayData.total_checked;
            const dueCount = dayData.total_due;

            if (checkedCount === 0 && dayData.submitted === false) {
                // Case 1: Nothing checked (Incomplete)
                statusText = '❌ Incomplete';
                statusClass = CAL_CLASSES.statusIncomplete;
                dayClass += ` ${CAL_CLASSES.incomplete}`;
            } else if (checkedCount === dueCount) {
                // Case 2: All items checked (Checked)
                statusText = '✅ Checked';
                statusClass = CAL_CLASSES.statusChecked;
                dayClass += ` ${CAL_CLASSES.submitted}`;
            } else {
                // Case 3: Some items checked, but not all (Ongoing)
                statusText = '⚠️ Ongoing';
                statusClass = CAL_CLASSES.statusOngoing;
            }
            
            content += `
                <div class="${CAL_CLASSES.details}">
                    <p class="${statusClass}">${statusText}</p>
                    <p class="${CAL_CLASSES.summaryText}">Total: ${checkedCount}/${dueCount}</p>
                    ${periodSummaries}
                </div>
            `;
        }

        // Use the determined elementTag and attributes
        calendarGrid.innerHTML += `<${elementTag} ${linkAttribute} class="${dayClass}">${content}</${elementTag}>`;
    }
}

// --- Main Control Flow ---

async function initCalendar() {
    renderHeader();
    await loadCalendarForMonth(currentViewDate);
}

async function loadCalendarForMonth(date) {
    const responseData = await fetchSummaryData(date);
    // NEW: Extract data from the response structure
    const summaryData = responseData.summaryData || {};
    totalMasterItems = responseData.totalMasterItems || 0; // Update global state
    
    renderCalendar(summaryData, totalMasterItems); // UPDATED CALL
}

// Event handlers for navigation
prevButton.addEventListener('click', async () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    await loadCalendarForMonth(currentViewDate);
});

nextButton.addEventListener('click', async () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    await loadCalendarForMonth(currentViewDate);
});

document.addEventListener('DOMContentLoaded', () => {
    const returnBtn = document.getElementById('return-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            // Redirect the user to the index page
            window.location.href = 'index.html';
        });
    }
});
// Run initialization
initCalendar();