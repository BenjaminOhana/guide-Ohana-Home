// DOM Elements
const app = document.getElementById('app');
const screensaver = document.getElementById('screensaver');
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
}

function goBack() {
    // Hide all active views
    document.querySelectorAll('.view.active').forEach(view => {
        view.classList.remove('active');
    });

    // Show Hub
    document.getElementById('view-hub').classList.add('active');
}

function createTempSection(id) {
    // For prototype phase, if a section is missing in HTML, alert or log
    alert(`Section "${id}" en construction!`);
    goBack();
}


// -- Screensaver Logic --

// New Screensaver Images (Local)
const screensaverImages = [
    // 'assets/img/screensaver/slide_1.png', // Removed
    // 'assets/img/screensaver/slide_2.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_3.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_4.jpg', // Removed
    'assets/img/screensaver/slide_5.png',
    // 'assets/img/screensaver/slide_6.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_7.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_8.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_9.jpg', // Removed
    // 'assets/img/screensaver/slide_10.jpg', // Low Res Removed
    // 'assets/img/screensaver/slide_11.jpg', // Low Res Removed
    'assets/img/screensaver/slide_12.jpg',
    'assets/img/screensaver/slide_13.png',
    'assets/img/screensaver/slide_14.png',
    // 'assets/img/screensaver/slide_15.jpg', // Low Res Removed
    'assets/img/screensaver/slide_16.png',
    'assets/img/screensaver/slide_17.png',
    'assets/img/screensaver/slide_18.png',
    'assets/img/screensaver/slide_19.png',
    'assets/img/screensaver/slide_20.png',
    'assets/img/screensaver/slide_21.png',
    'assets/img/screensaver/slide_22.png',
    'assets/img/screensaver/slide_23.png',
    'assets/img/screensaver/slide_24.png',
    'assets/img/screensaver/slide_25.png',
    'assets/img/screensaver/slide_26.png',
    'assets/img/screensaver/slide_27.png',
    'assets/img/screensaver/slide_28.png',
    'assets/img/screensaver/slide_29.png',
    'assets/img/screensaver/slide_30.png',
    'assets/img/screensaver/slide_31.png',
    'assets/img/screensaver/slide_32.png',
    // New HQ Imports (V3/V4 Generated)
    'assets/img/screensaver/slide_hq_1.png',
    'assets/img/screensaver/slide_hq_2.png',
    'assets/img/screensaver/slide_hq_3.png',
    'assets/img/screensaver/slide_hq_4.png',
    'assets/img/screensaver/slide_hq_5.png',
    'assets/img/screensaver/slide_hq_6.png',
    'assets/img/screensaver/slide_hq_7.png',
    'assets/img/screensaver/slide_hq_8.png',
    'assets/img/screensaver/slide_hq_9.png',
    'assets/img/screensaver/slide_hq_10.png',
    'assets/img/screensaver/slide_hq_11.png',
    'assets/img/screensaver/slide_hq_12.png'
];

function initScreensaverSlides() {
    const container = document.querySelector('.slideshow');
    container.innerHTML = ''; // Clear existing

    screensaverImages.forEach((imgSrc, index) => {
        const slide = document.createElement('div');
        slide.classList.add('slide');
        if (index === 0) slide.classList.add('active');
        slide.style.backgroundImage = `url('${imgSrc}')`;
        container.appendChild(slide);
    });

    // Reset state
    currentSlide = 0;
    slidesNodeList = document.querySelectorAll('.slideshow .slide'); // Update ref
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
    // User request: "Dès que quelqu'un touche l'écran, le site revient au hub"
    goBack();
}

function startSlideshow() {
    if (slideInterval) clearInterval(slideInterval);
    // Switch slide every 8 seconds
    slideInterval = setInterval(nextSlide, 120000); // 2 minutes per slide

    // Also start clock tick
    updateScreensaverClock();
    if (!clockInterval) clockInterval = setInterval(updateScreensaverClock, 1000);

    // Smart Auto-Reload: Refresh page if screensaver stays active for 1 hour
    // This allows fetching new updates from GitHub without interrupting user
    reloadTimer = setTimeout(() => {
        window.location.reload(true);
    }, 3600000); // 1 hour (60 * 60 * 1000)
}

let clockInterval;
let reloadTimer; // Smart Auto-Reload

function stopSlideshow() {
    if (slideInterval) clearInterval(slideInterval);
    if (clockInterval) clearInterval(clockInterval);
    if (reloadTimer) clearTimeout(reloadTimer); // Cancel auto-reload if user returns
    clockInterval = null;
    reloadTimer = null;
}

function nextSlide() {
    if (!slidesNodeList.length) return;

    slidesNodeList[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slidesNodeList.length;
    slidesNodeList[currentSlide].classList.add('active');
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
    // HQ Replacements
    'assets/img/hero/hero_hq_1.png',
    'assets/img/hero/hero_hq_2.png',
    'assets/img/hero/hero_hq_3.png',
    'assets/img/hero/hero_hq_4.png',
    'assets/img/hero/hero_hq_5.png',
    // Keep better existing ones (6-10 were user uploaded recently)
    'assets/img/hero/hero_6.png',
    'assets/img/hero/hero_7.png',
    'assets/img/hero/hero_8.jpg',
    'assets/img/hero/hero_9.jpg',
    'assets/img/hero/hero_10.jpg'
];

let heroIndex = 0;
const heroImgElement = document.querySelector('.hero-bg');

function rotateHeroImage() {
    if (!heroImgElement) return;

    // Fade out
    heroImgElement.style.opacity = '0';

    setTimeout(() => {
        // Swap Src
        heroIndex = (heroIndex + 1) % heroImages.length;
        heroImgElement.src = heroImages[heroIndex];

        // Wait for load (optional, but safer for smooth fade in)
        heroImgElement.onload = () => {
            // Fade in
            heroImgElement.style.opacity = '0.85'; // Back to original opacity
        };
    }, 1000); // 1s transition time matches CSS
}

// Rotate every 60 seconds (60000 ms)
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
