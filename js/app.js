import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const app = document.getElementById('app');
// ... (rest of imports)

// -- GUESTBOOK LOGIC (Firebase Real-Time) --

function initGuestbook() {
    console.log("Initializing Guestbook (Firebase Mode)...");

    // Listen for real-time updates
    const q = query(collection(db, "guestbook"), orderBy("timestamp", "desc"), limit(50));

    onSnapshot(q, (snapshot) => {
        const entries = [];
        snapshot.forEach((doc) => {
            entries.push({ id: doc.id, ...doc.data() });
        });
        renderGuestbook(entries);
    }, (error) => {
        console.error("Error getting guestbook updates:", error);
        // Fallback or alert? For now silent log.
    });
}

// State Management
function showGuestbookWriteMode() {
    document.getElementById('guestbook-state-read').classList.remove('active');
    document.getElementById('guestbook-state-read').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('guestbook-state-write').classList.remove('hidden');
        document.getElementById('guestbook-state-write').classList.add('active');
    }, 300); // Wait for fade out
}

function showGuestbookReadMode() {
    document.getElementById('guestbook-state-write').classList.remove('active');
    document.getElementById('guestbook-state-write').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('guestbook-state-read').classList.remove('hidden');
        document.getElementById('guestbook-state-read').classList.add('active');
    }, 300);
}

// Generate Dynamic QR Code (Fix for Netlify/Custom Domains)
function updateGuestbookQR() {
    const img = document.getElementById('guestbook-qr-img');
    if (!img) return;

    let baseUrl = window.location.href;
    if (baseUrl.includes('index.html')) {
        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('index.html'));
    }
    if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
    }

    const mobileUrl = baseUrl + 'guestbook_mobile.html';
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileUrl)}`;

    img.src = qrApi;
}

window.saveGuestbookEntry = async function () {
    const nameInput = document.getElementById('guest-name');
    const msgInput = document.getElementById('guest-message');
    const btn = document.querySelector('.btn-engrave');

    const name = nameInput.value.trim();
    const text = msgInput.value.trim();

    if (!name || !text) {
        alert("Un petit nom et un message, s'il vous plaît ! 😊");
        return;
    }

    // UI Feedback
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = 'Gravure en cours...';
    btn.style.opacity = '0.7';

    try {
        // Save to Cloud
        await addDoc(collection(db, "guestbook"), {
            name: name,
            text: text,
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            timestamp: Date.now()
        });

        // Clear Inputs
        nameInput.value = '';
        msgInput.value = '';

        // Reset Btn
        btn.innerHTML = originalBtnText;
        btn.style.opacity = '1';

        // Switch to Read Mode
        showGuestbookReadMode();

    } catch (e) {
        console.error("Error saving entry: ", e);
        alert("Oups, une erreur est survenue lors de la sauvegarde.");
        btn.innerHTML = originalBtnText;
        btn.style.opacity = '1';
    }
}

function renderGuestbook(entries) {
    const listContainer = document.getElementById('guestbook-entries');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Clear

    if (entries.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; width:100%; opacity:0.5; font-style:italic;">Soyez le premier à écrire !</div>';
        return;
    }

    entries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'guest-note-card';
        card.innerHTML = `
            <div class="note-date">${entry.date}</div>
            <p class="note-message">"${entry.text}"</p>
            <div class="note-author">- ${entry.name}</div>
        `;
        listContainer.appendChild(card);
    });
}

// Global Exports
window.showGuestbookWriteMode = showGuestbookWriteMode;
window.showGuestbookReadMode = showGuestbookReadMode;
// saveGuestbookEntry is already attached to window above

// Ensure init is called on load
const screensaver = document.getElementById('screensaver');

// -- Global Exports (for HTML onclicks) --
window.hideScreensaver = hideScreensaver;
window.startSlideshow = startSlideshow; // Debug

// Ensure critical listeners are attached after load
document.addEventListener('DOMContentLoaded', () => {
    initGuestbook();
    updateGuestbookQR();

    // Screensaver Dismissal (Critical)
    if (screensaver) {
        screensaver.addEventListener('click', hideScreensaver);
        screensaver.addEventListener('touchstart', hideScreensaver, { passive: true });
        console.log("Screensaver listeners attached.");
    } else {
        console.error("CRITICAL: Screensaver element not found for listeners.");
    }

    // iPad Optimization: Delay preload slightly
    setTimeout(() => {
        preloadScreensaverImages();
    }, 2000);
});

const screensaverPrompt = document.querySelector('.screensaver-prompt');
const slides = document.querySelectorAll('.slide');

// State
let idleTimer;
const IDLE_TIMEOUT = 180000; // 3 minutes in ms
let currentSlide = 0;
let slideInterval;

// -- Navigation Logic --

function openSection(sectionId) {
    // Hide ALL active views first (Clean slate)
    document.querySelectorAll('.view.active').forEach(view => {
        view.classList.remove('active');
    });

    // Show Target Section
    const targetSection = document.getElementById(sectionId.startsWith('view-') ? sectionId : `view-${sectionId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    } else {
        console.warn(`Section ${sectionId} not found, creating temp view...`);
        createTempSection(sectionId);
    }

    // Update Body Class for Global Nav
    if (sectionId === 'hub') {
        document.body.classList.add('on-hub');
    } else {
        document.body.classList.remove('on-hub');
    }
}

function goBack() {
    // Hide all active views
    document.querySelectorAll('.view.active').forEach(view => {
        view.classList.remove('active');
    });

    // Show Hub
    document.getElementById('view-hub').classList.add('active');
    document.body.classList.add('on-hub');
}

function createTempSection(id) {
    // For prototype phase, if a section is missing in HTML, alert or log
    alert(`Section "${id}" en construction!`);
    goBack();
}

// Initial State
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('on-hub');

    // iPad Optimization: Delay preload slightly to prioritize UI rendering
    setTimeout(() => {
        preloadScreensaverImages();
    }, 2000);
});

// Optimized Image Preloader for Kiosk Mode
function preloadScreensaverImages() {
    console.log('Starting background image preload...');
    if (typeof screensaverImages !== 'undefined' && Array.isArray(screensaverImages)) {
        screensaverImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
        console.log(`Preloading ${screensaverImages.length} screensaver images.`);
    }
}


// -- Screensaver Logic --

// New Screensaver Images (Local)
// New Screensaver Images (Local)
const screensaverImages = [
    // Top Priority (Story & Review)
    'assets/img/screensaver/slide_story_benjamin.png',
    'assets/img/screensaver/slide_review_ohana.png',

    // High Quality (HQ)
    'assets/img/screensaver/slide_hq_1.png',
    'assets/img/screensaver/slide_hq_3.png',
    'assets/img/screensaver/slide_hq_4.png',
    'assets/img/screensaver/slide_hq_5.png',
    'assets/img/screensaver/slide_hq_6.png',
    'assets/img/screensaver/slide_hq_7.png',
    'assets/img/screensaver/slide_hq_9.png',
    'assets/img/screensaver/slide_hq_10.png',
    'assets/img/screensaver/slide_hq_12.png',

    // Generated (AI)
    'assets/img/screensaver/slide_gen_1.png',
    'assets/img/screensaver/slide_gen_2.png',
    'assets/img/screensaver/slide_gen_4.png',
    'assets/img/screensaver/slide_gen_5.png',
    'assets/img/screensaver/slide_gen_6.png',
    'assets/img/screensaver/slide_gen_7.png',

    // Standard (Existing)
    'assets/img/screensaver/slide_8.png',
    'assets/img/screensaver/slide_13.png',
    'assets/img/screensaver/slide_17.png',
    'assets/img/screensaver/slide_18.png',
    'assets/img/screensaver/slide_19.png',
    'assets/img/screensaver/slide_20.png',
    'assets/img/screensaver/slide_21.png',
    'assets/img/screensaver/slide_22.png',
    'assets/img/screensaver/slide_23.png',
    'assets/img/screensaver/slide_24.png',
    'assets/img/screensaver/slide_26.png',
    'assets/img/screensaver/slide_27.png',
    'assets/img/screensaver/slide_28.png',
    'assets/img/screensaver/slide_29.png',
    'assets/img/screensaver/slide_30.png',
    'assets/img/screensaver/slide_31.png',
    'assets/img/screensaver/slide_32.png'
];

// Utility: Shuffle Array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function initScreensaverSlides() {
    const container = document.querySelector('.slideshow');
    container.innerHTML = ''; // Clear existing

    // SHUFFLE: Randomize order on every init (load/reload)
    shuffleArray(screensaverImages);

    screensaverImages.forEach((imgSrc, index) => {
        const slide = document.createElement('div');
        slide.classList.add('slide');
        if (index === 0) slide.classList.add('active');

        // Check if this is the Special "Review" Slide (Airbnb note)
        const isReviewSlide = imgSrc.includes('slide_review_ohana.png');

        if (isReviewSlide) {
            // -- SPECIAL LAYOUT: Blur Background + Sharp Image --
            const bgLayer = document.createElement('div');
            bgLayer.classList.add('slide-bg');
            bgLayer.style.backgroundImage = `url('${imgSrc}')`;
            slide.appendChild(bgLayer);

            const imgLayer = document.createElement('div');
            imgLayer.classList.add('slide-img');
            imgLayer.style.backgroundImage = `url('${imgSrc}')`;
            slide.appendChild(imgLayer);
        } else {
            // -- STANDARD PLAYOUT: Full Screen Cover --
            slide.style.backgroundImage = `url('${imgSrc}')`;
            slide.style.backgroundSize = 'cover';
            slide.style.backgroundPosition = 'center';
            slide.style.backgroundRepeat = 'no-repeat';
        }

        container.appendChild(slide);
    });

    // Reset state
    currentSlide = 0;
    slidesNodeList = document.querySelectorAll('.slideshow .slide');

    // RESTORE STATE: If we just reloaded while screensaver was on, show it immediately
    if (sessionStorage.getItem('wasScreensaver') === 'true') {
        showScreensaver();
        sessionStorage.removeItem('wasScreensaver');
    }
}

let slidesNodeList = []; // Will hold DOM elements

function resetIdleTimer() {
    clearTimeout(idleTimer);

    // If screensaver is active, hide it on first touch
    if (!screensaver.classList.contains('hidden')) {
        hideScreensaver();
    }

    idleTimer = setTimeout(showScreensaver, IDLE_TIMEOUT);
}

function showScreensaver() {
    screensaver.classList.remove('hidden');
    startSlideshow();
}

function hideScreensaver() {
    screensaver.classList.add('hidden');
    stopSlideshow();
    // Reset Navigation to Hub when waking up?
    goBack();
}

// Variable Slide Duration Logic
let slideTimeout;

function startSlideshow() {
    if (slideTimeout) clearTimeout(slideTimeout);

    // Start cycle 
    scheduleNextSlide();

    // Start clock 
    updateScreensaverClock();
    if (!clockInterval) clockInterval = setInterval(updateScreensaverClock, 1000);

    // Start Auto-Reload Timer (Check every 10 mins)
    if (!reloadTimer) reloadTimer = setInterval(checkAndReload, 600000); // 10 mins
}

let clockInterval;
let reloadTimer; // Smart Auto-Reload Reference

function checkAndReload() {
    // Only reload if screensaver is CURRENTLY active (safe time)
    if (!screensaver.classList.contains('hidden')) {
        console.log('Auto-Reloading for updates...');
        sessionStorage.setItem('wasScreensaver', 'true');
        location.reload();
    }
}

function stopSlideshow() {
    if (slideTimeout) clearTimeout(slideTimeout);
    if (clockInterval) clearInterval(clockInterval);
    if (reloadTimer) clearTimeout(reloadTimer); // Cancel auto-reload if user returns
    clockInterval = null;
    reloadTimer = null;
    slideTimeout = null;
}

function scheduleNextSlide() {
    if (!slidesNodeList.length) return;

    // Get current image source to determine duration
    const currentImg = screensaverImages[currentSlide];

    // DEFAULT DURATION: 3 Minutes
    let duration = 180000;

    // Custom Durations
    if (currentImg && currentImg.includes('slide_review_ohana.png')) {
        duration = 600000; // 10 minutes for the Note
    }

    slideTimeout = setTimeout(() => {
        nextSlide();
        scheduleNextSlide(); // Recursive call
    }, duration);
}

function nextSlide() {
    if (!slidesNodeList.length) return;

    slidesNodeList[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slidesNodeList.length;
    slidesNodeList[currentSlide].classList.add('active');

    // Update Mantra occasionally
    updateMantra();
}

// -- Screensaver Clock --
function updateScreensaverClock() {
    const timeEl = document.getElementById('ss-time');
    const dateEl = document.getElementById('ss-date');
    if (!timeEl || !dateEl) return;

    const now = new Date();

    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;

    // Date (French)
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = now.toLocaleDateString('fr-FR', options);
    dateEl.textContent = dateStr;
}

// -- Mantras Logic --
const mantras = [
    "Ici et maintenant.",
    "Respirez. Vous êtes chez vous.",
    "Prenez le temps de ne rien faire.",
    "La simplicité est la sophistication suprême.",
    "Ohana signifie famille.",
    "Écoutez le silence.",
    "Savourez l'instant.",
    "Douceur de vivre.",
    "", // Empty chance
    "", // Empty chance
    ""  // Empty chance
];

function updateMantra() {
    const mantraEl = document.getElementById('ss-mantra');
    const container = document.querySelector('.screensaver-mantra-container');
    if (!mantraEl || !container) return;

    // Check if current slide should hide Mantra (Story or Review)
    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide) {
        const style = window.getComputedStyle(activeSlide);
        const bg = activeSlide.style.backgroundImage || '';
        if (bg.includes('slide_story_benjamin.png') || bg.includes('slide_review_ohana.png')) {
            container.style.opacity = '0';
            return;
        }
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * mantras.length);
    const text = mantras[randomIndex];

    // Smooth Transition: Fade Out -> Change -> Fade In
    container.style.opacity = '0';

    setTimeout(() => {
        if (text) {
            mantraEl.textContent = text;
            container.style.display = 'block';
            // Small delay to allow display:block to apply before fading in
            setTimeout(() => {
                container.style.opacity = '1';
            }, 50);
        } else {
            // Keep hidden if no text
            container.style.display = 'none';
        }
    }, 1000); // Wait for fade out to finish (CSS transition is 1s)
}


// -- Event Listeners --

// Detect any interaction to reset timer
const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
events.forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
});

// Initialize
initScreensaverSlides(); // Preload/Create slides
resetIdleTimer(); // Start the timer
// Ensure Hub is active
document.getElementById('view-hub').classList.add('active');

// -- Hero Slideshow Logic --
const heroImages = [
    // HQ 
    'assets/img/hero/hero_hq_1.png',
    'assets/img/hero/hero_hq_3.png',
    'assets/img/hero/hero_hq_4.png',
    'assets/img/hero/hero_hq_5.png',
    'assets/img/hero/hero_hq_6.png',
    'assets/img/hero/hero_hq_7.png',
    'assets/img/hero/hero_hq_8.png',
    'assets/img/hero/hero_hq_9.png',
    'assets/img/hero/hero_hq_10.png',
    'assets/img/hero/hero_hq_11.png',
    'assets/img/hero/hero_hq_12.png',

    // Standard
    'assets/img/hero/hero_6.png',
    'assets/img/hero/hero_7.png',
    'assets/img/hero/hero_8.jpg',
    'assets/img/hero/hero_3.jpg',
    'assets/img/hero/hero_4.jpg',
    'assets/img/hero/hero_5.jpg'
];

let heroIndex = 0;
const heroImgElement = document.querySelector('.hero-bg');

// Rotate every 60 seconds (60000 ms)
function rotateHeroImage() {
    if (!heroImgElement) return;

    // Determine next index
    const nextIndex = (heroIndex + 1) % heroImages.length;
    const nextSrc = heroImages[nextIndex];

    // Preload image
    const imgLoader = new Image();
    imgLoader.src = nextSrc;

    imgLoader.onload = () => {
        // Only start transition once loaded
        heroImgElement.style.opacity = '0';

        setTimeout(() => {
            heroImgElement.src = nextSrc;
            heroIndex = nextIndex;

            // Short delay to ensure DOM update before fading back in
            requestAnimationFrame(() => {
                heroImgElement.style.opacity = '0.85';
            });
        }, 1000); // Wait for fade out
    };

    imgLoader.onerror = () => {
        console.error("Failed to load hero image:", nextSrc);
        // Skip this image and try next one immediately (or soon)
        heroIndex = nextIndex; // Advance index anyway to avoid loop
    };
}

// Initial call schedule
setInterval(rotateHeroImage, 60000);

// Expose functions to global scope for HTML onclicks
window.openSection = openSection;
window.goBack = goBack;

// -- Departure Grid Logic --
function toggleTask(cardElement) {
    if (!cardElement) return;

    // Toggle completed state
    cardElement.classList.toggle('completed');

    // Optional: Add haptic feedback or sound effect here if requested later

    // Auto-check logic: if all regular steps are done, highlight final step? (Optional enhancement)
}

function goToChecklist() {
    // Open the Rules section
    openSection('regles');

    // Scroll to the anchor
    // Use setTimeout to ensure the view transition has started/DOM is ready
    setTimeout(() => {
        const anchor = document.getElementById('checklist-anchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Optional: Flash the title to draw attention
            anchor.style.transition = 'color 0.5s ease';
            const originalColor = anchor.style.color;
            anchor.style.color = 'var(--color-accent-terracotta)'; // Ensure it's highlighted
        }
    }, 300); // 300ms matches specific CSS transition slightly
}

// -- Accordion Logic --
function toggleAccordion(header) {
    const item = header.parentElement;
    const isActive = item.classList.contains('open');

    // Close all other accordions (Optional: exclusive mode)
    // const allItems = document.querySelectorAll('.accordion-item');
    // allItems.forEach(i => i.classList.remove('open'));

    // Toggle current
    if (!isActive) {
        // Close others first if we want exclusive (let's do exclusive for cleaner UI)
        const allItems = header.closest('.accordion-container').querySelectorAll('.accordion-item');
        allItems.forEach(i => i.classList.remove('open'));

        item.classList.add('open');
    } else {
        item.classList.remove('open');
    }
}
window.toggleAccordion = toggleAccordion;


window.toggleTask = toggleTask;
window.goToChecklist = goToChecklist;

// -- Weather & Time Widget Logic --
function updateTime() {
    const timeElement = document.getElementById('current-time');
    if (!timeElement) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}`;
}

function getWeatherIcon(code, isDay = 1) {
    // isDay: 1 = Day, 0 = Night

    // Clear/Partly Cloudy handling for Night
    if (isDay === 0) {
        if (code === 0) return '🌙'; // Clear Night
        if ([1, 2, 3].includes(code)) return '☁️'; // Cloudy Night (simplified to cloud, or could be Moon+Cloud if emoji exists)
    }

    if (code === 0) return '☀️'; // Clear
    if ([1, 2, 3].includes(code)) return '⛅'; // Cloudy/Partly
    if ([45, 48].includes(code)) return '🌫️'; // Fog
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'; // Rain
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'; // Snow
    if ([95, 96, 99].includes(code)) return '⛈️'; // Thunder
    return '🌡️'; // Unknown
}

async function fetchWeather() {
    try {
        const lat = 49.35;
        const lon = 6.16;

        // Added: wind_speed_10m, relative_humidity_2m, is_day
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&current=is_day,relative_humidity_2m,wind_speed_10m`);
        const data = await response.json();

        // Open-Meteo structure changes slightly when adding &current=
        // It provides 'current' object with everything, or 'current_weather' legacy
        // Let's check 'current' first
        const current = data.current || data.current_weather;

        if (current) {
            const temp = Math.round(current.temperature || current.temperature_2m);
            const code = current.weathercode;
            const isDay = current.is_day !== undefined ? current.is_day : 1;
            const wind = Math.round(current.wind_speed_10m || (data.current_weather ? data.current_weather.windspeed : 0));
            const humidity = current.relative_humidity_2m || '--'; // Available in 'current' object

            // Update DOM
            const tempEl = document.getElementById('weather-temp');
            const iconEl = document.getElementById('weather-icon');
            const windEl = document.getElementById('weather-wind');
            const humEl = document.getElementById('weather-humidity');

            if (tempEl) tempEl.textContent = `${temp}°`;
            if (iconEl) iconEl.textContent = getWeatherIcon(code, isDay);
            if (windEl) windEl.textContent = `${wind} km/h`;
            if (humEl) humEl.textContent = `${humidity}%`;
        }
    } catch (error) {
        console.error('Weather fetch failed:', error);
    }
}

// Widget Interaction
const weatherWidget = document.querySelector('.weather-widget');
if (weatherWidget) {
    weatherWidget.addEventListener('click', (e) => {
        weatherWidget.classList.toggle('expanded');
        e.stopPropagation(); // Prevent bubbling if needed
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!weatherWidget.contains(e.target) && weatherWidget.classList.contains('expanded')) {
            weatherWidget.classList.remove('expanded');
        }
    });
}

// Init Widget
updateTime();
fetchWeather();

// Updates
setInterval(updateTime, 60000); // Every minute
setInterval(fetchWeather, 1800000); // Every 30 mins
// -- Discover Section Logic (Refactored) --

const discoverData = {
    'regaler': {
        title: 'Se Régaler',
        img: 'assets/img/adresses/regaler_main.png', // New Generated Image
        places: [
            {
                name: 'La Kaza',
                type: 'Restaurant',
                review: 'Une ambiance incroyable et des plats raffinés.',
                img: 'assets/img/hero/hero_6.png'
            },
            {
                name: 'Le Ptit Déj',
                type: 'Brunch',
                review: 'Les meilleurs pancakes de la ville, sans hésitation.',
                img: 'assets/img/hero/hero_2.jpg'
            },
            {
                name: 'Sushi Zen',
                type: 'Japonais',
                review: 'Frais, rapide et délicieux.',
                img: 'assets/img/hero/hero_5.jpg'
            }
        ]
    },
    'respirer': {
        title: 'Respirer',
        img: 'assets/img/adresses/respirer_main.jpg',
        places: [
            {
                name: 'Parc Napoléon',
                type: 'Nature',
                review: 'Idéal pour un jogging matinal au calme.',
                img: 'assets/img/hero/hero_3.jpg'
            },
            {
                name: 'Bords de Moselle',
                type: 'Promenade',
                review: 'Un coucher de soleil magnifique sur l\'eau.',
                img: 'assets/img/hero/hero_8.jpg'
            }
        ]
    },
    'explorer': {
        title: 'Explorer',
        img: 'assets/img/adresses/explorer_main.jpg',
        places: [
            {
                name: 'Château de Malbrouck',
                type: 'Culture',
                review: 'Une plongée fascinante dans l\'histoire.',
                img: 'assets/img/hero/hero_4.jpg'
            }
        ]
    },
    'indispensables': {
        title: 'Indispensables',
        img: 'assets/img/hero/hero_7.png',
        places: [
            {
                name: 'Pharmacie du Centre',
                type: 'Santé',
                review: 'Ouverte 24/7, très pratique en cas de pépin.',
                img: 'assets/img/hero/hero_7.png'
            },
            {
                name: 'Supermarché Match',
                type: 'Courses',
                review: 'Tout ce qu\'il faut à 5 minutes à pied.',
                img: 'assets/img/hero/hero_9.jpg'
            }
        ]
    }
};

function renderDiscoverMenu() {
    const container = document.querySelector('.discover-categories-grid');
    if (!container || container.children.length > 0) return; // Prevent re-render

    Object.keys(discoverData).forEach(key => {
        const cat = discoverData[key];
        const tile = document.createElement('div');
        tile.className = 'category-tile';
        tile.onclick = () => openDiscoverCategory(key);
        tile.innerHTML = `
            <img src="${cat.img}" alt="${cat.title}">
            <div class="category-overlay">
                <h3>${cat.title}</h3>
            </div>
        `;
        container.appendChild(tile);
    });
}

function openDiscoverCategory(catKey) {
    const cat = discoverData[catKey];
    if (!cat) return;

    // Populate Details
    document.getElementById('discover-cat-title').textContent = cat.title;
    const listContainer = document.getElementById('discover-list');
    listContainer.innerHTML = ''; // Clear

    // Update Left Image Animation
    const heroImg = document.getElementById('discover-hero-img');
    heroImg.style.opacity = '0';
    setTimeout(() => {
        heroImg.src = cat.img;
        heroImg.style.opacity = '1';
    }, 300);


    // Render Cards
    cat.places.forEach(place => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
            <div class="place-card-img-wrapper">
                <img src="${place.img}" class="place-card-img" alt="${place.name}">
            </div>
            <div class="place-card-content">
                <div class="place-type">${place.type}</div>
                <div class="place-title">${place.name}</div>
                <div class="place-review">"${place.review}"</div>
                
                <div class="place-qr-zone">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Maps:${place.name}" class="place-qr-placeholder" alt="QR">
                    <div class="place-qr-text">Scanner pour<br><strong>L'Itinéraire</strong></div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });

    // Switch Views
    document.getElementById('discover-menu').classList.remove('active');
    document.getElementById('discover-menu').classList.add('hidden');

    document.getElementById('discover-details').classList.remove('hidden');
    document.getElementById('discover-details').classList.add('active');
}

function closeDiscoverCategory() {
    // Switch Views Back
    document.getElementById('discover-details').classList.remove('active');
    document.getElementById('discover-details').classList.add('hidden');

    document.getElementById('discover-menu').classList.remove('hidden');
    document.getElementById('discover-menu').classList.add('active');

    // Reset Hero Image to default (Optional)
    // const heroImg = document.getElementById('discover-hero-img');
    // heroImg.src = 'assets/img/hero/hero_1.jpg';
}

// Init when App loads
renderDiscoverMenu();

// -- Auto-Reload Logic --
const RELOAD_INTERVAL = 300000; // 5 minutes

function scheduleAutoReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
        // Only reload if screensaver is active (don't interrupt user)
        if (!screensaver.classList.contains('hidden')) {
            performSmartReload();
        } else {
            // If user is active, wait another minute and check again?
            // Or just rely on the idle timer to trigger screensaver first
            scheduleAutoReload();
        }
    }, RELOAD_INTERVAL);
}

function performSmartReload() {
    // Save state so we know to show screensaver immediately after reload
    sessionStorage.setItem('restore_screensaver', 'true');
    window.location.reload(true);
}

// Check for restore state on load
window.addEventListener('load', () => {
    if (sessionStorage.getItem('restore_screensaver') === 'true') {
        sessionStorage.removeItem('restore_screensaver');
        // Show screensaver immediately without animation if possible
        screensaver.classList.remove('hidden');
        screensaver.style.transition = 'none'; // Disable fade for instant switch
        screensaver.style.opacity = '1';

        startSlideshow();

        // Restore transition after a moment
        setTimeout(() => {
            screensaver.style.transition = '';
        }, 100);
    }
});



// -- Global exports for HTML onclicks
window.openDiscoverCategory = openDiscoverCategory;
window.closeDiscoverCategory = closeDiscoverCategory;


