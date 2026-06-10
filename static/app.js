// API base URL - adjust for your Vercel deployment
const API_BASE = window.location.origin + '/api';

// Get current date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    // Use UTC date parts to prevent timezone issues when comparing YYYY-MM-DD strings
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

// Function to read date from URL query parameter
function getDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam && dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateParam;
    }
    return null;
}

/**
 * Formats an ISO timestamp string to a readable time (e.g., 03:30 PM).
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error("Invalid timestamp:", timestamp);
        return '';
    }
}

// Initialize variables
let currentDate = getDateFromUrl() || getTodayDate();
let currentUser = localStorage.getItem('checklist_user') || '';
let currentLine = localStorage.getItem('checklist_line') || 'Line1';
let currentLang = localStorage.getItem('checklist_lang') || 'kr'; // 'kr' or 'en'

let checklistItems = [];
let checkedItems = {};
let lastCompletions = {}; 
let filterProcess = 'all';
let filterEquipment = 'all';
let filterPeriod = 'all';
let filterCategory = 'all';
let uploadedPhotos = {};

// DOM elements
const dateInput = document.getElementById('date-input');
const userInput = document.getElementById('user-input');
const lineInput = document.getElementById('line-input');
const langBtn = document.getElementById('lang-btn');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const checklistContainer = document.getElementById('checklist-container');
const checklistDiv = document.getElementById('checklist');
const totalItemsSpan = document.getElementById('total-items');
const checkedCountSpan = document.getElementById('checked-count');
const progressSpan = document.getElementById('progress');
const processFilterSelect = document.getElementById('filter-process');
const equipmentFilterSelect = document.getElementById('filter-equipment');
const periodFilterSelect = document.getElementById('filter-period');
const categoryFilterSelect = document.getElementById('filter-category');

// Set initial values
dateInput.value = currentDate;
userInput.value = currentUser;
if (lineInput) {
    lineInput.value = currentLine;
}
updateLangButton();

// Helper: Construct document ID
function getDocId() {
    return `${currentDate}_${currentLine}`;
}

// Helper: Update Lang Button Text
function updateLangButton() {
    if (langBtn) {
        // Show current language as requested: '한글' for KR mode, 'EN' for EN mode
        langBtn.textContent = currentLang === 'kr' ? '한글' : 'EN';
    }
}

// Event Listeners
dateInput.addEventListener('change', (e) => {
    currentDate = e.target.value;
    loadChecklist();
});

userInput.addEventListener('change', (e) => {
    currentUser = e.target.value.trim(); 
    localStorage.setItem('checklist_user', currentUser);
    renderChecklist();
});

if (lineInput) {
    lineInput.addEventListener('change', (e) => {
        currentLine = e.target.value;
        localStorage.setItem('checklist_line', currentLine);
        loadChecklist(); 
    });
}

if (langBtn) {
    langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'kr' ? 'en' : 'kr';
        localStorage.setItem('checklist_lang', currentLang);
        updateLangButton();
        populateFilters(); // Update filter labels
        renderChecklist();
        updateScheduleModalLanguage(); // Update schedule modal language
        updateManualsModalLanguage(); // Update manuals modal language
    });
}

processFilterSelect.addEventListener('change', (e) => {
    filterProcess = e.target.value;
    renderChecklist();
});

equipmentFilterSelect.addEventListener('change', (e) => {
    filterEquipment = e.target.value;
    renderChecklist();
});

periodFilterSelect.addEventListener('change', (e) => {
    filterPeriod = e.target.value;
    renderChecklist();
});

categoryFilterSelect.addEventListener('change', (e) => {
    filterCategory = e.target.value;
    renderChecklist();
});

// Load item definitions
async function loadChecklistItems() {
    try {
        const response = await fetch(`${API_BASE}/checklist/items`);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            checklistItems = data.items;
            populateFilters();
        } else {
            showError('No checklist items found. Please run the setup script first.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error loading checklist items:', error);
        showError('Failed to load checklist items: ' + error.message);
        return false;
    }
}

// Load user data
async function loadChecklist() {
    showLoading();
    hideError();
    
    const itemsLoaded = await loadChecklistItems();
    if (!itemsLoaded) {
        return;
    }
    
    try {
        const [completionsResponse, checklistResponse] = await Promise.all([
            fetch(`${API_BASE}/checklist/last-completions`),
            fetch(`${API_BASE}/checklist?date=${getDocId()}`)
        ]);
        
        const completionsData = await completionsResponse.json();
        lastCompletions = completionsData.lastCompletions || {};
        
        const checklistData = await checklistResponse.json();
        checkedItems = checklistData.checked ? checklistData.checked : {};
        
        // Load uploaded photos from checked items
        uploadedPhotos = {};
        if (checkedItems) {
            Object.keys(checkedItems).forEach(itemId => {
                const users = checkedItems[itemId];
                Object.keys(users).forEach(userName => {
                    const userData = users[userName];
                    if (userData.photos && userData.photos.length > 0) {
                        if (!uploadedPhotos[itemId]) {
                            uploadedPhotos[itemId] = [];
                        }
                        uploadedPhotos[itemId].push(...userData.photos);
                    }
                });
            });
        }
        
        renderChecklist();
        hideLoading();
    } catch (error) {
        console.error('Error loading checklist:', error);
        showError('Failed to load checklist: ' + error.message);
        hideLoading();
    }
}

// Toggle Check Logic
async function toggleCheck(itemId) {
    const activeUser = currentUser || 'anonymous';

    if (!currentUser || currentUser.trim() === '') {
        alert('Please enter your name first before checking any item.');
        userInput.focus();
        return; 
    }

    const noteInput = document.getElementById(`note-input-${itemId}`);
    const note = noteInput ? noteInput.value : '';

    if (!checkedItems[itemId]) {
        checkedItems[itemId] = {};
    }

    const wasChecked = checkedItems[itemId][activeUser];

    if (wasChecked) {
        // Unchecking - remove the item but keep it visible on screen
        delete checkedItems[itemId][activeUser];
        if (Object.keys(checkedItems[itemId]).length === 0) {
            delete checkedItems[itemId];
        }
        // Just re-render without submitting to server
        // The item will stay visible until submit button is pressed
        renderChecklist();
    } else {
        // Checking - add the item
        checkedItems[itemId][activeUser] = {
            timestamp: new Date().toISOString(),
            checked: true,
            note: note
        };
        renderChecklist();
    }
}

// Update Note Logic
function updateItemNote(itemId, note) {
    if (!currentUser) return;
    if (checkedItems[itemId] && checkedItems[itemId][currentUser]) {
        checkedItems[itemId][currentUser].note = note;
        submitChecklist(false); 
    } 
}

// Submit Checklist
async function submitChecklist(showAlert = true) {
    if (!currentUser) {
        alert('Please enter your name first before submitting the full checklist!');
        userInput.focus();
        return;
    }
    
    const payload = {
        date: getDocId(),
        items: checklistItems,
        checked: checkedItems
    };

    try {
        showLoading();
        const response = await fetch(`${API_BASE}/checklist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            await loadChecklist();
        } else {
            throw new Error(data.error || 'Submit failed');
        }
    } catch (error) {
        console.error('Error submitting checklist:', error);
        showError('Failed to submit checklist: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Render Logic
function renderChecklist() {
    if (checklistItems.length === 0) {
        checklistDiv.innerHTML = '<p class="text-center py-10 text-gray-500 text-lg">No checklist items available.</p>';
        return;
    }
    
    const actualToday = getTodayDate();

    // Sort items
    const sortedItems = [...checklistItems].sort((a, b) => {
        // Priority 1: '정합성' category always first
        const isConsistencyA = (a.category === '정합성');
        const isConsistencyB = (b.category === '정합성');
        if (isConsistencyA && !isConsistencyB) return -1;
        if (!isConsistencyA && isConsistencyB) return 1;

        // Priority 2: Period
        const periodA = a.periodDays != null ? a.periodDays : Number.MAX_SAFE_INTEGER;
        const periodB = b.periodDays != null ? b.periodDays : Number.MAX_SAFE_INTEGER;
        if (periodA !== periodB) return periodA - periodB;

        // Priority 3: Process -> Equipment (Vision Type) -> Order
        const processA = (a.process || '').toLowerCase();
        const processB = (b.process || '').toLowerCase();
        if (processA !== processB) return processA.localeCompare(processB);

        const equipmentA = (a.equipment || '').toLowerCase();
        const equipmentB = (b.equipment || '').toLowerCase();
        if (equipmentA !== equipmentB) return equipmentA.localeCompare(equipmentB);

        return (a.order || 0) - (b.order || 0);
    });

    const filteredItems = sortedItems.filter(item => {
        const itemCategory = item.category || 'General';
        const itemProcess = item.process || 'General';
        const itemEquipment = item.equipment || 'General'; // This is 'Vision Type' in Excel

        const categoryMatches = filterCategory === 'all' || itemCategory === filterCategory;
        const processMatches = filterProcess === 'all' || itemProcess === filterProcess;
        
        // Show items if they match the selected filter OR if they are '공통'
        const equipmentMatches = filterEquipment === 'all' || itemEquipment === filterEquipment || itemEquipment === '공통';
        
        const periodValue = item.periodDays != null ? String(item.periodDays) : 'custom';
        const periodMatches = filterPeriod === 'all' || periodValue === filterPeriod;
        
        const isAlreadyCheckedToday = checkedItems[item.id];
        
        // For today's date or future dates, show all items (don't filter by period)
        // For past dates or already checked items, show them with filter conditions only
        if (currentDate >= actualToday || isAlreadyCheckedToday || currentDate < actualToday) {
            return categoryMatches && processMatches && equipmentMatches && periodMatches;
        }
        
        // This block is now unreachable for current/future dates
        const periodDays = item.periodDays;
        if (periodDays != null && periodDays > 0) {
            const lastCompletionDate = lastCompletions[item.id];
            if (lastCompletionDate) {
                const lastDate = new Date(lastCompletionDate + 'T00:00:00');
                const today = new Date(currentDate + 'T00:00:00');
                const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                
                if (daysSince < periodDays) {
                    return false; 
                }
            }
        }
        return categoryMatches && processMatches && equipmentMatches && periodMatches;
    });
    
    if (filteredItems.length === 0) {
        checklistDiv.innerHTML = '<p class="text-center py-10 text-gray-500 text-lg">No items match the selected filters.</p>';
        updateStats([]);
        return;
    }

    checklistDiv.innerHTML = filteredItems.map(item => {
        const isChecked = checkedItems[item.id]; 
        let existingNote = '';
        const currentUserCheckData = checkedItems[item.id] ? checkedItems[item.id][currentUser] : null;
        if (currentUserCheckData && currentUserCheckData.note) {
            existingNote = currentUserCheckData.note;
        }
        
        const noteInputId = `note-input-${item.id}`;
        const checkedEntries = checkedItems[item.id] ? Object.entries(checkedItems[item.id]) : [];
        
        let checkedByHtml = '';
        if (checkedEntries.length > 0) {
            checkedByHtml = checkedEntries.map(([user, data]) => {
                const timeStr = formatTime(data.timestamp); 
                const noteDisplay = data.note ? `<span class="text-gray-600">: ${escapeHtml(data.note)}</span>` : '';
                return `
                    <span class="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium mr-2">
                        ${escapeHtml(user)} ${timeStr}
                    </span>
                    ${data.note ? `<span class="text-sm text-gray-700">${escapeHtml(user)} ${noteDisplay}</span>` : ''}
                `;
            }).join('');
        }
        
        // Multi-language support for labels
        let processLabel = item.process || 'General';
        let equipmentLabel = item.equipment || 'General';
        let categoryLabel = item.category || 'General';
        let taskLabel = (currentLang === 'en' && item.item_en) ? item.item_en : (item.item || item.text || 'Task');
        
        if (currentLang === 'en') {
            if (processLabel === '음극') processLabel = 'Anode';
            if (processLabel === '양극') processLabel = 'Cathode';
            if (equipmentLabel === '통합') equipmentLabel = 'Integrated';
            if (equipmentLabel === '공통') equipmentLabel = 'Common';
            if (equipmentLabel === '포일') equipmentLabel = 'Foil';
            if (equipmentLabel === '탈리') equipmentLabel = 'Tali';
            
            if (categoryLabel === '정합성') categoryLabel = 'Consistency';
            if (categoryLabel === '하드웨어') categoryLabel = 'H/W';
            if (categoryLabel === '소프트웨어') categoryLabel = 'S/W';
            if (categoryLabel.includes('클리닝')) categoryLabel = 'Cleaning';
        }

        const periodLabel = formatPeriodLabel(item.periodDays);
        
        // Add class based on process type for styling
        let processClass = '';
        if (item.process === '양극') {
            processClass = 'cathode';
        } else if (item.process === '음극') {
            processClass = 'anode';
        }

        const hasPhoto = uploadedPhotos[item.id] && uploadedPhotos[item.id].length > 0;
        const photoBtnText = hasPhoto ? (currentLang === 'en' ? '📷 Photo Added' : '📷 사진 추가됨') : (currentLang === 'en' ? '📷 Upload Photo' : '📷 사진 업로드');
        const photoBtnStyle = hasPhoto 
            ? 'background-color: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 5px;' 
            : 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 5px;';

        // Generate photo gallery HTML (Tailwind CSS)
        let photoGalleryHtml = '';
        if (hasPhoto) {
            photoGalleryHtml = '<div class="flex flex-wrap gap-2 mt-3">';
            uploadedPhotos[item.id].forEach((photo, index) => {
                photoGalleryHtml += `
                    <img src="${escapeHtml(photo.url)}" 
                         class="w-20 h-20 rounded-lg border border-gray-300 cursor-pointer object-cover hover:scale-110 hover:shadow-lg transition-all" 
                         onclick="event.stopPropagation(); window.open('${escapeHtml(photo.url)}', '_blank')"
                         title="${escapeHtml(photo.filename || 'Photo ' + (index + 1))}"
                    />
                `;
            });
            photoGalleryHtml += '</div>';
        }

        const hasNote = existingNote && existingNote.trim().length > 0;
        const noteDisplay = hasNote ? 'block' : 'none';
        const noteBtnText = hasNote ? (currentLang === 'en' ? '📝 Edit Note' : '📝 메모 수정') : (currentLang === 'en' ? '📝 Add Note' : '📝 메모 추가');
        const notePlaceholder = currentLang === 'en' ? "Enter special issues or actions taken for issues" : "특이사항 혹은 문제 발생 시 조치 사항을 입력하세요";

            return `
            <!-- Checklist Item (Tailwind CSS) -->
            <div class="group relative flex items-start gap-4 p-5 bg-white rounded-xl border-2 ${isChecked ? 'border-green-400 bg-green-50' : 'border-gray-200'} hover:shadow-md transition-all duration-200 cursor-pointer" 
                 onclick="toggleCheck('${item.id}')">
                <!-- 
                  체크리스트 아이템 스타일 설명:
                  - group: 자식 요소에서 hover:group-hover 사용 가능
                  - relative: 절대 위치 자식 요소 기준
                  - flex items-start gap-4: flexbox, 위쪽 정렬, 간격 16px
                  - p-5: padding 20px
                  - bg-white: 배경 흰색
                  - rounded-xl: border-radius 12px
                  - border-2: 2px 테두리
                  - border-green-400 bg-green-50 (체크됨): 초록색 테두리/배경
                  - border-gray-200 (체크 안됨): 회색 테두리
                  - hover:shadow-md: 호버 시 그림자
                  - transition-all duration-200: 부드러운 전환
                  - cursor-pointer: 클릭 커서
                -->
                
                <!-- Checkbox -->
                <div class="flex-shrink-0 mt-1 w-6 h-6 rounded-md border-2 ${isChecked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'} flex items-center justify-center transition-all">
                    ${isChecked ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                </div>
                <!-- 
                  체크박스 스타일 설명:
                  - flex-shrink-0: 크기 유지 (줄어들지 않음)
                  - mt-1: margin-top 4px (텍스트와 정렬)
                  - w-6 h-6: 24px x 24px
                  - rounded-md: 모서리 둥글게
                  - border-2: 2px 테두리
                  - bg-green-500 border-green-500 (체크됨): 초록색
                  - bg-white border-gray-300 (안 됨): 흰색/회색
                  - flex items-center justify-center: 체크마크 중앙 정렬
                -->
                
                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <!-- Task Title -->
                    <div class="text-lg font-semibold text-gray-800 mb-2 ${isChecked ? 'line-through text-gray-500' : ''}">${escapeHtml(taskLabel)}</div>
                    <!-- 
                      - text-lg: font-size 1.125rem
                      - font-semibold: font-weight 600
                      - text-gray-800: 진한 회색
                      - mb-2: margin-bottom 8px
                      - line-through text-gray-500 (체크됨): 취소선, 연한 회색
                    -->
                    
                    <!-- Tags -->
                    <div class="flex flex-wrap gap-2 mb-3">
                        ${processClass === 'cathode' ? 
                            `<span class="inline-flex items-center justify-center px-3 py-1 text-xs font-bold text-white rounded-full bg-gradient-to-r from-cathode-light to-cathode-dark border-[3px] border-cathode-border shadow-sm">${escapeHtml(processLabel)}</span>` :
                          processClass === 'anode' ?
                            `<span class="inline-flex items-center justify-center px-3 py-1 text-xs font-bold text-white rounded-full bg-gradient-to-r from-anode-light to-anode-dark border-[3px] border-anode-border shadow-sm">${escapeHtml(processLabel)}</span>` :
                            `<span class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">${escapeHtml(processLabel)}</span>`
                        }
                        <span class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-pink-700 bg-pink-100 rounded-full">${escapeHtml(equipmentLabel)}</span>
                        <span class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-full">${escapeHtml(categoryLabel)}</span>
                        <span class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">${escapeHtml(periodLabel)}</span>
                    </div>
                    <!-- 
                      태그 스타일 설명:
                      - inline-flex items-center justify-center: 인라인 flexbox, 텍스트 중앙 정렬
                      - px-3 py-1: padding 좌우 12px, 상하 4px
                      - text-xs: font-size 0.75rem
                      - font-medium/bold: 폰트 굵기
                      - rounded-full: 완전히 둥근 모서리
                      - bg-gradient-to-r from-X to-Y: 그라데이션 (음극/양극)
                      - border-[3px]: 3px 테두리 (음극/양극)
                      - text-X bg-X: 색상 조합
                    -->
                    
                    <!-- Checked By -->
                    ${checkedByHtml.length > 0 ? `
                        <div class="flex flex-wrap gap-2 mb-3 text-sm">
                            ${checkedByHtml}
                        </div>
                    ` : ''}
                    
                    <!-- Actions -->
                    <div class="mt-3 space-y-2" onclick="event.stopPropagation();">
                        <div class="flex flex-wrap gap-2">
                            <button type="button" 
                                    class="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 ${hasPhoto ? 'bg-green-500 text-white border-none hover:bg-green-600' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'}" 
                                    onclick="triggerPhotoUpload('${item.id}')">
                                ${photoBtnText}
                            </button>
                            <button type="button" 
                                    class="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all hover:scale-105 active:scale-95" 
                                    onclick="toggleNoteBox('${item.id}')">
                                ${noteBtnText}
                            </button>
                        </div>
                        <!-- 
                          버튼 스타일 설명:
                          - px-4 py-2: padding 좌우 16px, 상하 8px
                          - text-sm font-medium: 작은 텍스트, 중간 굵기
                          - rounded-lg: 둥근 모서리
                          - hover:scale-105: 호버 시 1.05배 확대
                          - active:scale-95: 클릭 시 0.95배 축소
                          - transition-all: 부드러운 전환
                        -->
                        <textarea id="${noteInputId}" 
                                  class="w-full min-h-[80px] p-3 text-sm border-2 border-gray-200 rounded-lg resize-y bg-gray-50 focus:outline-none focus:border-brand-purple focus:bg-white transition-all" 
                                  rows="3" 
                                  style="display: ${noteDisplay};" 
                                  placeholder="${notePlaceholder}" 
                                  onblur="updateItemNote('${item.id}', this.value)" 
                                  onclick="event.stopPropagation();">${escapeHtml(existingNote)}</textarea>
                        <!-- 
                          Textarea 스타일 설명:
                          - w-full: width 100%
                          - min-h-[80px]: 최소 높이 80px
                          - p-3: padding 12px
                          - text-sm: 작은 텍스트
                          - border-2 border-gray-200: 2px 회색 테두리
                          - rounded-lg: 둥근 모서리
                          - resize-y: 세로만 크기 조절 가능
                          - bg-gray-50: 연한 회색 배경
                          - focus:outline-none: 포커스 시 기본 아웃라인 제거
                          - focus:border-brand-purple: 포커스 시 보라색 테두리
                          - focus:bg-white: 포커스 시 흰색 배경
                        -->
                        ${photoGalleryHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateStats(filteredItems);
}

function updateStats(visibleItems) {
    const total = visibleItems.length;
    const checked = visibleItems.filter(item => checkedItems[item.id]).length;
    const progress = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    totalItemsSpan.textContent = total;
    checkedCountSpan.textContent = checked;
    progressSpan.textContent = progress + '%';
}

function showLoading() {
    loadingDiv.classList.remove('hidden');
    loadingDiv.classList.add('flex');
    checklistContainer.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
    checklistContainer.classList.remove('hidden');
}

function showError(message) {
    errorDiv.classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
    checklistContainer.classList.add('hidden');
}

function hideError() {
    errorDiv.classList.add('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPeriodLabel(periodDays) {
    if (!periodDays || Number.isNaN(periodDays)) return 'As needed';
    if (periodDays === 1) return currentLang === 'en' ? 'Daily' : '매일';
    if (periodDays === 7) return currentLang === 'en' ? 'Weekly' : '주간';
    if (periodDays === 30) return currentLang === 'en' ? 'Monthly' : '월간';
    return currentLang === 'en' ? `Every ${periodDays} days` : `${periodDays}일 마다`;
}

function populateFilters() {
    const processSet = new Set();
    const equipmentSet = new Set();
    const periodSet = new Set();
    const categorySet = new Set();

    checklistItems.forEach(item => {
        categorySet.add(item.category || 'General');
        processSet.add(item.process || 'General');
        equipmentSet.add(item.equipment || 'General');
        const periodValue = item.periodDays != null ? String(item.periodDays) : 'custom';
        periodSet.add(periodValue);
    });

    const allProcessesLabel = currentLang === 'en' ? 'All processes' : '모든 공정';
    const allTypesLabel = currentLang === 'en' ? 'All types' : '모든 타입';
    const allCategoriesLabel = currentLang === 'en' ? 'All categories' : '모든 카테고리';
    const allFrequenciesLabel = currentLang === 'en' ? 'All frequencies' : '모든 주기';

    fillSelect(processFilterSelect, Array.from(processSet).sort(), allProcessesLabel, value => translateFilterValue(value));
    fillSelect(equipmentFilterSelect, Array.from(equipmentSet).sort(), allTypesLabel, value => translateFilterValue(value));
    fillSelect(categoryFilterSelect, Array.from(categorySet).sort(), allCategoriesLabel, value => translateFilterValue(value));

    const periodOptions = Array.from(periodSet).sort((a, b) => {
        const numA = a === 'custom' ? Number.MAX_SAFE_INTEGER : parseInt(a, 10);
        const numB = b === 'custom' ? Number.MAX_SAFE_INTEGER : parseInt(b, 10);
        return numA - numB;
    });
    fillSelect(periodFilterSelect, periodOptions, allFrequenciesLabel, value => {
        if (value === 'custom') return currentLang === 'en' ? 'Custom' : '커스텀';
        return formatPeriodLabel(parseInt(value, 10));
    });
}

function translateFilterValue(value) {
    if (currentLang === 'en') {
        if (value === '음극') return 'Anode';
        if (value === '양극') return 'Cathode';
        if (value === '통합') return 'Integrated';
        if (value === '공통') return 'Common';
        if (value === '포일') return 'Foil';
        if (value === '탈리(Delamination)') return 'Delamination';
        if (value === 'NG mark') return 'NG Mark';
        if (value === '정합성') return 'Consistency';
        if (value === 'S/W') return 'S/W';
        if (value === 'H/W & 클리닝') return 'H/W & Cleaning';
    }
    return value;
}

function fillSelect(selectElement, values, defaultLabel, formatter) {
    const currentValue = selectElement.value || 'all';
    // text-gray-800: 드롭다운 옵션이 흰색 글자로 안 보이는 문제 방지
    selectElement.innerHTML = `<option value="all" class="text-gray-800">${defaultLabel}</option>`;
    values.forEach(value => {
        const label = formatter ? formatter(value) : value;
        selectElement.innerHTML += `<option value="${value}" class="text-gray-800">${escapeHtml(label)}</option>`;
    });

    if ([...selectElement.options].some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = 'all';
    }
}

// Photo Upload Logic
async function triggerPhotoUpload(itemId) {
    if (!currentUser || currentUser.trim() === '') {
        alert(currentLang === 'en' ? 'Please enter your name first before uploading a photo.' : '사진을 업로드하기 전에 이름을 입력해주세요.');
        userInput.focus();
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                showLoading();
                
                // Create FormData for file upload
                const formData = new FormData();
                formData.append('file', file);
                formData.append('date', getDocId());
                formData.append('item_id', itemId);
                formData.append('user', currentUser);
                
                // Upload to server
                const response = await fetch(`${API_BASE}/checklist/upload-photo`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (!uploadedPhotos[itemId]) {
                        uploadedPhotos[itemId] = [];
                    }
                    uploadedPhotos[itemId].push({
                        filename: file.name,
                        url: data.photo_url
                    });
                    
                    // Show preview
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const imageUrl = event.target.result;
                        const imagePreviewId = `photo-preview-${itemId}`;
                        let previewElement = document.getElementById(imagePreviewId);
                        
                        const itemDiv = document.querySelector(`.checklist-item[onclick*="'${itemId}'"]`);
                        const contentDiv = itemDiv ? itemDiv.querySelector('.item-content') : null;

                        if (contentDiv) {
                            if (!previewElement) {
                                previewElement = document.createElement('img');
                                previewElement.id = imagePreviewId;
                                previewElement.className = 'photo-preview';
                                previewElement.style.maxWidth = '100px'; 
                                previewElement.style.maxHeight = '100px';
                                previewElement.style.marginTop = '10px';
                                previewElement.style.marginBottom = '10px';
                                previewElement.style.borderRadius = '4px';
                                previewElement.style.border = '1px solid #ccc';
                                previewElement.style.display = 'block';
                                previewElement.style.cursor = 'pointer';
                                previewElement.onclick = () => window.open(data.photo_url, '_blank');
                                contentDiv.appendChild(previewElement); 
                            }
                            previewElement.src = imageUrl;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    alert(currentLang === 'en' ? 'Photo uploaded successfully!' : '사진이 업로드되었습니다!');
                    renderChecklist();
                } else {
                    throw new Error(data.error || 'Upload failed');
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                alert(currentLang === 'en' ? 'Failed to upload photo: ' + error.message : '사진 업로드 실패: ' + error.message);
            } finally {
                hideLoading();
            }
        }
    };
    input.click();
}

function toggleNoteBox(itemId) {
    const noteBox = document.getElementById(`note-input-${itemId}`);
    if (noteBox) {
        if (noteBox.style.display === 'none') {
            noteBox.style.display = 'block';
            noteBox.focus(); 
        } else {
            noteBox.style.display = 'none';
        }
    }
}

async function saveNoteOnly(itemId) {
    if (!currentUser) {
        alert('Please enter your name first before saving a note.');
        userInput.focus();
        return;
    }
    const noteInput = document.getElementById(`note-input-${itemId}`);
    if (noteInput) {
        updateItemNote(itemId, noteInput.value);
    }
    if (!checkedItems[itemId] || !checkedItems[itemId][currentUser]) {
        alert('You must check the item first before saving a standalone note.');
        return;
    }
    await submitChecklist();
    toggleNoteBox(itemId, true);
    renderChecklist(); 
}

function nestedToCSV(obj, itemMap) {
    const rows = ["item_id,item,line,user,checked,timestamp,note"];
    const lineVal = currentLine || 'Unknown';

    for (const itemKey in obj) {
        const users = obj[itemKey];
        const itemDetails = itemMap[itemKey] || {};
        const itemDescription = itemDetails.item || itemDetails.text || '';
        for (const userName in users) {
            const entry = users[userName];
            const checked = entry.checked ?? "";
            const timestamp = entry.timestamp ?? "";
            const note = entry.note ? `"${String(entry.note).replace(/"/g, '""')}"` : "";
            rows.push(`${itemKey},"${itemDescription}",${lineVal},${userName},${checked},${timestamp},${note}`);
        }
    }
    return rows.join("\n");
}

function downloadCSV(csvContent, filename) {
    const bom = "\ufeff"; 
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Global Exports
window.saveNoteOnly = saveNoteOnly;
window.toggleNoteBox = toggleNoteBox;
window.triggerPhotoUpload = triggerPhotoUpload;
window.toggleCheck = toggleCheck;

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitChecklist();
        });
    }

    const summaryNavBtn = document.getElementById('summary-btn');
    if (summaryNavBtn) {
        summaryNavBtn.addEventListener('click', () => {
            window.location.href = 'summary.html';
        });
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const selectedDate = getDocId(); 
            const itemMap = checklistItems.reduce((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});
            
            const apiUrl = `${API_BASE}/checklist?date=${selectedDate}`;
    
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const csv = nestedToCSV(data.checked || {}, itemMap);
                    downloadCSV(csv, `checklist_checked_${selectedDate}.csv`);
                })
                .catch(error => {
                    console.error('Error fetching or processing data:', error);
                    alert('Failed to download data. Check the console for details.');
                });
        });
    }
});

// Production Schedule Functions
async function loadSchedule() {
    const date = getDocId().split('_')[0]; // Get date part only
    
    try {
        const response = await fetch(`${API_BASE}/schedule?date=${date}`);
        const data = await response.json();
        
        // Update UI for all lines
        ['Line1', 'Line2', 'Line3', 'Line4'].forEach(line => {
            const lineData = data[line] || {};
            const lineNum = line.toLowerCase().replace('line', 'line');
            
            // Set values
            document.getElementById(`${lineNum}-status`).value = lineData.status || 'pending';
            document.getElementById(`${lineNum}-schedule`).value = lineData.schedule || '';
            document.getElementById(`${lineNum}-notes`).value = lineData.notes || '';
            
            // Update last modified info
            const lastUpdateEl = document.getElementById(`${lineNum}-last-update`);
            if (lineData.updated_by && lineData.updated_at) {
                const time = formatTime(lineData.updated_at);
                lastUpdateEl.textContent = `${lineData.updated_by} ${time}`;
            } else {
                lastUpdateEl.textContent = currentLang === 'kr' ? '수정 기록 없음' : 'No modifications';
            }
        });
    } catch (error) {
        console.error('Error loading schedule:', error);
        alert(currentLang === 'kr' ? '일정을 불러오는데 실패했습니다.' : 'Failed to load schedule.');
    }
}

async function saveLineSchedule(line) {
    if (!currentUser || currentUser.trim() === '') {
        alert(currentLang === 'kr' ? '이름을 먼저 입력해주세요!' : 'Please enter your name first!');
        userInput.focus();
        return;
    }
    
    const lineNum = line.toLowerCase().replace('line', 'line');
    const date = getDocId().split('_')[0];
    
    const data = {
        date: date,
        line: line,
        user: currentUser,
        status: document.getElementById(`${lineNum}-status`).value,
        schedule: document.getElementById(`${lineNum}-schedule`).value,
        notes: document.getElementById(`${lineNum}-notes`).value
    };
    
    try {
        const response = await fetch(`${API_BASE}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const msg = currentLang === 'kr' ? `${line} 일정이 저장되었습니다!` : `${line} schedule saved successfully!`;
            alert(msg);
            loadSchedule(); // Reload to show updated info
        } else {
            throw new Error(result.error || 'Save failed');
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        const msg = currentLang === 'kr' ? '일정 저장에 실패했습니다: ' : 'Failed to save schedule: ';
        alert(msg + error.message);
    }
}

// Make function available globally
window.saveLineSchedule = saveLineSchedule;

// Translation function for schedule modal
function updateScheduleModalLanguage() {
    const lang = currentLang;
    
    // Schedule button text
    const scheduleBtn = document.getElementById('schedule-btn');
    if (scheduleBtn) {
        scheduleBtn.textContent = lang === 'kr' ? '📅 오늘 생산 일정표' : '📅 Today\'s Production Schedule';
    }
    
    // Modal title
    const modalTitle = document.getElementById('schedule-modal-title');
    if (modalTitle) {
        modalTitle.textContent = lang === 'kr' ? '📅 라인별 생산 일정' : '📅 Production Schedule by Line';
    }
    
    // Labels
    document.querySelectorAll('.schedule-label').forEach(el => {
        el.textContent = lang === 'kr' ? '생산 일정:' : 'Production Schedule:';
    });
    
    document.querySelectorAll('.notes-label').forEach(el => {
        el.textContent = lang === 'kr' ? '특이사항/메모:' : 'Notes/Remarks:';
    });
    
    document.querySelectorAll('.log-label').forEach(el => {
        el.textContent = lang === 'kr' ? '📝 수정 기록' : '📝 Modification Log';
    });
    
    // Save buttons
    document.querySelectorAll('.save-schedule-btn').forEach(el => {
        el.textContent = lang === 'kr' ? '저장' : 'Save';
    });
    
    // Status select options
    document.querySelectorAll('.status-select option').forEach(option => {
        const value = option.value;
        if (value === 'pending') {
            option.textContent = lang === 'kr' ? '대기중' : 'Pending';
        } else if (value === 'in_progress') {
            option.textContent = lang === 'kr' ? '진행중' : 'In Progress';
        } else if (value === 'completed') {
            option.textContent = lang === 'kr' ? '완료' : 'Completed';
        }
    });
    
    // Placeholders
    document.querySelectorAll('.schedule-input').forEach(el => {
        el.placeholder = lang === 'kr' ? '예: 양극 2호기 점검 14:00' : 'e.g.: Line #2 Cathode Inspection 14:00';
    });
    
    document.querySelectorAll('.notes-input').forEach(el => {
        el.placeholder = lang === 'kr' ? '특이사항 입력...' : 'Enter notes...';
    });
    
    // Update "no modification" text
    ['line1', 'line2', 'line3', 'line4'].forEach(line => {
        const lastUpdateEl = document.getElementById(`${line}-last-update`);
        if (lastUpdateEl && (lastUpdateEl.textContent.includes('수정 기록 없음') || lastUpdateEl.textContent.includes('No modifications'))) {
            lastUpdateEl.textContent = lang === 'kr' ? '수정 기록 없음' : 'No modifications';
        }
    });
}

// Schedule modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const scheduleBtn = document.getElementById('schedule-btn');
    const scheduleModal = document.getElementById('schedule-modal');
    const closeSchedule = document.querySelector('.close-schedule');
    
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', () => {
            scheduleModal.classList.remove('hidden');
            scheduleModal.classList.add('flex');
            loadSchedule();
            updateScheduleModalLanguage();
        });
    }
    
    if (closeSchedule) {
        closeSchedule.addEventListener('click', () => {
            scheduleModal.classList.add('hidden');
            scheduleModal.classList.remove('flex');
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === scheduleModal) {
            scheduleModal.classList.add('hidden');
            scheduleModal.classList.remove('flex');
        }
    });
});

// ==================== Manuals (매뉴얼) ====================

// 파일 형식별 아이콘과 "바로 보기 가능 여부"
const FILE_TYPE_INFO = {
    pdf:  { icon: '📄', viewable: true },
    png:  { icon: '🖼️', viewable: true },
    jpg:  { icon: '🖼️', viewable: true },
    jpeg: { icon: '🖼️', viewable: true },
    gif:  { icon: '🖼️', viewable: true },
    doc:  { icon: '📝', viewable: false },
    docx: { icon: '📝', viewable: false },
    xls:  { icon: '📊', viewable: false },
    xlsx: { icon: '📊', viewable: false },
    ppt:  { icon: '📋', viewable: false },
    pptx: { icon: '📋', viewable: false },
};

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadManuals() {
    const troubleshootingList = document.getElementById('manuals-troubleshooting-list');
    const setupList = document.getElementById('manuals-setup-list');
    const loadingText = currentLang === 'kr' ? '불러오는 중...' : 'Loading...';
    
    troubleshootingList.innerHTML = `<p class="text-sm text-gray-400 py-2">${loadingText}</p>`;
    setupList.innerHTML = `<p class="text-sm text-gray-400 py-2">${loadingText}</p>`;
    
    try {
        const response = await fetch(`${API_BASE}/manuals`);
        const data = await response.json();
        const items = data.items || [];
        
        renderManualList(troubleshootingList, items.filter(m => m.category === 'troubleshooting'));
        renderManualList(setupList, items.filter(m => m.category === 'setup'));
    } catch (error) {
        console.error('Error loading manuals:', error);
        const errorText = currentLang === 'kr' ? '메뉴얼을 불러오는데 실패했습니다.' : 'Failed to load manuals.';
        troubleshootingList.innerHTML = `<p class="text-sm text-red-500 py-2">${errorText}</p>`;
        setupList.innerHTML = '';
    }
}

function renderManualList(container, manuals) {
    if (manuals.length === 0) {
        const emptyText = currentLang === 'kr' ? '등록된 매뉴얼이 없습니다.' : 'No manuals available.';
        container.innerHTML = `<p class="text-sm text-gray-400 py-2">${emptyText}</p>`;
        return;
    }
    
    const viewText = currentLang === 'kr' ? '보기' : 'View';
    const downloadText = currentLang === 'kr' ? '다운로드' : 'Download';
    
    container.innerHTML = manuals.map(manual => {
        const typeInfo = FILE_TYPE_INFO[manual.file_type] || { icon: '📁', viewable: false };
        const sizeText = formatFileSize(manual.size_bytes);
        
        // PDF/이미지는 브라우저에서 바로 보기, 나머지는 다운로드만
        const actionBtn = typeInfo.viewable
            ? `<a href="${escapeHtml(manual.url)}" target="_blank" rel="noopener"
                  class="px-4 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap">${viewText}</a>`
            : '';
        
        return `
            <div class="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50/50 transition-all">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-2xl flex-shrink-0">${typeInfo.icon}</span>
                    <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">${escapeHtml(manual.filename)}</p>
                        <p class="text-xs text-gray-400">${manual.file_type.toUpperCase()}${sizeText ? ' · ' + sizeText : ''}</p>
                    </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    ${actionBtn}
                    <a href="${escapeHtml(manual.url)}" download
                       class="px-4 py-1.5 text-sm font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap">${downloadText}</a>
                </div>
            </div>
        `;
    }).join('');
}

function updateManualsModalLanguage() {
    const lang = currentLang;
    
    const manualsBtn = document.getElementById('manuals-btn');
    if (manualsBtn) {
        manualsBtn.textContent = lang === 'kr' ? '메뉴얼' : 'Manuals';
    }
    
    const modalTitle = document.getElementById('manuals-modal-title');
    if (modalTitle) {
        modalTitle.textContent = lang === 'kr' ? '메뉴얼' : 'Manuals';
    }
    
    const troubleshootingTitle = document.getElementById('manuals-troubleshooting-title');
    if (troubleshootingTitle) {
        troubleshootingTitle.textContent = lang === 'kr' ? '🔧 조치 메뉴얼' : '🔧 Troubleshooting Manuals';
    }
    
    const setupTitle = document.getElementById('manuals-setup-title');
    if (setupTitle) {
        setupTitle.textContent = lang === 'kr' ? '셋업 메뉴얼' : 'Setup Manuals';
    }
}

// Manuals modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const manualsBtn = document.getElementById('manuals-btn');
    const manualsModal = document.getElementById('manuals-modal');
    const closeManuals = document.querySelector('.close-manuals');
    
    if (manualsBtn) {
        manualsBtn.addEventListener('click', () => {
            manualsModal.classList.remove('hidden');
            manualsModal.classList.add('flex');
            updateManualsModalLanguage();
            loadManuals();
        });
    }
    
    if (closeManuals) {
        closeManuals.addEventListener('click', () => {
            manualsModal.classList.add('hidden');
            manualsModal.classList.remove('flex');
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === manualsModal) {
            manualsModal.classList.add('hidden');
            manualsModal.classList.remove('flex');
        }
    });
});

// Load initial checklist
loadChecklist();

// Initialize schedule modal language on page load
updateScheduleModalLanguage();

// Initialize manuals button language on page load
updateManualsModalLanguage();