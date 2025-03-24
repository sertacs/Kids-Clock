// Activity Icon Management
let currentPeriod = 'am'; // Current display period
let editingPeriod = null; // Period being edited

const activities = {
    sleep: {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33z"/></svg>',
        label: 'sleep'
    },
    eat: {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 3V11H3V13H11V21H13V13H21V11H13V3H11Z"/></svg>',
        label: 'eat'
    },
    brush: {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.71 5.29l-1-1a1 1 0 0 0-1.42 0l-7 7a1 1 0 0 0 1.42 1.42l7-7a1 1 0 0 0 0-1.42zM3 18h18v2H3z"/></svg>',
        label: 'brush teeth'
    },
    play: {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        label: 'play'
    },
    school: {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>',
        label: 'school'
    }
};

let selectedActivity = null;
let draggedActivity = null;
let ghostIcon = null;

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
    positionClockMarkers();
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
    
    // Reposition markers on window resize
    window.addEventListener('resize', positionClockMarkers);
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
                                existingImg.src = `images/${activity}.png`;
                                existingImg.alt = activity;
                                existingImg.dataset.activity = activity;
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
        img.src = `images/${activity}.png`;
        img.alt = activity;
        img.dataset.activity = activity;
        img.draggable = true;
        dropZone.appendChild(img);
    });
    
    makeDropZoneIconsDraggable();
}

// Position clock markers
function positionClockMarkers() {
    const markers = document.querySelectorAll('.marker');
    const clockContainer = document.querySelector('.clock-container');
    
    // Wait for the clock container to be rendered with its final size
    setTimeout(() => {
        if (!clockContainer) return;
        
        // Get the actual size of the clock container
        const containerWidth = clockContainer.offsetWidth;
        const containerHeight = clockContainer.offsetHeight;
        
        // Calculate the radius to position markers exactly 32px from the edge
        // Subtract marker size (60px) / 2 to account for the marker's center point
        const edgeDistance = 32;
        const markerRadius = Math.min(containerWidth, containerHeight) / 2 - edgeDistance - 30;
        
        markers.forEach(marker => {
            const hour = parseInt(marker.dataset.hour);
            // Adjust angle calculation to start from 12 o'clock
            const angle = ((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2;
            
            // Calculate position in pixels from the center
            const centerX = containerWidth / 2;
            const centerY = containerHeight / 2;
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            
            // Position marker absolutely in pixels instead of percentages
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
        });
    }, 0);
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
            dragImage.src = `images/${activity}.png`;
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
                            existingImg.src = `images/${activity}.png`;
                            existingImg.alt = activity;
                            existingImg.dataset.activity = activity;
                        }
                    } else {
                        const img = document.createElement('img');
                        img.src = `images/${activity}.png`;
                        img.alt = activity;
                        img.dataset.activity = activity;
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
                    existingImg.src = `images/${activity}.png`;
                    existingImg.alt = activity;
                    existingImg.dataset.activity = activity;
                }
            } else {
                const img = document.createElement('img');
                img.src = `images/${activity}.png`;
                img.alt = activity;
                img.dataset.activity = activity;
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