// Activity Icon Management
let currentPeriod = 'am'; // Current display period
let editingPeriod = null; // Period being edited

const activities = {
    sleep: {
        label: 'Sleep',
        src: 'images/sleep.png'
    },
    eat: {
        label: 'Meal',
        src: 'images/eat.png'
    },
    brush: {
        label: 'Brush',
        src: 'images/brush.png'
    },
    play: {
        label: 'Play',
        src: 'images/play.png'
    },
    cartoon: {
        label: 'Cartoon',
        src: 'images/cartoon.png'
    },
    sport: {
        label: 'Sport',
        src: 'images/sport.png'
    },
    homework: {
        label: 'Homework',
        src: 'images/homework.png'
    }
};

let selectedActivity = null;
let draggedActivity = null;
let markerLayoutFrame = null;
let markerLayoutTimeouts = [];
let clockResizeObserver = null;
let ghostIcon = null;
let lastProgressSignature = '';
let scheduleTypeOverride = null;
let toastTimeout = null;
let plannerPanelOpen = false;

function getTodayScheduleType(date = new Date()) {
    const day = date.getDay();
    return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function getActiveScheduleType(date = new Date()) {
    return scheduleTypeOverride || getTodayScheduleType(date);
}

function createEmptyScheduleSet() {
    return {
        weekday: { am: {}, pm: {} },
        weekend: { am: {}, pm: {} }
    };
}

function normalizeClockActivities(rawActivities) {
    const normalized = createEmptyScheduleSet();
    const source = rawActivities && typeof rawActivities === 'object' ? rawActivities : {};

    if ('weekday' in source || 'weekend' in source) {
        ['weekday', 'weekend'].forEach(scheduleType => {
            const scheduleSource = source[scheduleType] || {};
            normalized[scheduleType].am = { ...(scheduleSource.am || {}) };
            normalized[scheduleType].pm = { ...(scheduleSource.pm || {}) };
        });
        return normalized;
    }

    const legacyAm = { ...(source.am || {}) };
    const legacyPm = { ...(source.pm || {}) };
    normalized.weekday.am = { ...legacyAm };
    normalized.weekday.pm = { ...legacyPm };
    normalized.weekend.am = { ...legacyAm };
    normalized.weekend.pm = { ...legacyPm };
    return normalized;
}

function readClockActivities() {
    const raw = JSON.parse(localStorage.getItem('clockActivities') || '{}');
    const normalized = normalizeClockActivities(raw);
    localStorage.setItem('clockActivities', JSON.stringify(normalized));
    return normalized;
}

function writeClockActivities(activitiesData) {
    localStorage.setItem('clockActivities', JSON.stringify(activitiesData));
}

function formatDigitalTime(date) {
    const hours24 = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = (hours24 % 12) || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
}

function updateDigitalClock(now) {
    const digitalTime = document.querySelector('.digital-time');
    const digitalPlan = document.querySelector('.digital-plan');
    if (digitalTime) {
        digitalTime.textContent = formatDigitalTime(now);
    }
    if (digitalPlan) {
        const scheduleType = getActiveScheduleType(now);
        digitalPlan.textContent = scheduleType === 'weekday' ? 'Weekday Plan' : 'Weekend Plan';
    }
}

function getActivityAsset(activity) {
    return activities[activity]?.src || '';
}

function getDisplayPeriod() {
    return editingPeriod || currentPeriod;
}

function formatSlotLabel(hourValue, period = getDisplayPeriod()) {
    const normalized = Number(hourValue);
    if (Number.isNaN(normalized)) return String(hourValue);

    let displayHour = Math.floor(normalized % 12);
    const minutes = normalized % 1 === 0.5 ? '30' : '00';

    if (period === 'am') {
        if (Math.floor(normalized) === 12) {
            displayHour = 0;
        }
    } else {
        if (Math.floor(normalized) !== 12) {
            displayHour += 12;
        } else {
            displayHour = 12;
        }
    }

    return `${String(displayHour).padStart(2, '0')}:${minutes}`;
}

function applyActivityToImage(img, activity) {
    const asset = getActivityAsset(activity);
    if (!asset) return;

    img.src = asset;
    img.alt = activities[activity]?.label || activity;
    img.dataset.activity = activity;
}

function isEditing() {
    return editingPeriod !== null;
}

function announce(message) {
    const liveRegion = document.getElementById('liveRegion');
    if (liveRegion) {
        liveRegion.textContent = message;
    }
}

function showToast(message) {
    const toast = document.getElementById('liveToast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('visible');
    announce(message);

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 1800);
}

function getSelectedActivityLabel() {
    return selectedActivity ? activities[selectedActivity]?.label || selectedActivity : 'None';
}

function updateSelectionUI() {
    const selectionChip = document.getElementById('selectionChip');
    const selectionLabel = document.getElementById('selectionLabel');
    const isEditMode = isEditing();

    document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.classList.toggle('selected', isEditMode && btn.dataset.activity === selectedActivity);
    });

    if (selectionLabel) {
        selectionLabel.textContent = getSelectedActivityLabel();
    }

    if (selectionChip) {
        selectionChip.hidden = !isEditMode;
    }

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.toggle('selected-slot', isEditMode && !!selectedActivity);
    });
}

function setSelectedActivity(activity) {
    selectedActivity = selectedActivity === activity ? null : activity;
    updateSelectionUI();
}

function getActivePeriodLabel() {
    return currentPeriod === 'am' ? 'AM' : 'PM';
}

function getActiveScheduleLabel() {
    return getActiveScheduleType() === 'weekday' ? 'Weekday' : 'Weekend';
}

function resetViewToCurrentTime() {
    const now = new Date();
    currentPeriod = now.getHours() >= 12 ? 'pm' : 'am';
    scheduleTypeOverride = null;
}

function updateGuidanceUI() {
    const modeTitle = document.getElementById('modeTitle');
    const helperCopy = document.getElementById('helperCopy');
    const editToggleBtn = document.getElementById('editToggleBtn');
    const clearPlanBtn = document.getElementById('clearPlanBtn');
    const plannerHandle = document.getElementById('plannerHandle');
    const plannerPanel = document.getElementById('plannerPanel');
    const iconToolbar = document.querySelector('.icon-toolbar');
    const isEditMode = isEditing();
    const periodLabel = getActivePeriodLabel();
    const scheduleLabel = getActiveScheduleLabel();

    if (modeTitle) {
        modeTitle.textContent = isEditMode
            ? `Editing ${scheduleLabel} ${periodLabel}`
            : `${scheduleLabel} ${periodLabel}`;
    }

    if (helperCopy) {
        helperCopy.textContent = isEditMode
            ? 'Pick an activity from the tray, then click or drag it onto a time slot. Press the planning button again when you are done.'
            : 'Watch the live clock and talk about which activity belongs to this part of the day.';
    }

    if (editToggleBtn) {
        editToggleBtn.dataset.mode = isEditMode ? 'editing' : 'viewing';
        editToggleBtn.setAttribute('aria-pressed', String(isEditMode));
        editToggleBtn.querySelector('.edit-toggle-label').textContent = isEditMode ? 'Finish planning mode' : 'Open planning mode';
        editToggleBtn.querySelector('.edit-toggle-meta').textContent = isEditMode ? `${scheduleLabel} ${periodLabel} is being edited` : 'For caregivers';
    }

    if (clearPlanBtn) {
        clearPlanBtn.hidden = !isEditMode;
    }

    if (plannerHandle) {
        plannerHandle.setAttribute('aria-expanded', String(plannerPanelOpen));
        plannerHandle.textContent = plannerPanelOpen ? 'Hide planning tools' : 'Planning tools';
    }

    if (plannerPanel) {
        plannerPanel.hidden = !plannerPanelOpen;
    }

    if (iconToolbar) {
        iconToolbar.hidden = !isEditMode;
    }

    updateSelectionUI();
}

function setPlannerPanelOpen(nextOpen) {
    plannerPanelOpen = nextOpen;
    updateGuidanceUI();
}

function updateDropZoneMetadata() {
    document.querySelectorAll('.marker').forEach(marker => {
        const zone = marker.querySelector('.drop-zone');
        if (!zone) return;

        const hour = marker.dataset.hour;
        const label = formatSlotLabel(hour);
        const currentImage = zone.querySelector('img');
        const assignedActivity = currentImage?.dataset.activity;
        const assignmentLabel = assignedActivity ? activities[assignedActivity]?.label || assignedActivity : 'empty';

        zone.dataset.hour = hour;
        zone.dataset.label = label;
        zone.tabIndex = 0;
        zone.setAttribute('role', 'button');
        zone.setAttribute(
            'aria-label',
            `${label} slot, ${assignmentLabel}${isEditing() ? '. Press Enter to place selected activity.' : ''}`
        );
    });
}

function placeActivityInZone(zone, activity, source = 'selection') {
    if (!zone || !activity || !isEditing()) return;

    const existingImg = zone.querySelector('img');
    const slotLabel = zone.dataset.label || formatSlotLabel(zone.dataset.hour);
    if (existingImg) {
        if (existingImg.dataset.activity === activity && source !== 'move') {
            zone.removeChild(existingImg);
            showToast(`${activities[activity]?.label || activity} removed from ${slotLabel}.`);
        } else {
            applyActivityToImage(existingImg, activity);
            showToast(`${activities[activity]?.label || activity} moved to ${slotLabel}.`);
        }
    } else {
        const img = document.createElement('img');
        applyActivityToImage(img, activity);
        zone.appendChild(img);
        showToast(`${activities[activity]?.label || activity} set for ${slotLabel}.`);
    }

    saveActivities();
    makeDropZoneIconsDraggable();
    updateDropZoneMetadata();
}

function clearZoneActivity(zone) {
    if (!zone || !isEditing()) return;

    const img = zone.querySelector('img');
    if (!img) return;

    const activityLabel = activities[img.dataset.activity]?.label || img.dataset.activity;
    const slotLabel = zone.dataset.label || formatSlotLabel(zone.dataset.hour);
    zone.removeChild(img);
    saveActivities();
    updateDropZoneMetadata();
    showToast(`${activityLabel} cleared from ${slotLabel}.`);
}

function clearCurrentPlan() {
    if (!isEditing()) return;

    document.querySelectorAll('.drop-zone').forEach(zone => {
        const img = zone.querySelector('img');
        if (img) {
            zone.removeChild(img);
        }
    });

    saveActivities();
    updateDropZoneMetadata();
    showToast(`${getActiveScheduleLabel()} ${getActivePeriodLabel()} plan cleared.`);
}

function initProgressRings() {
    const namespace = 'http://www.w3.org/2000/svg';
    const radius = 31;
    const circumference = 2 * Math.PI * radius;

    document.querySelectorAll('.drop-zone').forEach(zone => {
        if (zone.querySelector('.progress-ring')) return;

        const ring = document.createElementNS(namespace, 'svg');
        ring.setAttribute('viewBox', '0 0 72 72');
        ring.setAttribute('aria-hidden', 'true');
        ring.classList.add('progress-ring');

        const track = document.createElementNS(namespace, 'circle');
        track.setAttribute('cx', '36');
        track.setAttribute('cy', '36');
        track.setAttribute('r', String(radius));
        track.classList.add('progress-track');

        const value = document.createElementNS(namespace, 'circle');
        value.setAttribute('cx', '36');
        value.setAttribute('cy', '36');
        value.setAttribute('r', String(radius));
        value.classList.add('progress-value');
        value.dataset.circumference = String(circumference);

        ring.appendChild(track);
        ring.appendChild(value);

        zone.appendChild(ring);
    });
}

function setRingProgress(zone, filledSegments, state) {
    if (!zone) return;

    zone.dataset.progressState = state;
    zone.classList.add(`progress-${state}`);
    const ring = zone.querySelector('.progress-ring');
    const value = zone.querySelector('.progress-value');

    if (ring && value) {
        ring.style.display = 'block';
        const progress = Math.max(0, Math.min(60, filledSegments)) / 60;
        const circumference = Number(value.dataset.circumference || 0);
        const activeStroke = state === 'current' ? '#ff8a5b' : '#7c8cff';
        value.style.stroke = activeStroke;
        value.style.strokeDasharray = `${progress * circumference} ${circumference}`;
    }
}

function clearHourProgress() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('progress-current', 'progress-next');
        delete zone.dataset.progressState;
        const ring = zone.querySelector('.progress-ring');
        if (ring) {
            ring.style.display = 'none';
        }
        const value = zone.querySelector('.progress-value');
        if (value) {
            value.style.strokeDasharray = '0 999';
        }
    });
    lastProgressSignature = '';
}

function updateHourProgress(now) {
    if (editingPeriod) {
        clearHourProgress();
        return;
    }

    const currentHour = (now.getHours() % 12) || 12;
    const nextHour = currentHour === 12 ? 1 : currentHour + 1;
    const minutes = now.getMinutes();
    const currentFilled = 60 - minutes;
    const nextFilled = minutes;
    const signature = `${currentHour}-${nextHour}-${currentFilled}-${nextFilled}`;

    if (signature === lastProgressSignature) return;

    clearHourProgress();

    const currentZone = document.querySelector(`.marker[data-hour="${currentHour}"] .drop-zone`);
    const nextZone = document.querySelector(`.marker[data-hour="${nextHour}"] .drop-zone`);

    setRingProgress(currentZone, currentFilled, 'current');
    setRingProgress(nextZone, nextFilled, 'next');

    lastProgressSignature = signature;
}

// Clock functionality
function updateClock() {
    const now = new Date();
    
    // Get hours, minutes, and seconds
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();

    // Adjust hours based on editing period
    if (editingPeriod === 'am' && hours >= 12) {
        hours -= 12;
    } else if (editingPeriod === 'pm' && hours < 12) {
        hours += 12;
    }

    // Update time gradient based on current hour
    updateTimeGradient(hours);

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // convert 0 to 12

    // Calculate the angles for clock hands
    // Hour hand makes two complete 360° rotations per day (720° per day)
    // Each hour represents 30° (360° / 12)
    const hourAngle = (hours * 30 + minutes / 2) - 90;
    
    // Minute hand makes one complete 360° rotation per hour
    // Each minute represents 6° (360° / 60)
    const minuteAngle = (minutes * 6 + seconds / 10) - 90;
    
    // Second hand makes one complete 360° rotation per minute
    // Each second represents 6° (360° / 60)
    const secondAngle = (seconds * 6 + milliseconds / 1000 * 6) - 90;

    // Update clock hands with hardware acceleration
    const hourHand = document.querySelector('.hand-hour');
    const minuteHand = document.querySelector('.hand-minute');
    const secondHand = document.querySelector('.hand-second');

    if (hourHand) hourHand.style.transform = `rotate(${hourAngle}deg) translateZ(0)`;
    if (minuteHand) minuteHand.style.transform = `rotate(${minuteAngle}deg) translateZ(0)`;
    if (secondHand) secondHand.style.transform = `rotate(${secondAngle}deg) translateZ(0)`;

    updateDigitalClock(now);
    updateHourProgress(now);

    // Request next frame for smooth animation
    requestAnimationFrame(updateClock);
}

// Function to update the background gradient based on the current hour
function updateTimeGradient(hour) {
    // Skip if in editing mode
    if (editingPeriod) return;
    
    // Apply the gradient class based on the hour (0-23)
    document.body.className = '';
    document.body.classList.add(`g${hour}`);
}

// Initialize everything
function init() {
    scheduleClockLayout();
    initPeriodSwitch();
    initEditMode();
    loadActivities();
    initDragAndDrop();
    
    // Apply initial gradient immediately to prevent white flash
    const now = new Date();
    updateTimeGradient(now.getHours());
    
    // Start clock immediately
    updateClock();
    
    // Add periodic checks for AM/PM switching
    setInterval(checkAndUpdatePeriod, 1000);
    
    // Reposition markers when viewport or container size changes
    window.addEventListener('resize', scheduleClockLayout);
    window.addEventListener('orientationchange', scheduleClockLayout);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleClockLayout);
    }

    const clockContainer = document.querySelector('.clock-container');
    if (clockContainer && 'ResizeObserver' in window) {
        clockResizeObserver = new ResizeObserver(() => {
            scheduleClockLayout();
        });
        clockResizeObserver.observe(clockContainer);
    }

    const clearPlanBtn = document.getElementById('clearPlanBtn');
    if (clearPlanBtn) {
        clearPlanBtn.addEventListener('click', clearCurrentPlan);
    }

    const plannerHandle = document.getElementById('plannerHandle');
    if (plannerHandle) {
        plannerHandle.addEventListener('click', () => {
            const nextOpen = !plannerPanelOpen;

            if (!nextOpen && isEditing()) {
                editingPeriod = null;
                selectedActivity = null;
                resetViewToCurrentTime();
                showToast('Planning mode closed.');
            }

            setPlannerPanelOpen(nextOpen);
            updatePeriodUI();
            loadActivities();
        });
    }
}

// Make icons in drop zones draggable
function makeDropZoneIconsDraggable() {
    const dropZones = document.querySelectorAll('.drop-zone');
    
    dropZones.forEach(zone => {
        const img = zone.querySelector('img');
        if (img) {
            // Make image draggable
            img.draggable = true;
            
            // Remove any existing listeners
            img.removeEventListener('dragstart', img.dragStartHandler);
            img.removeEventListener('dragend', img.dragEndHandler);
            img.removeEventListener('touchstart', img.touchStartHandler);
            img.removeEventListener('touchmove', img.touchMoveHandler);
            img.removeEventListener('touchend', img.touchEndHandler);
            
            // Touch handling
            let touchStartX = 0;
            let touchStartY = 0;
            let draggingTouch = false;
            let draggedImg = null;
            
            img.touchStartHandler = (e) => {
                // Prevent dragging if not in edit mode
                if (!editingPeriod) {
                    e.preventDefault();
                    return;
                }
                
                e.preventDefault();
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                draggingTouch = true;
                
                // Create ghost image
                draggedImg = img.cloneNode(true);
                draggedImg.style.position = 'fixed';
                draggedImg.style.opacity = '0.6';
                draggedImg.style.pointerEvents = 'none';
                document.body.appendChild(draggedImg);
                
                zone.classList.add('dragging');
            };
            
            img.touchMoveHandler = (e) => {
                if (!draggingTouch) return;
                e.preventDefault();
                
                const touch = e.touches[0];
                if (draggedImg) {
                    draggedImg.style.left = (touch.clientX - 25) + 'px';
                    draggedImg.style.top = (touch.clientY - 25) + 'px';
                }
                
                // Check if over any drop zone
                const dropZones = document.querySelectorAll('.drop-zone');
                dropZones.forEach(dropZone => {
                    const rect = dropZone.getBoundingClientRect();
                    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                        dropZone.classList.add('drag-over');
                    } else {
                        dropZone.classList.remove('drag-over');
                    }
                });
            };
            
            img.touchEndHandler = (e) => {
                if (!editingPeriod) {
                    e.preventDefault();
                    return;
                }
                
                e.preventDefault();
                draggingTouch = false;
                zone.classList.remove('dragging');
                
                if (draggedImg) {
                    document.body.removeChild(draggedImg);
                    draggedImg = null;
                }
                
                const touch = e.changedTouches[0];
                let droppedInValidZone = false;
                
                // Check if dropped in any drop zone
                const dropZones = document.querySelectorAll('.drop-zone');
                dropZones.forEach(dropZone => {
                    dropZone.classList.remove('drag-over');
                    const rect = dropZone.getBoundingClientRect();
                    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                        droppedInValidZone = true;
                        if (dropZone !== zone) {
                            placeActivityInZone(dropZone, img.dataset.activity, 'move');
                            if (zone.contains(img)) {
                                zone.removeChild(img);
                            }
                        }
                    }
                });
                
                // Remove if not dropped in a valid zone
                if (!droppedInValidZone) {
                    if (zone.contains(img)) {
                        zone.removeChild(img);
                    }
                    showToast(`${activities[img.dataset.activity]?.label || img.dataset.activity} removed from ${zone.dataset.label || formatSlotLabel(zone.dataset.hour)}.`);
                }
                
                saveActivities();
                makeDropZoneIconsDraggable();
                updateDropZoneMetadata();
            };
            
            // Mouse drag handlers
            img.dragStartHandler = (e) => {
                // Prevent dragging if not in edit mode
                if (!editingPeriod) {
                    e.preventDefault();
                    return;
                }
                
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', img.dataset.activity);
                e.dataTransfer.setData('source', 'clock');
                zone.classList.add('dragging');
                
                const dragImage = new Image();
                dragImage.src = img.src;
                e.dataTransfer.setDragImage(dragImage, 20, 20);
            };
            
            img.dragEndHandler = (e) => {
                if (!editingPeriod) {
                    e.preventDefault();
                    return;
                }
                
                e.stopPropagation();
                zone.classList.remove('dragging');
                
                const allDropZones = document.querySelectorAll('.drop-zone');
                let droppedInValidZone = false;
                
                allDropZones.forEach(dropZone => {
                    const rect = dropZone.getBoundingClientRect();
                    if (e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        droppedInValidZone = true;
                    }
                });
                
                if (!droppedInValidZone) {
                    if (zone.contains(img)) {
                        zone.removeChild(img);
                    }
                    saveActivities();
                    updateDropZoneMetadata();
                    showToast(`${activities[img.dataset.activity]?.label || img.dataset.activity} removed from ${zone.dataset.label || formatSlotLabel(zone.dataset.hour)}.`);
                }
            };
            
            // Add mouse and touch listeners
            img.addEventListener('dragstart', img.dragStartHandler);
            img.addEventListener('dragend', img.dragEndHandler);
            img.addEventListener('touchstart', img.touchStartHandler);
            img.addEventListener('touchmove', img.touchMoveHandler);
            img.addEventListener('touchend', img.touchEndHandler);
        }
    });
}

// Save and load activities
function saveActivities() {
    const storedActivities = readClockActivities();
    const scheduleType = getActiveScheduleType();
    const updatedPeriods = { am: {}, pm: {} };

    document.querySelectorAll('.drop-zone').forEach(zone => {
        const marker = zone.closest('.marker');
        if (!marker) return;
        
        const hour = marker.dataset.hour;
        const img = zone.querySelector('img');
        if (img) {
            // Save to the editing period if set, otherwise use current period
            const savePeriod = editingPeriod || currentPeriod;
            updatedPeriods[savePeriod][hour] = img.dataset.activity;
        }
    });

    storedActivities[scheduleType].am = updatedPeriods.am;
    storedActivities[scheduleType].pm = updatedPeriods.pm;
    writeClockActivities(storedActivities);
}

function loadActivities() {
    const savedActivities = readClockActivities();
    const scheduleType = getActiveScheduleType();
    // Load activities for the editing period if set, otherwise use current period
    const periodActivities = savedActivities[scheduleType][editingPeriod || currentPeriod] || {};
    
    // Clear all drop zones first
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.innerHTML = '';
    });
    
    // Load activities for current period
    Object.entries(periodActivities).forEach(([hour, activity]) => {
        const marker = document.querySelector(`.marker[data-hour="${hour}"]`);
        if (!marker) return;
        
        const dropZone = marker.querySelector('.drop-zone');
        if (!dropZone) return;
        
        const img = document.createElement('img');
        applyActivityToImage(img, activity);
        img.draggable = true;
        dropZone.appendChild(img);
    });
    
    initProgressRings();
    makeDropZoneIconsDraggable();
    updateDropZoneMetadata();
    updateHourProgress(new Date());
    updateScheduleUI();
    updateGuidanceUI();
}

function clearScheduledClockLayout() {
    markerLayoutTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    markerLayoutTimeouts = [];

    if (markerLayoutFrame !== null) {
        cancelAnimationFrame(markerLayoutFrame);
        markerLayoutFrame = null;
    }
}

function scheduleClockLayout() {
    clearScheduledClockLayout();

    const delays = [0, 120, 300];
    delays.forEach(delay => {
        const timeoutId = setTimeout(() => {
            markerLayoutFrame = requestAnimationFrame(() => {
                positionClockMarkers();
            });
        }, delay);

        markerLayoutTimeouts.push(timeoutId);
    });
}

// Position clock markers
function positionClockMarkers() {
    const markers = document.querySelectorAll('.marker');
    const clockContainer = document.querySelector('.clock-container');
    const clockFace = document.querySelector('.clock-face');

    if (!clockContainer || markers.length === 0) return;

    const containerWidth = clockContainer.offsetWidth;
    const containerHeight = clockContainer.offsetHeight;
    const sampleMarker = markers[0];
    const sampleDropZone = sampleMarker ? sampleMarker.querySelector('.drop-zone') : null;
    const markerSize = sampleDropZone
        ? sampleDropZone.offsetWidth || 54
        : sampleMarker
            ? sampleMarker.offsetWidth || 54
            : 54;

    // Keep markers inside the clock edge across viewport changes.
    const edgeDistance = Math.max(18, Math.min(containerWidth, containerHeight) * 0.05);
    const outerRadius = Math.min(containerWidth, containerHeight) / 2 - edgeDistance - markerSize / 2;
    const innerFaceRadius = clockFace
        ? Math.min(clockFace.offsetWidth, clockFace.offsetHeight) / 2
        : Math.min(containerWidth, containerHeight) * 0.33;
    const innerRadiusPadding = Math.max(10, markerSize * 0.18);
    const halfHourRadius = Math.max(markerSize / 2, innerFaceRadius - markerSize / 2 - innerRadiusPadding);

    markers.forEach(marker => {
        const hour = parseFloat(marker.dataset.hour);
        const angle = ((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2;
        const markerRadius = marker.classList.contains('marker-half')
            ? halfHourRadius
            : outerRadius;
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;
        const x = centerX + markerRadius * Math.cos(angle);
        const y = centerY + markerRadius * Math.sin(angle);

        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
    });
}

// Drag and Drop Functionality
function initDragAndDrop() {
    const iconBtns = document.querySelectorAll('.icon-btn');
    const dropZones = document.querySelectorAll('.drop-zone');
    
    // Enable drag on toolbar icons
    iconBtns.forEach(btn => {
        btn.draggable = true;

        btn.addEventListener('click', () => {
            if (!isEditing()) return;
            setSelectedActivity(btn.dataset.activity);
        });
        
        // Mouse drag handlers
        btn.addEventListener('dragstart', (e) => {
            if (!isEditing()) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.effectAllowed = 'move';
            const activity = btn.dataset.activity;
            e.dataTransfer.setData('text/plain', activity);
            e.dataTransfer.setData('source', 'toolbar');
            btn.classList.add('dragging');
            
            const dragImage = new Image();
            dragImage.src = getActivityAsset(activity);
            e.dataTransfer.setDragImage(dragImage, 20, 20);
        });
        
        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
        });
        
        // Touch handlers for toolbar icons
        let touchStartX = 0;
        let touchStartY = 0;
        let draggingTouch = false;
        let pendingTouch = false;
        let touchScrolling = false;
        let draggedImg = null;
        
        btn.addEventListener('touchstart', (e) => {
            if (!isEditing()) {
                return;
            }
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            pendingTouch = true;
            draggingTouch = false;
            touchScrolling = false;
        });
        
        btn.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];

            if (pendingTouch && !draggingTouch) {
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (absX < 8 && absY < 8) {
                    return;
                }

                if (absX > absY) {
                    touchScrolling = true;
                    pendingTouch = false;
                    return;
                }

                draggingTouch = true;
                pendingTouch = false;

                const img = btn.querySelector('img');
                draggedImg = img.cloneNode(true);
                draggedImg.style.position = 'fixed';
                draggedImg.style.opacity = '0.6';
                draggedImg.style.pointerEvents = 'none';
                document.body.appendChild(draggedImg);

                btn.classList.add('dragging');
            }

            if (!draggingTouch) return;

            e.preventDefault();

            if (draggedImg) {
                draggedImg.style.left = (touch.clientX - 25) + 'px';
                draggedImg.style.top = (touch.clientY - 25) + 'px';
            }
            
            // Check if over any drop zone
            dropZones.forEach(zone => {
                const rect = zone.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    zone.classList.add('drag-over');
                } else {
                    zone.classList.remove('drag-over');
                }
            });
        });
        
        btn.addEventListener('touchend', (e) => {
            if (!isEditing()) {
                return;
            }

            if (touchScrolling) {
                touchScrolling = false;
                pendingTouch = false;
                return;
            }

            if (!draggingTouch) {
                pendingTouch = false;
                return;
            }

            e.preventDefault();
            draggingTouch = false;
            pendingTouch = false;
            btn.classList.remove('dragging');
            
            if (draggedImg) {
                document.body.removeChild(draggedImg);
                draggedImg = null;
            }
            
            const touch = e.changedTouches[0];
            
            // Check if dropped in any drop zone
            dropZones.forEach(zone => {
                zone.classList.remove('drag-over');
                const rect = zone.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    placeActivityInZone(zone, btn.dataset.activity, 'toolbar');
                }
            });
        });
    });
    
    // Handle drop zones
    dropZones.forEach(zone => {
        zone.addEventListener('click', () => {
            if (!isEditing() || !selectedActivity) return;
            placeActivityInZone(zone, selectedActivity, 'selection');
        });

        zone.addEventListener('keydown', (e) => {
            if (!isEditing()) return;

            if ((e.key === 'Enter' || e.key === ' ') && selectedActivity) {
                e.preventDefault();
                placeActivityInZone(zone, selectedActivity, 'selection');
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                clearZoneActivity(zone);
            }
        });

        zone.addEventListener('dragenter', (e) => {
            if (!isEditing()) return;
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragover', (e) => {
            if (!isEditing()) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', (e) => {
            if (!isEditing()) return;
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const activity = e.dataTransfer.getData('text/plain');
            const source = e.dataTransfer.getData('source');
            
            if (!activity) return;

            placeActivityInZone(zone, activity, source === 'clock' ? 'move' : 'toolbar');
        });
    });
    
    // Make existing icons draggable
    makeDropZoneIconsDraggable();
    
    // Handle document-level drag and drop
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        const source = e.dataTransfer.getData('source');
        if (source === 'clock') {
            e.dataTransfer.dropEffect = 'move';
        }
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });
}

function initPeriodSwitch() {
    const periodBtns = document.querySelectorAll('.period-btn');
    
    // Set initial display period based on current time
    const now = new Date();
    const hours = now.getHours();
    currentPeriod = hours >= 12 ? 'pm' : 'am';
    updatePeriodUI();

    // Add click handlers for period buttons
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const period = btn.dataset.period;
            currentPeriod = period;

            if (isEditing()) {
                editingPeriod = period;
            }

            updatePeriodUI();
            loadActivities();
        });
    });
}

function initEditMode() {
    const editToggleBtn = document.getElementById('editToggleBtn');
    if (!editToggleBtn) return;

    editToggleBtn.addEventListener('click', () => {
        if (isEditing()) {
            editingPeriod = null;
            selectedActivity = null;
            resetViewToCurrentTime();
            setPlannerPanelOpen(false);
            showToast('Planning mode closed.');
        } else {
            editingPeriod = currentPeriod;
            setPlannerPanelOpen(true);
            showToast(`Planning mode opened for ${getActiveScheduleLabel()} ${getActivePeriodLabel()}.`);
        }

        updatePeriodUI();
        loadActivities();
    });
}

function initScheduleSwitch() {
    const scheduleButtons = document.querySelectorAll('.schedule-btn');
    scheduleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            scheduleTypeOverride = btn.dataset.schedule;
            updateScheduleUI();
            loadActivities();
        });
    });
}

function updateScheduleUI() {
    const activeScheduleType = getActiveScheduleType();
    document.querySelectorAll('.schedule-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.schedule === activeScheduleType);
    });
    document.body.dataset.scheduleType = activeScheduleType;
    updateGuidanceUI();
}

function updatePeriodUI() {
    const periodBtns = document.querySelectorAll('.period-btn');
    
    // Update active state based on current display period
    periodBtns.forEach(btn => {
        const period = btn.dataset.period;
        btn.classList.toggle('active', period === currentPeriod);
        btn.setAttribute('aria-pressed', String(period === currentPeriod));
    });
    
    // Update body attributes for styling
    document.body.dataset.period = currentPeriod;
    document.body.dataset.editing = isEditing() ? 'true' : 'false';
    updateScheduleUI();
    updateGuidanceUI();
}

function checkAndUpdatePeriod() {
    const now = new Date();
    const hours = now.getHours();
    const newPeriod = hours >= 12 ? 'pm' : 'am';
    
    // Only update if we're not in editing mode
    if (newPeriod !== currentPeriod && !editingPeriod) {
        currentPeriod = newPeriod;
        updatePeriodUI();
        loadActivities();
    }

    if (!scheduleTypeOverride) {
        updateScheduleUI();
    }
}

// Start when page loads
window.addEventListener('load', () => {
    initScheduleSwitch();
    init();
});
