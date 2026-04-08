// Activity Icon Management
let currentPeriod = 'am'; // Current display period
let editingPeriod = null; // Period being edited

const activities = {
    sleep: {
        label: 'sleep',
        src: 'images/sleep.png'
    },
    eat: {
        label: 'meal',
        src: 'images/eat.png'
    },
    brush: {
        label: 'brush',
        src: 'images/brush.png'
    },
    play: {
        label: 'play',
        src: 'images/play.png'
    },
    cartoon: {
        label: 'cartoon',
        src: 'images/cartoon.png'
    },
    sport: {
        label: 'sport',
        src: 'images/sport.png'
    },
    homework: {
        label: 'homework',
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

function getActivityAsset(activity) {
    return activities[activity]?.src || '';
}

function applyActivityToImage(img, activity) {
    const asset = getActivityAsset(activity);
    if (!asset) return;

    img.src = asset;
    img.alt = activities[activity]?.label || activity;
    img.dataset.activity = activity;
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
                            // Move image to new drop zone
                            const activity = img.dataset.activity;
                            const existingImg = dropZone.querySelector('img');
                            if (existingImg) {
                                applyActivityToImage(existingImg, activity);
                                zone.removeChild(img);
                            } else {
                                dropZone.appendChild(img);
                            }
                        }
                    }
                });
                
                // Remove if not dropped in a valid zone
                if (!droppedInValidZone) {
                    zone.removeChild(img);
                }
                
                saveActivities();
                makeDropZoneIconsDraggable();
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
                    zone.removeChild(img);
                    saveActivities();
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
    const activities = {};
    document.querySelectorAll('.drop-zone').forEach(zone => {
        const marker = zone.closest('.marker');
        if (!marker) return;
        
        const hour = marker.dataset.hour;
        const img = zone.querySelector('img');
        if (img) {
            // Save to the editing period if set, otherwise use current period
            const savePeriod = editingPeriod || currentPeriod;
            if (!activities[savePeriod]) {
                activities[savePeriod] = {};
            }
            activities[savePeriod][hour] = img.dataset.activity;
        }
    });
    
    // Merge with existing activities from other period
    const existingActivities = JSON.parse(localStorage.getItem('clockActivities') || '{}');
    const otherPeriod = (editingPeriod || currentPeriod) === 'am' ? 'pm' : 'am';
    if (existingActivities[otherPeriod]) {
        activities[otherPeriod] = existingActivities[otherPeriod];
    }
    
    localStorage.setItem('clockActivities', JSON.stringify(activities));
}

function loadActivities() {
    const savedActivities = JSON.parse(localStorage.getItem('clockActivities') || '{}');
    // Load activities for the editing period if set, otherwise use current period
    const periodActivities = savedActivities[editingPeriod || currentPeriod] || {};
    
    // Clear all drop zones first
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.innerHTML = '';
    });
    
    // Load activities for current period
    Object.entries(periodActivities).forEach(([hour, activity]) => {
        const marker = document.querySelector(`.marker-${hour}`);
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
    updateHourProgress(new Date());
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

    if (!clockContainer || markers.length === 0) return;

    const containerWidth = clockContainer.offsetWidth;
    const containerHeight = clockContainer.offsetHeight;
    const sampleMarker = markers[0];
    const markerSize = sampleMarker ? sampleMarker.offsetWidth || 60 : 60;

    // Keep markers inside the clock edge across viewport changes.
    const edgeDistance = Math.max(18, Math.min(containerWidth, containerHeight) * 0.05);
    const markerRadius = Math.min(containerWidth, containerHeight) / 2 - edgeDistance - markerSize / 2;

    markers.forEach(marker => {
        const hour = parseInt(marker.dataset.hour, 10);
        const angle = ((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2;
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
    const clockContainer = document.querySelector('.clock-container');
    
    // Enable drag on toolbar icons
    iconBtns.forEach(btn => {
        btn.draggable = true;
        
        // Mouse drag handlers
        btn.addEventListener('dragstart', (e) => {
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
        let draggedImg = null;
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            draggingTouch = true;
            
            // Create ghost image
            const img = btn.querySelector('img');
            draggedImg = img.cloneNode(true);
            draggedImg.style.position = 'fixed';
            draggedImg.style.opacity = '0.6';
            draggedImg.style.pointerEvents = 'none';
            document.body.appendChild(draggedImg);
            
            btn.classList.add('dragging');
        });
        
        btn.addEventListener('touchmove', (e) => {
            if (!draggingTouch) return;
            e.preventDefault();
            
            const touch = e.touches[0];
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
            e.preventDefault();
            draggingTouch = false;
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
                    const activity = btn.dataset.activity;
                    const existingImg = zone.querySelector('img');
                    if (existingImg) {
                        if (existingImg.dataset.activity === activity) {
                            zone.removeChild(existingImg);
                        } else {
                            applyActivityToImage(existingImg, activity);
                        }
                    } else {
                        const img = document.createElement('img');
                        applyActivityToImage(img, activity);
                        zone.appendChild(img);
                    }
                    saveActivities();
                    makeDropZoneIconsDraggable();
                }
            });
        });
    });
    
    // Handle drop zones
    dropZones.forEach(zone => {
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const activity = e.dataTransfer.getData('text/plain');
            const source = e.dataTransfer.getData('source');
            
            if (!activity) return;
            
            const existingImg = zone.querySelector('img');
            if (existingImg) {
                if (existingImg.dataset.activity === activity && source === 'toolbar') {
                    zone.removeChild(existingImg);
                } else {
                    applyActivityToImage(existingImg, activity);
                }
            } else {
                const img = document.createElement('img');
                applyActivityToImage(img, activity);
                zone.appendChild(img);
            }
            
            saveActivities();
            makeDropZoneIconsDraggable();
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
            
            // Toggle editing mode directly without password
            if (editingPeriod === period) {
                editingPeriod = null;
            } else {
                editingPeriod = period;
            }
            
            // Update UI
            updatePeriodUI();
            loadActivities();
        });
    });
}

function updatePeriodUI() {
    const periodBtns = document.querySelectorAll('.period-btn');
    
    // Update active state based on current display period
    periodBtns.forEach(btn => {
        const period = btn.dataset.period;
        btn.classList.toggle('active', period === currentPeriod);
        
        // Update editing indicator
        btn.dataset.editing = (period === editingPeriod).toString();
    });
    
    // Update body attributes for styling
    document.body.dataset.period = currentPeriod;
    document.body.dataset.editing = editingPeriod !== null ? 'true' : 'false';
    
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
}

// Start when page loads
window.addEventListener('load', init);
