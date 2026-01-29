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
        checklistDiv.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No checklist items available.</p>';
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
        checklistDiv.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No items match the selected filters.</p>';
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
                const noteDisplay = data.note ? `<span class="note-display">: ${escapeHtml(data.note)}</span>` : '';
                return `
                    <span class="checked-by">
                        ${escapeHtml(user)} ${timeStr}
                    </span>
                    <span class="notes">
                        ${escapeHtml(user)} ${noteDisplay}
                    </span>
                `;
            }).join(', ');
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

        const hasPhoto = uploadedPhotos[item.id] && uploadedPhotos[item.id].length > 0;
        const photoBtnText = hasPhoto ? (currentLang === 'en' ? '📷 Photo Added' : '📷 사진 추가됨') : (currentLang === 'en' ? '📷 Upload Photo' : '📷 사진 업로드');
        const photoBtnStyle = hasPhoto 
            ? 'background-color: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 5px;' 
            : 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 5px;';

        // Generate photo gallery HTML
        let photoGalleryHtml = '';
        if (hasPhoto) {
            photoGalleryHtml = '<div class="photo-gallery" style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;">';
            uploadedPhotos[item.id].forEach((photo, index) => {
                photoGalleryHtml += `
                    <img src="${escapeHtml(photo.url)}" 
                         class="photo-thumbnail" 
                         style="max-width: 80px; max-height: 80px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; object-fit: cover;"
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
        const notePlaceholder = currentLang === 'en' ? "Type your notes here..." : "메모를 입력하세요...";

            return `
            <div class="checklist-item ${isChecked ? 'checked' : ''}" onclick="toggleCheck('${item.id}')">
                <div class="checkbox"></div>
                <div class="item-content">
                    <div class="item-text">${escapeHtml(taskLabel)}</div>
                    <div class="item-tags">
                        <span class="tag tag-process">${escapeHtml(processLabel)}</span>
                        <span class="tag tag-equipment">${escapeHtml(equipmentLabel)}</span>
                        <span class="tag tag-category" style="background-color: #e0e0e0;">${escapeHtml(categoryLabel)}</span>
                        <span class="tag tag-period">${escapeHtml(periodLabel)}</span>
                    </div>
                    ${checkedByHtml.length > 0 ? `
                        <div class="item-meta">
                            ${checkedByHtml}
                        </div>
                    ` : ''}
                    
                    <div class="item-actions" onclick="event.stopPropagation();">
                        <button type="button" class="action-btn" style="${photoBtnStyle} margin-right: 8px;" onclick="triggerPhotoUpload('${item.id}')">
                            ${photoBtnText}
                        </button>
                        <button type="button" class="action-btn" onclick="toggleNoteBox('${item.id}')">
                            ${noteBtnText}
                        </button>
                        <textarea id="${noteInputId}" class="item-note-input" rows="3" style="display: ${noteDisplay};" placeholder="${notePlaceholder}" onblur="updateItemNote('${item.id}', this.value)" onclick="event.stopPropagation();">${escapeHtml(existingNote)}</textarea>
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
    loadingDiv.style.display = 'block';
    checklistContainer.style.display = 'none';
    errorDiv.style.display = 'none';
}

function hideLoading() {
    loadingDiv.style.display = 'none';
    checklistContainer.style.display = 'block';
}

function showError(message) {
    errorDiv.style.display = 'block';
    document.getElementById('error-message').textContent = message;
    checklistContainer.style.display = 'none';
}

function hideError() {
    errorDiv.style.display = 'none';
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
    selectElement.innerHTML = `<option value="all">${defaultLabel}</option>`;
    values.forEach(value => {
        const label = formatter ? formatter(value) : value;
        selectElement.innerHTML += `<option value="${value}">${escapeHtml(label)}</option>`;
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

// Load initial checklist
loadChecklist();