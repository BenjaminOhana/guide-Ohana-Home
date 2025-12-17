import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { translations } from './translations.js';

// DOM Elements
const app = document.getElementById('app');
// ... (rest of imports)

// -- GUESTBOOK LOGIC (Firebase Real-Time) --

// -- INTERNATIONALIZATION LOGIC --
let currentLang = localStorage.getItem('ohana_lang') || 'fr';

function getTranslation(lang, key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], translations[lang]);
}

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('ohana_lang', lang);
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = getTranslation(lang, key);
        if (val) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = val;
            } else {
                el.textContent = val;
            }
        }
    });

    // Update active class on flags
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

// Expose to window
window.changeLanguage = (lang) => {
    updateLanguage(lang);
};

// -- GUEST NAME DYNAMIC LOGIC --
function initGuestNameListener() {
    // Listen to the 'home' document in 'guest_settings' collection
    onSnapshot(doc(db, "guest_settings", "home"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const guestName = data.guestName || "Ohana Home"; // Fallback

            // Update Title (Name)
            const titleEl = document.querySelector('.greeting h1');
            if (titleEl) titleEl.textContent = guestName;

            // Update Subtitle (Welcome message)
            const welcomeEl = document.querySelector('.greeting .greeting-pre');
            if (welcomeEl) {
                // If it's the default "Ohana Home", show standard welcome
                // If it's a person, show "Bienvenue à Ohana Home" (or keep standard)
                welcomeEl.textContent = "Bienvenue à Ohana Home";
            }

            // -- REMOTE REFRESH LOGIC --
            // If admin triggers a refresh, reload page
            if (data.refreshTrigger) {
                const lastRefresh = sessionStorage.getItem('lastRefreshTimestamp');
                if (lastRefresh && data.refreshTrigger > lastRefresh) {
                    console.log("Remote refresh received. Reloading...");
                    sessionStorage.setItem('lastRefreshTimestamp', Date.now());
                    window.location.reload(true);
                } else if (!lastRefresh) {
                    // First load, just set the timestamp so we don't reload immediately loop
                    sessionStorage.setItem('lastRefreshTimestamp', Date.now());
                }
            }
        }
    });
}

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
    initGuestNameListener();
    updateGuestbookQR();

    // Init Language
    updateLanguage(currentLang);

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
// Optimized Image Preloader: Sequential Loading
function preloadScreensaverImages() {
    console.log('Starting gentle background image preload...');
    if (typeof screensaverImages !== 'undefined' && Array.isArray(screensaverImages)) {
        // Only preload the first 3 images immediately to save bandwidth
        // The rest will be loaded just-in-time by the slideshow logic or a slow background loader
        const initialBatch = screensaverImages.slice(0, 3);
        initialBatch.forEach(src => {
            const img = new Image();
            img.src = src;
        });

        // Background iterator for the rest (very slow, 1 every 5 seconds)
        let index = 3;
        const slowLoader = setInterval(() => {
            if (index >= screensaverImages.length) {
                clearInterval(slowLoader);
                return;
            }
            const img = new Image();
            img.src = screensaverImages[index];
            index++;
        }, 5000);
    }
}


// -- Screensaver Logic --

// New Screensaver Images (Local)
// New Screensaver Images (Local)
// New Screensaver Images (Local)
export const screensaverImages = [
    // Top Priority (Story & Review & Ben Overlay)
    // 'assets/img/screensaver/slide_story_benjamin.png', // REMOVED: File missing
    'assets/img/screensaver/slide_ben_overlay.jpg',
    'assets/img/screensaver/slide_dog_message.png',
    // 'assets/img/screensaver/slide_review_ohana.jpg', // REMOVED per request

    // High Quality (HQ) - Optimized
    'assets/img/screensaver/slide_hq_1.png.jpg',
    'assets/img/screensaver/slide_hq_3.png.jpg',
    'assets/img/screensaver/slide_hq_4.png.jpg',
    'assets/img/screensaver/slide_hq_5.png.jpg',
    'assets/img/screensaver/slide_hq_6.png.jpg',
    'assets/img/screensaver/slide_hq_7.png.jpg',
    'assets/img/screensaver/slide_hq_8.png.jpg',
    'assets/img/screensaver/slide_hq_9.png.jpg',
    'assets/img/screensaver/slide_hq_10.png.jpg',
    'assets/img/screensaver/slide_hq_11.png.jpg',
    'assets/img/screensaver/slide_hq_12.png.jpg',

    // Generated (AI)
    'assets/img/screensaver/slide_gen_1.png',
    'assets/img/screensaver/slide_gen_2.png',
    'assets/img/screensaver/slide_gen_4.png',
    'assets/img/screensaver/slide_gen_5.png',
    'assets/img/screensaver/slide_gen_6.png',
    'assets/img/screensaver/slide_gen_7.png',

    // Standard (Existing)
    'assets/img/screensaver/slide_8.png',
    'assets/img/screensaver/slide_12.png',
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
    // 'assets/img/screensaver/slide_27.png', // DELETED
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

// Helper to identify slides containing text (No Mantra, Contain Layout)
export function isTextSlide(src) {
    if (!src) return false;
    // Specific Whitelist based on Aspect Ratio (> 1.9) & User Input
    // These slides have text burned in and should NOT be cropped (Contain + Blur BG)
    return src.includes('slide_dog_message.png') ||
        src.includes('slide_ben_overlay.jpg');
    // Removed slide_hq_7.png to allow it to be Full Screen (Cover) as requested
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

        if (isTextSlide(imgSrc)) {
            if (imgSrc.includes('slide_dog_message.png')) {
                // -- SPECIAL CASE: Dog Message (Ratings) --
                slide.style.display = 'flex';
                slide.style.flexDirection = 'row';
                slide.style.backgroundColor = '#f7f5f2'; // Warm white

                // Left Panel: Text
                const leftPanel = document.createElement('div');
                leftPanel.style.flex = '1.3'; // Text takes more space
                leftPanel.style.padding = '50px 60px';
                leftPanel.style.display = 'flex';
                leftPanel.style.flexDirection = 'column';
                leftPanel.style.justifyContent = 'center';
                leftPanel.style.alignItems = 'flex-start';
                leftPanel.style.color = '#333';
                leftPanel.style.gap = '20px';
                leftPanel.style.overflowY = 'auto'; // Safety

                // Title
                const title = document.createElement('h2');
                title.textContent = getTranslation(currentLang, 'screensaver.dog_slide.title');
                title.style.fontSize = '2.8rem';
                title.style.fontFamily = "'Caveat', cursive"; // Playful font
                title.style.color = '#C17B5F';
                title.style.marginBottom = '10px';
                leftPanel.appendChild(title);

                // Intro
                const intro = document.createElement('p');
                intro.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.intro');
                intro.style.fontSize = '1.2rem';
                intro.style.lineHeight = '1.5';
                leftPanel.appendChild(intro);

                // Secret Block
                const secretBox = document.createElement('div');
                secretBox.style.background = 'white';
                secretBox.style.padding = '20px';
                secretBox.style.borderRadius = '15px';
                secretBox.style.boxShadow = '0 5px 20px rgba(0,0,0,0.05)';
                secretBox.style.width = '100%';

                const secretTitle = document.createElement('h3');
                secretTitle.textContent = getTranslation(currentLang, 'screensaver.dog_slide.secret_title');
                secretTitle.style.fontSize = '1.2rem';
                secretTitle.style.marginBottom = '10px';
                secretTitle.style.color = '#5A7D7C'; // Soft Green
                secretBox.appendChild(secretTitle);

                const secretText = document.createElement('p');
                secretText.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.secret_text');
                secretText.style.fontSize = '1.1rem';
                secretText.style.marginBottom = '10px';
                secretBox.appendChild(secretText);

                const algoText = document.createElement('p');
                algoText.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.algo_text');
                algoText.style.fontSize = '1.0rem';
                algoText.style.fontStyle = 'italic';
                algoText.style.opacity = '0.8';
                secretBox.appendChild(algoText);

                leftPanel.appendChild(secretBox);

                // Call to Action
                const cta = document.createElement('p');
                cta.textContent = getTranslation(currentLang, 'screensaver.dog_slide.call_to_action');
                cta.style.fontSize = '1.2rem';
                cta.style.fontWeight = 'bold';
                cta.style.color = '#C17B5F';
                leftPanel.appendChild(cta);

                // Feedback
                const feedbackBox = document.createElement('div');
                feedbackBox.style.marginTop = '20px';
                feedbackBox.style.borderLeft = '4px solid #C17B5F';
                feedbackBox.style.paddingLeft = '15px';

                const fbTitle = document.createElement('strong');
                fbTitle.textContent = getTranslation(currentLang, 'screensaver.dog_slide.feedback_title');
                fbTitle.style.display = 'block';
                fbTitle.style.marginBottom = '5px';
                feedbackBox.appendChild(fbTitle);

                const fbText = document.createElement('span');
                fbText.textContent = getTranslation(currentLang, 'screensaver.dog_slide.feedback_text');
                fbText.style.fontSize = '0.95rem';
                feedbackBox.appendChild(fbText);

                leftPanel.appendChild(feedbackBox);
                slide.appendChild(leftPanel);

                // Right Panel: Image
                const rightPanel = document.createElement('div');
                rightPanel.style.flex = '0.9';
                rightPanel.style.backgroundImage = `url('${imgSrc}')`;
                rightPanel.style.backgroundSize = 'contain';
                rightPanel.style.backgroundRepeat = 'no-repeat';
                rightPanel.style.backgroundPosition = 'center bottom';
                // rightPanel.style.marginTop = '50px'; // Push dog down a bit if needed

                slide.appendChild(rightPanel);

            } else if (imgSrc.includes('slide_ben_overlay.jpg')) {
                // -- SPECIAL CASE: Ben's Photo + Overlay Text + QR (User Request) --
                slide.style.display = 'flex';
                slide.style.flexDirection = 'row';
                slide.style.backgroundColor = '#1a1a1a'; // Dark bg base

                // Left Panel: Text + QR
                const leftPanel = document.createElement('div');
                leftPanel.style.flex = '1';
                leftPanel.style.padding = '60px';
                leftPanel.style.display = 'flex';
                leftPanel.style.flexDirection = 'column';
                leftPanel.style.justifyContent = 'center';
                leftPanel.style.alignItems = 'flex-start';
                leftPanel.style.color = 'white';
                leftPanel.style.zIndex = '10';

                // Title
                const title = document.createElement('h2');
                title.setAttribute('data-i18n', 'screensaver.ben_slide.title');
                title.textContent = getTranslation(currentLang, 'screensaver.ben_slide.title');
                title.style.fontSize = '3rem';
                title.style.marginBottom = '20px';
                title.style.fontFamily = "'Cormorant Garamond', serif";
                leftPanel.appendChild(title);

                // Subtitle
                const sub = document.createElement('p');
                sub.setAttribute('data-i18n', 'screensaver.ben_slide.subtitle');
                sub.textContent = getTranslation(currentLang, 'screensaver.ben_slide.subtitle');
                sub.style.fontSize = '1.5rem';
                sub.style.opacity = '0.8';
                sub.style.marginBottom = '40px';
                leftPanel.appendChild(sub);

                // QR Container
                const qrContainer = document.createElement('div');
                qrContainer.style.background = 'white';
                qrContainer.style.padding = '15px';
                qrContainer.style.borderRadius = '15px';
                qrContainer.style.display = 'flex';
                qrContainer.style.flexDirection = 'column';
                qrContainer.style.alignItems = 'center';
                qrContainer.style.gap = '10px';

                // QR Image (Placeholder for now)
                const qrImg = document.createElement('img');
                // Use a generic generated QR for now as placeholder or the guestbook one
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}`;
                qrImg.style.width = '120px';
                qrImg.style.height = '120px';
                qrContainer.appendChild(qrImg);

                // QR Label
                const qrLabel = document.createElement('span');
                qrLabel.setAttribute('data-i18n', 'screensaver.ben_slide.qr_label');
                qrLabel.textContent = getTranslation(currentLang, 'screensaver.ben_slide.qr_label');
                qrLabel.style.color = '#333';
                qrLabel.style.fontSize = '0.9rem';
                qrLabel.style.fontWeight = '600';
                qrContainer.appendChild(qrLabel);

                leftPanel.appendChild(qrContainer);
                slide.appendChild(leftPanel);

                // Right Panel: Image
                const rightPanel = document.createElement('div');
                rightPanel.style.flex = '1.2'; // Slightly wider image
                rightPanel.style.backgroundImage = `url('${imgSrc}')`;
                rightPanel.style.backgroundSize = 'cover';
                rightPanel.style.backgroundPosition = 'center';
                rightPanel.style.height = '100%';
                // Fade effect on the left edge of the image to blend with dark bg
                rightPanel.style.maskImage = 'linear-gradient(to right, transparent, black 15%)';
                rightPanel.style.webkitMaskImage = 'linear-gradient(to right, transparent, black 15%)';

                slide.appendChild(rightPanel);

            } else {
                // -- STANDARD TEXT SLIDE: Blur Background + Sharp Image --

                // Layer 1: Blurred Background (Full Cover)
                const bgLayer = document.createElement('div');
                bgLayer.classList.add('slide-bg');
                bgLayer.style.backgroundImage = `url('${imgSrc}')`;
                bgLayer.style.transform = 'scale(1.1)'; // Overscan to hide blur edges
                slide.appendChild(bgLayer);

                // Layer 2: Sharp Image (Contain)
                const imgLayer = document.createElement('div');
                imgLayer.classList.add('slide-img');
                imgLayer.style.backgroundImage = `url('${imgSrc}')`;
                slide.appendChild(imgLayer);
            }

        } else {
            // -- STANDARD PHOTO LAYOUT: Full Screen Cover --
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

    // Initial Clock Visibility Check (in case first slide is Review)
    const currentImg = screensaverImages[currentSlide];
    const clockEl = document.querySelector('.screensaver-clock');
    if (clockEl) {
        if (currentImg && (currentImg.includes('slide_review_ohana.jpg') || currentImg.includes('slide_ben_overlay.jpg'))) {
            clockEl.style.opacity = '0';
        } else {
            clockEl.style.opacity = '1';
        }
    }

    // Auto-Reload Timer REMOVED (Replaced by Remote Refresh)
    // if (!reloadTimer) reloadTimer = setInterval(checkAndReload, 600000);
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

    // Get current image source
    const currentImg = screensaverImages[currentSlide];

    // DEFAULT DURATION: 3 Minutes
    let duration = 180000;

    // Long duration for Text/Read slides
    if (isTextSlide(currentImg)) {
        duration = 600000; // 10 minutes for text
    }

    slideTimeout = setTimeout(() => {
        nextSlide();
        scheduleNextSlide(); // Recursive call

        // Preload next image just-in-time
        const nextIndex = (currentSlide + 1) % slidesNodeList.length;
        if (screensaverImages[nextIndex]) {
            const img = new Image();
            img.src = screensaverImages[nextIndex];
        }
    }, duration);
}

function nextSlide() {
    if (!slidesNodeList.length) return;

    slidesNodeList[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slidesNodeList.length;
    slidesNodeList[currentSlide].classList.add('active');

    // -- CLOCK VISIBILITY LOGIC --
    // User Request: "Quand cette slide passe, l'heure ne doit pas s'afficher"
    const currentImg = screensaverImages[currentSlide];
    const clockEl = document.querySelector('.screensaver-clock');
    if (clockEl) {
        if (currentImg.includes('slide_review_ohana.jpg') || currentImg.includes('slide_ben_overlay.jpg')) {
            clockEl.style.opacity = '0';
            clockEl.style.transition = 'opacity 0.5s ease';
        } else {
            clockEl.style.opacity = '1';
        }
    }

    // Update Mantra occasionally
    updateMantra();
}

// -- Screensaver Clock --
function updateScreensaverClock() {
    const now = new Date();
    const timeEl = document.getElementById('ss-time');
    const dateEl = document.getElementById('ss-date');

    // Map 'fr'/'en' to full locale
    const localeMap = {
        'fr': 'fr-FR',
        'en': 'en-GB'
    };
    const locale = localeMap[currentLang] || 'fr-FR';

    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    if (dateEl) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        dateEl.textContent = now.toLocaleDateString(locale, options);
    }
}

// -- Mantras Logic --
export const mantras = [
    "Respirez. Vous êtes chez vous.",
    "Prenez le temps de ne rien faire.",
    "La simplicité est la sophistication suprême.",
    "Ohana signifie famille.",
    "Écoutez le silence.",
    "Juste respirer.",
    "Accordez-vous une pause.",
    "Votre intuition a raison.",
    "Votre énergie ne ment pas.",
    "Revenez à vous.",
    "L'âme sait avant la tête.",
    "Tout commence à l'intérieur.",
    "Ce qui vous fait vibrer compte.",
    "Votre histoire s'écrit maintenant.",
    "Vous êtes plus fort que vos peurs.",
    "Le monde a besoin de votre lumière.",
    "Ce que vous cherchez vous cherche aussi.",
    "Faites-le pour vous.",
    "", "", "", "", "", "", "", "" // Increased empty chance (8 total ~30%)
];

let mantraDeck = [];

function getNextMantra() {
    if (mantraDeck.length === 0) {
        // Refill and shuffle
        mantraDeck = [...mantras];
        shuffleArray(mantraDeck);
        console.log("Refilled Mantra Deck:", mantraDeck);
    }
    return mantraDeck.pop();
}

function updateMantra() {
    const mantraEl = document.getElementById('ss-mantra-text');
    const container = document.querySelector('.screensaver-mantra-wrapper');
    if (!mantraEl || !container) return;

    // Check if current slide should hide Mantra (Text Slides)
    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide) {
        // Check inline background image to match filename
        const style = window.getComputedStyle(activeSlide);
        let bg = activeSlide.style.backgroundImage || ''; // Inline style preferred

        // Fix: If inline is empty, try to find child with class slide-img
        if (!bg || bg === 'none') {
            const imgLayer = activeSlide.querySelector('.slide-img');
            if (imgLayer) {
                bg = imgLayer.style.backgroundImage || '';
            }
        }

        if (isTextSlide(bg)) {
            container.style.opacity = '0';
            return;
        }
    }

    // Get next unique mantra from deck
    const text = getNextMantra();

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
    }, 1000); // Wait for fade out to finish
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
    // HQ - Optimized
    'assets/img/hero/hero_hq_1.png.jpg',
    'assets/img/hero/hero_hq_3.png.jpg',
    'assets/img/hero/hero_hq_4.png.jpg',
    'assets/img/hero/hero_hq_5.png.jpg',
    'assets/img/hero/hero_hq_6.png.jpg',
    'assets/img/hero/hero_hq_7.png.jpg',
    'assets/img/hero/hero_hq_8.png.jpg',
    'assets/img/hero/hero_hq_9.png.jpg',
    'assets/img/hero/hero_hq_10.png.jpg',
    'assets/img/hero/hero_hq_11.png.jpg',
    'assets/img/hero/hero_hq_12.png.jpg',

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
        img: 'assets/img/adresses/regaler_main.png',
        hasSubcategories: true,
        subcategories: {
            'restaurants': {
                title: 'Restaurants',
                img: 'assets/img/adresses/cat_restaurant.png',
                // icon: removed as per request
                places: [
                    {
                        name: 'Les Moulins Bleus',
                        type: 'Italien',
                        review: 'Un cadre splendide en cour intérieure pour déguster la meilleure lasagne de votre vie, une véritable escapade italienne au cœur de Thionville.',
                        img: 'assets/img/adresses/resto_moulins_bleus.png',
                        maps_url: 'https://www.google.com/maps/place/Les+Moulins+Bleus+-+Thionville/@49.358979,6.1659631,17z/data=!3m1!4b1!4m6!3m5!1s0x479524d5e4a210f3:0x6a5191fb268d09c4!8m2!3d49.358979!4d6.168538!16s%2Fg%2F1tf2wr1s?entry=ttu'
                    },
                    {
                        name: 'Arsène & Clara',
                        type: 'Terrasse & Vins',
                        review: 'La terrasse incontournable pour un apéro dînatoire au coucher du soleil, où le stress de la journée s\'évapore instantanément.',
                        img: 'assets/img/adresses/resto_arsene_clara.png',
                        maps_url: 'https://www.google.com/maps/place/Restaurant+Ars%C3%A8ne+%26+Clara/@49.355,6.16897,17z/data=!3m1!4b1!4m6!3m5!1s0x47952509c1fd9b1d:0xec243f0e0955dfaa!8m2!3d49.355!4d6.16897!16s%2Fg%2F11ll5t9f06?entry=ttu'
                    },
                    {
                        name: 'Le P\'tit Bistro d\'Ethan',
                        type: 'Bistrot Lorrain',
                        review: 'Un peu de gastronomie dans un cadre bistrot : cuisine lorraine revisitée et carte renouvelée tous les deux mois.',
                        img: 'assets/img/adresses/resto_ptit_bistro.png',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Le+P%27tit+Bistro+d%27Ethan+Thionville'
                    }
                ]
            },
            'street_food': {
                title: 'Street Food',
                img: 'assets/img/adresses/cat_street_food.png',
                // icon: removed
                places: [
                    {
                        name: 'Pollux',
                        type: 'Smash Burger',
                        review: 'Le meilleur smash burger de Thionville avec du bœuf français et du cheddar maturé, pour une explosion de saveurs street-food authentique.',
                        img: 'assets/img/adresses/street_pollux.jpg',
                        maps_url: 'https://www.google.com/maps/place/POLLUX/@49.3598728,6.1644123,7z/data=!4m10!1m2!2m1!1spollux!3m6!1s0x4795255cd9314d97:0xf1de455566d4ce04!8m2!3d49.3601049!4d6.1647188!15sCgZwb2xsdXhaCCIGcG9sbHV4kgEUaGFtYnVyZ2VyX3Jlc3RhdXJhbnSaASNDaFpEU1VoTk1HOW5TMFZKUTBGblNVTTVNRnA2YkVWUkVBReABAPoBBAgAEEA!16s%2Fg%2F11l5tps7x6?entry=ttu'
                    },
                    {
                        name: 'Le Class',
                        type: 'Snack',
                        review: 'Sans doute l\'un des meilleurs snacks de la région : des portions généreuses, des produits frais et un accueil au top.',
                        img: 'assets/img/adresses/street_le_class.jpg',
                        maps_url: 'https://www.google.com/maps/place/LE+CLASS/@49.3647733,6.1623457,3a,75y,90t/data=!3m8!1e2!3m6!1sAF1QipN6eVUy1ya-tlAXOe4kYC-dZh7O4rI-Hi-uyC9i!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fp%2FAF1QipN6eVUy1ya-tlAXOe4kYC-dZh7O4rI-Hi-uyC9i%3Dw152-h86-k-no!7i3264!8i1836!4m7!3m6!1s0x47953ad4a82e54a5:0xed538aaf16b9e574!8m2!3d49.3646366!4d6.1623423!10e5!16s%2Fg%2F11c2lbptfs?entry=ttu'
                    },
                    {
                        name: 'Simply Good',
                        type: 'Snack',
                        review: 'Simplement l\'un des meilleurs snacks du coin : des recettes maîtrisées, de la fraîcheur dans l\'assiette et une convivialité qui ne déçoit jamais.',
                        img: 'assets/img/adresses/street_simply_good.png',
                        maps_url: 'https://www.google.com/maps/place/Simply+Good/@49.3577117,6.1631986,17z/data=!3m1!4b1!4m6!3m5!1s0x479525839063699d:0xc09fbb114f5b2453!8m2!3d49.3577117!4d6.1657735!16s%2Fg%2F11q35k1ppz?entry=ttu'
                    }
                ]
            },
            'boulangerie': {
                title: 'Boulangerie',
                img: 'assets/img/adresses/cat_boulangerie.png',
                // icon: removed
                places: [
                    {
                        name: 'Boulangerie Parisienne BERNS',
                        type: 'Artisan',
                        review: 'Succombez à la brioche faite maison et au savoir-faire artisanal d\'une boulangerie qui vit au rythme de la ville.',
                        img: 'assets/img/adresses/boulangerie_berns.jpg',
                        maps_url: 'https://www.google.com/maps/place/Boulangerie+Parisienne+BERNS/@49.3618842,6.1706326,16.83z/data=!4m6!3m5!1s0x479524d5171fd4ef:0xb2db1d585fe4b653!8m2!3d49.3619922!4d6.1701664!16s%2Fg%2F1v44cxc_?entry=ttu'
                    },
                    {
                        name: 'La Fabrik des Pains Vagabonds',
                        type: 'Bio & Éthique',
                        review: 'Plus qu\'une boulangerie, un lieu de vie bio et éthique où le pain au levain naturel côtoie un café de spécialité d\'exception.',
                        img: 'assets/img/adresses/boulangerie_la_fabrik.jpg',
                        maps_url: 'https://www.google.com/maps/place/La+Fabrik+des+Pains+Vagabonds%E2%80%93+Boulangerie+%26+Caf%C3%A9+de+sp%C3%A9cialit%C3%A9/@49.3601055,6.1646082,17z/data=!3m1!4b1!4m6!3m5!1s0x4795258254b8231b:0xfcea6b29f9f43788!8m2!3d49.3601055!4d6.1646082!16s%2Fg%2F11tp30c52k?entry=ttu'
                    },
                    {
                        name: 'Pâtisserie FISCHER',
                        type: 'Viennoiserie',
                        review: 'Profitez d\'une pause douce en terrasse sur la place principale avec des viennoiseries d\'une fraîcheur garantie.',
                        img: 'assets/img/adresses/boulangerie_fischer.jpg',
                        maps_url: 'https://www.google.com/maps/place/P%C3%A2tisserie+FISCHER/@49.3582503,6.1676219,17z/data=!3m1!4b1!4m6!3m5!1s0x479524d605a163ef:0x3bd838bfc57a5779!8m2!3d49.3582503!4d6.1676219!16s%2Fg%2F1tfb0y1t?entry=ttu'
                    }
                ]
            }
        }
    },
    'respirer': {
        title: 'Respirer',
        img: 'assets/img/adresses/respirer_main.jpg',
        hasSubcategories: true,
        subcategories: {
            'parc_urbain': {
                title: 'Parc urbain',
                img: 'assets/img/adresses/cat_parc_urbain.png',
                places: [
                    {
                        name: 'Parc Wilson',
                        type: 'Parc & Kiosque',
                        review: 'Un écrin de verdure de 1,4 hectares longeant la Moselle, idéal pour une flânerie au bord de l\'eau ou écouter un concert au kiosque en été.',
                        img: 'assets/img/adresses/respirer_wilson.jpg',
                        maps_url: 'https://www.google.com/maps/place/Parc+Wilson/@49.3552561,6.1644774,17z/data=!3m1!4b1!4m6!3m5!1s0x4795252845201383:0x89da63412b1db38e!8m2!3d49.3552561!4d6.1644774!16s%2Fg%2F11ckvfjrn7?entry=ttu'
                    },
                    {
                        name: 'Parc Napoléon',
                        type: 'Roseraie & Arbres Rares',
                        review: 'L\'un des parcs préférés des Thionvillois : perdez-vous dans la roseraie aux mille senteurs et admirez des arbres aux essences rares.',
                        img: 'assets/img/adresses/respirer_napoleon.jpg',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Parc+Napoleon+Thionville'
                    },
                    {
                        name: 'Aéroparc Yutz',
                        type: 'Loisirs & Nature',
                        review: 'Un immense poumon vert de 42 ha avec lac, jardins et aires de jeux. Le spot parfait pour un pique-nique, un barbecue ou une séance de sport en plein air.',
                        img: 'assets/img/adresses/respirer_aeroparc.png',
                        maps_url: 'https://www.google.com/maps/place/A%C3%A9roparc+Yutz/@49.3541068,6.20192,17z/data=!3m1!4b1!4m6!3m5!1s0x479525f50d700541:0x3614f994bbd44c39!8m2!3d49.3541069!4d6.2067909!16s%2Fg%2F11rr4slrlb?entry=ttu'
                    }
                ]
            },
            'promenade_nature': {
                title: 'Promenade en nature',
                img: 'assets/img/adresses/cat_promenade_nature.png',
                places: [
                    {
                        name: 'Les Berges de la Moselle',
                        type: 'Balade & Vélo',
                        review: 'Promenez-vous sur des km en pleine nature jusqu\'au Luxembourg ! Le départ est visible depuis votre fenêtre, il suffit de suivre l\'horizon.',
                        img: 'assets/img/adresses/respirer_berges.jpg',
                        maps_url: 'https://www.google.com/maps/place/57100+Thionville/@49.3620331,6.178503,17.46z/data=!3m1!5s0x479524d00fa676db:0x3333a570d9bfe8fc!4m14!1m7!3m6!1s0x47952511ab21e71b:0x9a254d0268d15c09!2sGare+de+Thionville!8m2!3d49.3538603!4d6.1697235!16s%2Fg%2F11vcbq5p5h!3m5!1s0x47953b32ae6623fd:0xd8e852674f8d23ba!8m2!3d49.3637712!4d6.1820603!16s%2Fg%2F11y676vjxy?entry=ttu'
                    },
                    {
                        name: 'Base de loisirs de Nautic\'Ham',
                        type: 'Détente & Jeux',
                        review: 'Envie d’une ambiance vacances ? Plage, jeux pour enfants et verre au bord de l\'étang : le lieu idéal pour déconnecter à quelques minutes d\'ici.',
                        img: 'assets/img/adresses/respirer_nauticham.jpg',
                        maps_url: 'https://www.google.com/maps/place/Base+de+loisirs+de+Nautic\'Ham/@49.3821784,6.2032547,14z/data=!4m10!1m2!2m1!1scentre+de+loisir+bass+ham!3m6!1s0x47953d002ddbe597:0xec3d25d5678fc84e!8m2!3d49.384392!4d6.222812!15sChljZW50cmUgZGUgbG9pc2lyIGJhc3MgaGFtWhsiGWNlbnRyZSBkZSBsb2lzaXIgYmFzcyBoYW2SARBhbXVzZW1lbnRfY2VudGVymgFEQ2k5RFFVbFJRVU52WkVOb2RIbGpSamx2VDJ0YVdscFdiRFpUZW1SSVdsVjRNMkZxU2xoUmJYaEtZakowYVZSR1JSQULgAQD6AQQIABBK!16s%2Fg%2F11zj5tz7j_?entry=ttu'
                    }
                ]
            }
        }
    },
    'explorer': {
        title: 'Explorer',
        img: 'assets/img/adresses/explorer_main.jpg',
        places: [
            {
                name: 'Musée de la Tour aux Puces',
                type: 'Histoire & Archéologie',
                review: 'Un voyage dans le temps au cœur d\'un ancien donjon médiéval : découvrez les secrets archéologiques du Pays Thionvillois pour un prix tout doux.',
                img: 'assets/img/adresses/explorer_tour_aux_puces.jpg',
                maps_url: 'https://www.google.com/maps/place/Mus%C3%A9e+de+la+Tour+aux+Puces/@49.3579136,6.1691047,17z/data=!3m1!4b1!4m6!3m5!1s0x479524d673e53b91:0x1ee545eb451ae07!8m2!3d49.3579136!4d6.1691047!16s%2Fg%2F11bc5fkfm9?entry=ttu'
            },
            {
                name: 'Fort de Guentrange',
                type: 'Histoire Militaire & Vue',
                review: 'Perché sur la colline, ce géant de béton offre une vue imprenable sur la vallée et une plongée fascinante dans l\'histoire militaire de la région.',
                img: 'assets/img/adresses/explorer_fort_guentrange.jpg',
                maps_url: 'https://www.google.com/maps/search/?api=1&query=Fort+de+Guentrange+Thionville'
            },
            {
                name: 'Escapade à Luxembourg',
                type: 'Ville & Culture',
                review: 'Transformez votre séjour en escapade internationale : Luxembourg-Ville et ses trésors UNESCO ne sont qu\'à 25 minutes de train direct.',
                img: 'assets/img/adresses/explorer_luxembourg.jpg',
                maps_url: 'https://www.google.com/maps/search/Gare+de+Luxembourg/@49.6012245,6.129576,15z/data=!3m1!4b1?entry=ttu'
            },
            {
                name: 'Château de Malbrouck',
                type: 'Médiéval & Panorama',
                review: 'Imposant château médiéval magnifiquement restauré à la frontière (30 min). Architecture fortifiée, vues panoramiques et expositions d\'art dans un cadre d\'exception.',
                img: 'assets/img/adresses/explorer_malbrouck.jpg',
                maps_url: 'https://www.google.com/maps/search/?api=1&query=Chateau+de+Malbrouck'
            }
        ]
    },
    'indispensables': {
        title: 'Indispensables',
        img: 'assets/img/adresses/indispensable_main.jpg',
        hasSubcategories: true,
        subcategories: {
            'courses': {
                title: 'Courses',
                img: 'assets/img/adresses/cat_courses.png',
                places: [
                    {
                        name: 'Carrefour Market',
                        type: 'Centre Ville',
                        review: 'Le supermarché de proximité idéal au cœur du centre commercial, parfait pour des courses complètes avec un large choix de produits frais.',
                        img: 'assets/img/adresses/indispensable_carrefour.jpg',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Carrefour+Market+Thionville+Cour+des+Capucins'
                    },
                    {
                        name: 'Lidl Gare',
                        type: 'Rapide & Éco',
                        review: 'L\'option maligne à deux pas des rails pour des courses rapides, économiques et une boulangerie en libre-service.',
                        img: 'assets/img/adresses/indispensable_lidl.jpg',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Lidl+5+Rue+de+l+Ancienne+Gare+Thionville'
                    },
                    {
                        name: 'Centre Commercial Geric',
                        type: 'Shopping & Miam',
                        review: 'Enorme centre commercial pour faire du shopping, vos courses ou manger dans de nombreux restaurants.',
                        img: 'assets/img/adresses/indispensable_geric.jpg',
                        maps_url: 'https://www.google.com/maps/place/Centre+Commercial+Carrefour+Geric/@49.354748,6.1362505,17z/data=!3m1!4b1!4m6!3m5!1s0x47952547dab2f151:0x3050e5bbe5a1a8d!8m2!3d49.3547481!4d6.1411214!16s%2Fg%2F11cftxnlp?entry=ttu'
                    }
                ]
            },
            'sante': {
                title: 'Pharmacie et santé',
                img: 'assets/img/adresses/cat_sante.png',
                places: [
                    {
                        name: 'Pharmacie Lafayette',
                        type: 'Grande Pharmacie',
                        review: 'Une grande pharmacie au large choix de parapharmacie à prix bas, avec une équipe disponible pour vos conseils santé.',
                        img: 'assets/img/adresses/indispensable_pharmacie.jpg',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Pharmacie+Lafayette+des+Arcades+Thionville'
                    }
                ]
            },
            'mobilite': {
                title: 'Mobilité',
                img: 'assets/img/adresses/cat_mobilite.png',
                places: [
                    {
                        name: 'Gare de Thionville',
                        type: 'Hub Transport',
                        review: 'Le hub central pour explorer la Grande Région, avec un accès TGV et TER direct vers Luxembourg et Metz.',
                        img: 'assets/img/adresses/indispensable_gare.png',
                        maps_url: 'https://www.google.com/maps/search/?api=1&query=Gare+de+Thionville'
                    }
                ]
            }
        }
    }
};

function renderDiscoverMenu() {
    const container = document.querySelector('.discover-categories-grid');
    if (!container) return;

    // Reset Header logic in case we came back from Sub-menu
    const headerTitle = document.querySelector('#discover-menu h2');
    if (headerTitle) headerTitle.textContent = 'Nos Adresses';

    const backBtn = document.querySelector('#discover-menu .back-btn');
    backBtn.onclick = goBack; // Reset to Hub navigation

    container.innerHTML = ''; // Verify clean state

    Object.keys(discoverData).forEach(key => {
        const cat = discoverData[key];
        const tile = document.createElement('div');
        tile.className = 'category-tile';
        tile.onclick = () => openDiscoverCategory(key);
        tile.innerHTML = `
            <img src="${cat.img}" alt="${cat.title}" loading="lazy" decoding="async">
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

    // Handle Sub-categories Logic
    if (cat.hasSubcategories) {
        renderSubMenu(cat);
        return;
    }

    // Populate Details
    populateDiscoverDetails(cat.title, cat.img, cat.places);
}

function renderSubMenu(parentCat) {
    // Re-use the main menu container but populate it with sub-categories
    const container = document.querySelector('.discover-categories-grid');
    container.innerHTML = ''; // Clear main menu

    // Update Header Title to Parent Category
    const headerTitle = document.querySelector('#discover-menu h2');
    if (headerTitle) headerTitle.textContent = parentCat.title;

    // Change "Retour" behavior to go back to Main Menu
    const backBtn = document.querySelector('#discover-menu .back-btn');
    backBtn.onclick = () => renderDiscoverMenu(); // Reset to top level

    Object.keys(parentCat.subcategories).forEach(subKey => {
        const sub = parentCat.subcategories[subKey];
        const tile = document.createElement('div');
        tile.className = 'category-tile';
        tile.onclick = () => populateDiscoverDetails(sub.title, sub.img, sub.places, true); // True = isSubCategory
        tile.innerHTML = `
            <img src="${sub.img}" alt="${sub.title}" loading="lazy" decoding="async">
            <div class="category-overlay">
                <h3>${sub.title}</h3> 
            </div>
        `;
        // Optional: Animate in?
        container.appendChild(tile);
    });
}

// Helper to render the final list
function populateDiscoverDetails(title, img, places, isSub = false) {
    document.getElementById('discover-cat-title').textContent = title;
    const listContainer = document.getElementById('discover-list');
    listContainer.innerHTML = ''; // Clear

    // Update Left Image Animation
    const heroImg = document.getElementById('discover-hero-img');
    heroImg.style.opacity = '0';
    setTimeout(() => {
        heroImg.src = img;
        heroImg.style.opacity = '1';
    }, 300);

    // Render Cards
    places.forEach(place => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
            <div class="place-card-img-wrapper">
                <img src="${place.img}" class="place-card-img" alt="${place.name}" loading="lazy" decoding="async">
            </div>
            <div class="place-card-content">
                <div class="place-type">${place.type}</div>
                <div class="place-title">${place.name}</div>
                <div class="place-review">"${place.review}"</div>
                
                <div class="place-qr-zone">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${place.maps_url ? encodeURIComponent(place.maps_url) : 'Maps:' + place.name}" class="place-qr-placeholder" alt="Scanner pour itinéraire">
                    <div class="place-qr-text">Scanner pour<br><strong>L'Itinéraire</strong></div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });

    // Sub-category back button logic
    const detailBackBtn = document.querySelector('#discover-details .back-btn');
    if (isSub) {
        // Go back to Sub-Menu (which is technically the 'menu' view active with sub-items)
        detailBackBtn.onclick = closeDiscoverDetailsToSubMenu;
        // We need to know WHICH parent to go back to. 
        // Simplification: Go back to 'display menu view', which currently holds the sub-menu.
    } else {
        detailBackBtn.onclick = closeDiscoverCategory; // Standard back to root
    }

    // Switch Views
    document.getElementById('discover-menu').classList.remove('active');
    document.getElementById('discover-menu').classList.add('hidden');

    document.getElementById('discover-details').classList.remove('hidden');
    document.getElementById('discover-details').classList.add('active');
}

function closeDiscoverDetailsToSubMenu() {
    // Just switch view back to menu (which is currently populated with sub-categories)
    document.getElementById('discover-details').classList.remove('active');
    document.getElementById('discover-details').classList.add('hidden');

    document.getElementById('discover-menu').classList.remove('hidden');
    document.getElementById('discover-menu').classList.add('active');
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



// -- SERVICE WORKER REGISTRATION --
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
