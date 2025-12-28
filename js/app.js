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
                el.innerHTML = val;
            }
        }
    });

    // Update active class on flags
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Reset Mantra Deck on lang change so it switches immediately
    mantraDeck = [];

    // Re-render dynamic content that depends on translations
    // Use setTimeout to ensure DOM is ready after static updates
    setTimeout(() => {
        if (typeof renderDiscoverMenu === 'function') {
            renderDiscoverMenu();
        }
        // Re-render guestbook to update sample entries in new language
        if (typeof renderGuestbook === 'function' && typeof currentGuestbookEntries !== 'undefined') {
            renderGuestbook(currentGuestbookEntries);
        }
        // Re-render screensaver slides to update text (Ben/Dog slides)
        if (typeof initScreensaverSlides === 'function') {
            console.log("Re-initializing screensaver slides for new language...");
            initScreensaverSlides();
            // Force refresh of mantra to switch language immediately
            if (typeof updateMantra === 'function') updateMantra();
        }
    }, 0);
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
                welcomeEl.textContent = getTranslation(currentLang, 'hub.greeting_pre');
            }

            // -- REMOTE REFRESH LOGIC --
            // If admin triggers a refresh, check type and act accordingly
            if (data.refreshTrigger) {
                const lastRefresh = sessionStorage.getItem('lastRefreshTimestamp');

                // IGNORE if the trigger is older than our last refresh (avoids loop)
                // But if it's new, execute!
                if (data.refreshTrigger > (lastRefresh || 0)) {
                    console.log("Remote refresh received. Type:", data.refreshType || 'legacy');
                    sessionStorage.setItem('lastRefreshTimestamp', Date.now());

                    // Visual Feedback for User/Admin watching the screen
                    showUpdateToast("Mise à jour à distance reçue... 🔄");

                    // Full refresh: Clear ALL caches (including images) first
                    if (data.refreshType === 'full') {
                        console.log("Full refresh: Clearing all caches...");
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
                            // Wait a moment for cache clear, then reload
                            setTimeout(() => {
                                window.location.reload(true);
                            }, 1500);
                        } else {
                            setTimeout(() => window.location.reload(true), 1500);
                        }
                    } else {
                        // Soft refresh: Clear CODE cache (CSS/JS/HTML) but keep images
                        console.log("Soft refresh: Updating code only...");
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_STATIC_CACHE' });
                            setTimeout(() => {
                                window.location.reload(true);
                            }, 1000);
                        } else {
                            setTimeout(() => window.location.reload(true), 1000);
                        }
                    }
                }
                else if (!lastRefresh) {
                    // First load initialization
                    sessionStorage.setItem('lastRefreshTimestamp', Date.now());
                }
            }
        }
    });
}

// Helper: Toast Notification
function showUpdateToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '15px 30px';
    toast.style.borderRadius = '30px';
    toast.style.zIndex = '9999';
    toast.style.fontFamily = 'Montserrat, sans-serif';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    toast.style.transition = 'opacity 0.5s';
    toast.innerText = msg;

    document.body.appendChild(toast);

    // Animation in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    });
}

// -- GUESTBOOK LOGIC (Firebase Real-Time) --

// Store current Firebase entries for re-render on language change
let currentGuestbookEntries = [];

function initGuestbook() {
    console.log("Initializing Guestbook (Firebase Mode)...");

    // Listen for real-time updates
    const q = query(collection(db, "guestbook"), orderBy("timestamp", "desc"), limit(50));

    onSnapshot(q, (snapshot) => {
        const entries = [];
        snapshot.forEach((doc) => {
            entries.push({ id: doc.id, ...doc.data() });
        });
        currentGuestbookEntries = entries; // Store for re-render
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

    // Get sample entries from translations (localized)
    const sampleEntries = getTranslation(currentLang, 'guestbook.sample_entries') || [];

    // Combine: Firebase entries first (newest), then sample entries
    const allEntries = [...entries, ...sampleEntries];

    if (allEntries.length === 0) {
        const emptyText = getTranslation(currentLang, 'guestbook.empty_state') || 'Be the first to write!';
        listContainer.innerHTML = `<div style="text-align:center; width:100%; opacity:0.5; font-style:italic;">${emptyText}</div>`;
        return;
    }

    allEntries.forEach(entry => {
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
    // Set initial state
    document.body.classList.add('on-hub');

    initGuestbook();
    initGuestNameListener();
    updateGuestbookQR();

    // Init Language
    updateLanguage(currentLang);

    // Screensaver Dismissal (Critical)
    // FIX: Capture and stop event propagation to prevent clicks from reaching menus underneath
    if (screensaver) {
        screensaver.addEventListener('click', (e) => {
            // In preview mode, click shouldn't exit unless it's the close button
            // The close button has stopPropagation, so clicks reaching here are background clicks
            if (screensaver.classList.contains('preview-mode')) {
                // Do nothing on background click in preview mode (allow manual nav)
                console.log('Background click ignored in preview mode');
            } else {
                hideScreensaver(e);
            }
        }, { capture: true });
        screensaver.addEventListener('touchstart', (e) => {
            if (screensaver.classList.contains('preview-mode')) {
                // Do nothing on touch in preview mode
            } else {
                hideScreensaver(e);
            }
        }, { capture: true });
        screensaver.addEventListener('touchend', (e) => {
            // Also block touchend to prevent synthetic click events
            if (!screensaver.classList.contains('hidden')) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, { capture: true });
        console.log("Screensaver listeners attached with event capture and preview mode support.");
    } else {
        console.error("CRITICAL: Screensaver element not found for listeners.");
    }

    initScreensaverSlides(); // CRITICAL: Start slides init

    // iPad Optimization: Delay preload slightly to prioritize UI rendering
    setTimeout(() => {
        preloadScreensaverImages();
    }, 2000);

    // -- REFRESH BUTTON (Panic Button) --
    // Simple reload in case of glitches. No more hidden double-click menu here.
    const refreshBtn = document.getElementById('refresh-btn-main');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            console.log('Refresh button clicked - reloading page...');
            window.location.reload(true);
        });
    }
});

const screensaverPrompt = document.querySelector('.screensaver-prompt');
const slides = document.querySelectorAll('.slide');

// State
let idleTimer;
const IDLE_TIMEOUT = 180000; // 3 minutes in ms
let currentSlide = 0;
let slideInterval;
let isUnlockProtectionActive = false; // Protection flag to prevent accidental clicks after screensaver unlock

// -- Navigation Logic --

function openSection(sectionId) {
    // PROTECTION: Ignore clicks during the unlock protection period
    // This prevents accidental navigation when unlocking the screensaver
    if (isUnlockProtectionActive) {
        console.log('Navigation blocked - unlock protection active');
        return;
    }

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

    // Reset all sections to their initial state
    resetAllSections();
}

// Reset all sections to their initial state (called when returning to hub)
function resetAllSections() {
    // 1. Reset "Nos Adresses" to category menu (not details)
    const discoverMenu = document.getElementById('discover-menu');
    const discoverDetails = document.getElementById('discover-details');
    if (discoverMenu && discoverDetails) {
        discoverDetails.classList.remove('active');
        discoverDetails.classList.add('hidden');
        discoverMenu.classList.remove('hidden');
        discoverMenu.classList.add('active');
        // Re-render the main category menu (in case we were in a sub-menu)
        renderDiscoverMenu();
    }

    // 2. Reset Guestbook to "Write" mode
    const gbWrite = document.getElementById('guestbook-state-write');
    const gbRead = document.getElementById('guestbook-state-read');
    if (gbWrite && gbRead) {
        gbRead.classList.remove('active');
        gbRead.classList.add('hidden');
        gbWrite.classList.remove('hidden');
        gbWrite.classList.add('active');
    }

    // 3. Reset Story scroll to top
    const storyScroller = document.querySelector('.story-scroller');
    if (storyScroller) {
        storyScroller.scrollTo({ top: 0, behavior: 'instant' });
    }

    // 4. Reset all section-content scrolls to top
    document.querySelectorAll('.section-content').forEach(section => {
        section.scrollTo({ top: 0, behavior: 'instant' });
    });

    // 5. Reset horizontal scroll (address cards) to start
    document.querySelectorAll('.horizontal-scroll-container').forEach(container => {
        container.scrollTo({ left: 0, behavior: 'instant' });
    });
}

function createTempSection(id) {
    // For prototype phase, if a section is missing in HTML, alert or log
    alert(`Section "${id}" en construction!`);
    goBack();
    goBack();
}

// -- EXPOSE TO WINDOW (CRITICAL FOR HTML ONCLICK) --
window.openSection = openSection;
window.goBack = goBack;
window.resetAllSections = resetAllSections;
window.updateLanguage = updateLanguage; // Ensure this is available too

// -- SECRET PREVIEW MODE (Double-click on refresh button) --
let isPreviewMode = false;

function startPreviewMode() {
    console.log('Starting Preview Mode...');
    isPreviewMode = true;

    // FAILSAFE: Clear any pending idle (screensaver) timer
    if (idleTimer) clearTimeout(idleTimer);

    // Show screensaver without starting auto-slideshow
    screensaver.classList.remove('hidden');
    screensaver.classList.add('preview-mode');

    // Show navigation arrows
    const previewNav = document.getElementById('preview-nav');
    if (previewNav) {
        previewNav.classList.remove('hidden');
    }

    // Initialize slides if not already done
    if (!slidesNodeList || slidesNodeList.length === 0) {
        initScreensaverSlides();
    }

    // Update counter display
    updatePreviewCounter();

    // Start clock but NOT the auto-slideshow
    updateScreensaverClock();
    if (!clockInterval) clockInterval = setInterval(updateScreensaverClock, 1000);

    // Initial Mantra Update for Preview
    updateMantra();
}

function exitPreviewMode(event) {
    // In preview mode, clicking outside arrows exits
    if (!isPreviewMode) {
        hideScreensaver(event);
        return;
    }

    console.log('Exiting Preview Mode...');
    isPreviewMode = false;

    // Hide navigation arrows
    const previewNav = document.getElementById('preview-nav');
    if (previewNav) {
        previewNav.classList.add('hidden');
    }

    // Remove preview mode class
    screensaver.classList.remove('preview-mode');

    // Hide screensaver
    hideScreensaver(event);
}

function previewNextSlide() {
    if (!isPreviewMode || !slidesNodeList.length) return;

    // Hide current slide
    slidesNodeList[currentSlide].classList.remove('active');

    // Go to next (with wrap-around)
    currentSlide = (currentSlide + 1) % slidesNodeList.length;

    // Show new slide
    slidesNodeList[currentSlide].classList.add('active');

    updatePreviewCounter();
    updateMantra();
}

function previewPrevSlide() {
    if (!isPreviewMode || !slidesNodeList.length) return;

    // Hide current slide
    slidesNodeList[currentSlide].classList.remove('active');

    // Go to previous (with wrap-around)
    currentSlide = (currentSlide - 1 + slidesNodeList.length) % slidesNodeList.length;

    // Show new slide
    slidesNodeList[currentSlide].classList.add('active');

    updatePreviewCounter();
    updateMantra();
}

function updatePreviewCounter() {
    const counter = document.getElementById('preview-counter');
    if (counter && slidesNodeList.length) {
        counter.textContent = `${currentSlide + 1} / ${slidesNodeList.length}`;
    }
}

// Export preview functions to window
window.startPreviewMode = startPreviewMode;
window.exitPreviewMode = exitPreviewMode;
window.previewNextSlide = previewNextSlide;
window.previewPrevSlide = previewPrevSlide;

// -- ADMIN MODAL HELPER --
function startPreviewModeFromAdmin() {
    console.log("Admin triggering Preview Mode...");
    closeAdminModal();
    // Small delay to allow modal to close smoothly
    setTimeout(() => {
        startPreviewMode();
    }, 300);
}
window.startPreviewModeFromAdmin = startPreviewModeFromAdmin;

// Note: Initial state and preload are handled in the main DOMContentLoaded listener above

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
                // ============================================================
                // 🔒 LOCKED DESIGN - DO NOT MODIFY WITHOUT VALIDATION
                // This section (Dog Slide V4) is validated and pixel-perfect.
                // It handles Multilingual Text + Mantra Blocking.
                // ============================================================
                // -- SPECIAL CASE: Dog Slide (Validé Pixel Perfect V4) --
                slide.setAttribute('data-text-slide', 'true');
                slide.classList.add('no-mantra');

                const container = document.createElement('div');
                container.className = 'dog-slide-container';

                const leftPanel = document.createElement('div');
                leftPanel.className = 'dog-slide-left';

                // Title
                const title = document.createElement('h1');
                title.className = 'dog-slide-title';
                title.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.title');
                leftPanel.appendChild(title);

                // Intro
                const intro = document.createElement('p');
                intro.className = 'dog-slide-intro';
                intro.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.intro');
                leftPanel.appendChild(intro);

                // Secret Box
                const secretBox = document.createElement('div');
                secretBox.className = 'dog-slide-secret';

                const secretTitle = document.createElement('div');
                secretTitle.className = 'dog-slide-secret-title';
                secretTitle.textContent = getTranslation(currentLang, 'screensaver.dog_slide.secret_title');
                secretBox.appendChild(secretTitle);

                const secretContent = document.createElement('div');
                secretContent.className = 'dog-slide-secret-content';
                secretContent.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.secret_content');
                secretBox.appendChild(secretContent);

                leftPanel.appendChild(secretBox);

                // CTA
                const cta = document.createElement('div');
                cta.className = 'dog-slide-cta';
                cta.textContent = getTranslation(currentLang, 'screensaver.dog_slide.cta');
                leftPanel.appendChild(cta);

                // Feedback (Uses innerHTML for strong tag from translations)
                const feedback = document.createElement('div');
                feedback.className = 'dog-slide-feedback';
                feedback.innerHTML = getTranslation(currentLang, 'screensaver.dog_slide.feedback');
                leftPanel.appendChild(feedback);

                container.appendChild(leftPanel);

                // Right Panel (Image)
                const rightPanel = document.createElement('div');
                rightPanel.className = 'dog-slide-right';
                rightPanel.style.backgroundImage = `url('${imgSrc}')`;

                container.appendChild(rightPanel);
                slide.appendChild(container);

            } else if (imgSrc.includes('slide_ben_overlay.jpg')) {
                // ============================================================
                // 🔒 LOCKED DESIGN - DO NOT MODIFY WITHOUT VALIDATION
                // This section (Ben Slide) is validated.
                // ============================================================
                // -- SPECIAL CASE: Ben Slide (Validé Pixel Perfect) --
                slide.setAttribute('data-text-slide', 'true');

                const card = document.createElement('div');
                card.className = 'ben-slide-card';

                // Sun Icon
                const sunIcon = document.createElement('div');
                sunIcon.className = 'ben-slide-sun';
                // Using SVG directly
                sunIcon.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                card.appendChild(sunIcon);

                // Quote
                const quote = document.createElement('div');
                quote.className = 'ben-slide-quote';
                quote.textContent = getTranslation(currentLang, 'screensaver.ben_slide.text_main');
                card.appendChild(quote);

                // More Info Label
                const moreInfo = document.createElement('div');
                moreInfo.className = 'ben-slide-info';
                moreInfo.textContent = getTranslation(currentLang, 'screensaver.ben_slide.more_info');
                card.appendChild(moreInfo);

                // QR Section
                const qrSection = document.createElement('div');
                qrSection.className = 'ben-slide-qr-section';

                const qrBox = document.createElement('div');
                qrBox.className = 'ben-slide-qr-box';
                const qrImg = document.createElement('img');
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + encodeURIComponent('https://entrepreneuraligne.fr');
                qrImg.width = 90;
                qrBox.appendChild(qrImg);
                qrSection.appendChild(qrBox);

                const qrSub = document.createElement('span');
                qrSub.className = 'ben-slide-qr-sub';
                qrSub.textContent = getTranslation(currentLang, 'screensaver.ben_slide.qr_sub');
                qrSection.appendChild(qrSub);

                card.appendChild(qrSection);

                // Signature
                const sigBlock = document.createElement('div');
                sigBlock.className = 'ben-slide-signature';

                // Add robust class for mantra suppression
                slide.classList.add('no-mantra');

                const sigName = document.createElement('span');
                sigName.className = 'ben-slide-sig-name';
                sigName.textContent = getTranslation(currentLang, 'screensaver.ben_slide.sig_name');
                sigBlock.appendChild(sigName);

                const sigRole = document.createElement('span');
                sigRole.className = 'ben-slide-sig-role';
                sigRole.textContent = getTranslation(currentLang, 'screensaver.ben_slide.sig_role');
                sigBlock.appendChild(sigRole);

                card.appendChild(sigBlock);
                slide.appendChild(card);

                // Background
                slide.style.backgroundImage = `url('${imgSrc}')`;
                slide.style.backgroundSize = 'cover';
                slide.style.backgroundPosition = 'center center';

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
    // IGNORE IDLE TIMER logic if in Preview Mode (prevents auto-exit on mousemove)
    if (isPreviewMode) return;

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

function hideScreensaver(event) {
    // FAILSAFE: If in Preview Mode, DO NOT HIDE SCREENSAVER via this generic function
    // You must use exitPreviewMode() instead.
    if (isPreviewMode) {
        console.log('hideScreensaver ignored due to Preview Mode');
        return;
    }

    // Stop the event from propagating to elements underneath
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Only process if screensaver is actually visible
    if (screensaver.classList.contains('hidden')) return;

    screensaver.classList.add('hidden');
    stopSlideshow();

    // Activate unlock protection - block menu clicks for 500ms
    isUnlockProtectionActive = true;
    setTimeout(() => {
        isUnlockProtectionActive = false;
    }, 500);

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

// NOTE: reloadTimer and checkAndReload removed - refresh is now admin-controlled only

function stopSlideshow() {
    if (slideTimeout) clearTimeout(slideTimeout);
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
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
        if (currentImg.includes('slide_dog_message.png')) {
            duration = 420000; // 7 minutes for Dog Message
        } else {
            duration = 420000; // 7 minutes for other text slides (Benjamin)
        }
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
        if (currentImg.includes('slide_review_ohana.jpg') ||
            currentImg.includes('slide_ben_overlay.jpg') ||
            currentImg.includes('slide_dog_message.png')) {
            clockEl.style.opacity = '0';
            clockEl.style.transition = 'opacity 0.5s ease';
        } else {
            clockEl.style.opacity = '1';
        }
    }

    // Update Mantra occasionally
    updateMantra();
}

// Note: Weather & Time widget logic is consolidated below (see fetchWeather and updateTime functions)

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
// Mantras are now in translations.js
// Improved: Uses a deck system that ensures ALL mantras are shown before any repeats
let mantraDeck = [];
let lastShownMantra = null; // Prevent immediate repeat after reshuffle

function getNextMantra() {
    const localizedMantras = getTranslation(currentLang, 'mantras') || [];

    // If deck is empty or has only one item left and it's the same as last shown
    if (mantraDeck.length === 0) {
        // Refill deck with all mantras
        mantraDeck = [...localizedMantras];
        shuffleArray(mantraDeck);

        // If the first mantra after reshuffle is the same as the last one shown,
        // move it to the end to avoid immediate repetition
        if (mantraDeck.length > 1 && mantraDeck[mantraDeck.length - 1] === lastShownMantra) {
            const first = mantraDeck.pop();
            mantraDeck.unshift(first); // Move to beginning (will be shown last)
        }
        // console.log("Refilled Mantra Deck for lang:", currentLang, "Total:", mantraDeck.length);
    }

    // Get next mantra from deck
    const mantra = mantraDeck.pop();

    // Skip empty strings (safeguard)
    if (!mantra && mantraDeck.length > 0) {
        return getNextMantra(); // Recursively get next valid one
    }

    lastShownMantra = mantra;
    return mantra;
}

function updateMantra() {
    // Race Condition Fix: Always clear pending mantra show
    if (mantraTimer) clearTimeout(mantraTimer);

    const mantraEl = document.getElementById('ss-mantra-text');
    const container = document.querySelector('.screensaver-mantra-wrapper');
    if (!mantraEl || !container) return;

    // Check if current slide should hide Mantra (Text Slides)
    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide) {
        // Method 0: Check robust 'no-mantra' class (Added for Ben/Dog slides)
        if (activeSlide.classList.contains('no-mantra')) {
            container.style.opacity = '0';
            container.style.display = 'none';
            return;
        }

        // Method 1: Check data attribute for special layout slides (Ben, Dog)
        if (activeSlide.getAttribute('data-text-slide') === 'true') {
            // FORCE HIDE
            container.style.opacity = '0';
            container.style.display = 'none';
            return;
        }

        // Method 2: Robust Content Check (Ben & Dog)
        // Checks if the slide contains specific structures even if attributes are missing
        if (activeSlide.querySelector('.ben-slide-card') ||
            activeSlide.querySelector('.dog-slide-container')) {

            container.style.opacity = '0';
            container.style.display = 'none'; // FORCE IMMEDIATE HIDE
            return;
        }

        // Method 3: Check inline background image to match filename
        let bg = activeSlide.style.backgroundImage || ''; // Inline style preferred

        // Fix: If inline is empty, try to find child with class slide-img or any div with bg
        if (!bg || bg === 'none') {
            const imgLayer = activeSlide.querySelector('.slide-img');
            if (imgLayer) {
                bg = imgLayer.style.backgroundImage || '';
            }
        }

        if (isTextSlide(bg)) {
            container.style.opacity = '0';
            container.style.display = 'none';
            return;
        }
    }

    // Get next unique mantra from deck
    const text = getNextMantra();

    // Smooth Transition: Fade Out -> Change -> Fade In
    container.style.opacity = '0';

    // Race Condition Fix: Store timer to clear it if slide changes rapidly
    if (mantraTimer) clearTimeout(mantraTimer);

    mantraTimer = setTimeout(() => {
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

// Global timer variable
let mantraTimer;

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

// Widget Interaction + Hidden Admin Trigger (Triple-tap)
const weatherWidget = document.querySelector('.weather-widget');
let tapCount = 0;
let tapTimeout = null;

if (weatherWidget) {
    weatherWidget.addEventListener('click', (e) => {
        tapCount++;

        // Quadruple-tap = Preview Mode (4 taps)
        if (tapCount === 4) {
            tapCount = 0;
            clearTimeout(tapTimeout);
            console.log('4 taps detected - starting preview mode');
            if (typeof window.startPreviewMode === 'function') {
                window.startPreviewMode();
            }
            return;
        }

        // Triple-tap = Admin Modal (3 taps)
        if (tapCount === 3) {
            // Wait briefly to see if 4th tap comes
            clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                if (tapCount === 3) {
                    console.log('3 taps detected - opening admin');
                    tapCount = 0;
                    openAdminModal();
                }
            }, 300);
            return;
        }

        // Reset after 600ms
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => {
            if (tapCount < 3) {
                // Normal click - expand widget
                weatherWidget.classList.toggle('expanded');
            }
            tapCount = 0;
        }, 600);

        e.stopPropagation();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!weatherWidget.contains(e.target) && weatherWidget.classList.contains('expanded')) {
            weatherWidget.classList.remove('expanded');
        }
    });
}

// --- Keyboard Shortcut for Preview Mode (Mac testing) ---
document.addEventListener('keydown', (e) => {
    // Shift+P = Preview Mode
    if (e.shiftKey && e.key === 'P') {
        console.log('Shift+P pressed - starting preview mode');
        if (typeof window.startPreviewMode === 'function') {
            window.startPreviewMode();
        }
    }
});

// --- Hidden Admin Functions ---
function openAdminModal() {
    const modal = document.getElementById('hidden-admin-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Inject current version if not already there
        const title = modal.querySelector('h3');
        if (title && !title.textContent.includes('v22')) {
            title.innerHTML = '🔧 Admin <span style="font-size:0.4em; opacity:0.5; vertical-align:middle;">v22</span>';
        }
    }
}

function closeAdminModal() {
    const modal = document.getElementById('hidden-admin-modal');
    if (modal) modal.style.display = 'none';
}

function doSmartRefresh() {
    // Clear static cache only (keep images)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_STATIC_CACHE' });
        alert('📦 Cache code vidé. Rechargement...');
        setTimeout(() => window.location.reload(true), 500);
    } else {
        window.location.reload(true);
    }
}

function doFullRefresh() {
    // Clear ALL caches
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(reg => reg.unregister());
        });
    }
    alert('🗑️ Cache complet vidé. Rechargement...');
    setTimeout(() => window.location.reload(true), 1000);
}

// Expose to global scope
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.doSmartRefresh = doSmartRefresh;
window.doFullRefresh = doFullRefresh;

// Init Widget
updateTime();
fetchWeather();

// Updates
setInterval(updateTime, 60000); // Every minute
setInterval(fetchWeather, 1800000); // Every 30 mins
// -- Discover Section Logic (Refactored) --
// Data is now in translations.js


function renderDiscoverMenu() {
    const container = document.querySelector('.discover-categories-grid');
    if (!container) return;

    const discoverData = getTranslation(currentLang, 'discover');
    if (!discoverData) return;

    // Reset Header logic in case we came back from Sub-menu
    const headerTitle = document.querySelector('#discover-menu h2');
    if (headerTitle) headerTitle.textContent = getTranslation(currentLang, 'discover.title');

    const backBtn = document.querySelector('#discover-menu .back-btn');
    backBtn.onclick = goBack; // Reset to Hub navigation

    container.innerHTML = ''; // Verify clean state

    Object.keys(discoverData).forEach(key => {
        if (key === 'title') return; // Skip title key

        const cat = discoverData[key];
        // FIX: Ignore keys that are NOT objects (like "scan_route_1" etc.) or null
        if (!cat || typeof cat !== 'object') return;


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
    const discoverData = getTranslation(currentLang, 'discover');
    const cat = discoverData && discoverData[catKey];
    if (!cat) return;

    // Handle Sub-categories Logic
    if (cat.hasSubcategories) {
        renderSubMenu(cat);
        return;
    }

    // Populate Details
    // Using string interpolation for title might have already been done in renderSubMenu/renderDiscoverMenu if we passed objects,
    // but here we are passing raw strings for 'title' which is fine as they are from localized object.
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
                    <div class="place-qr-text">${getTranslation(currentLang, 'discover.scan_route_1')}<br><strong>${getTranslation(currentLang, 'discover.scan_route_2')}</strong></div>
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

// NOTE: Auto-reload removed - refresh is now admin-controlled only
// This reduces Netlify bandwidth by preventing automatic page reloads





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
