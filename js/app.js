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
    // Hide Hub
    document.getElementById('view-hub').classList.remove('active');

    // Show Target Section
    // Note: We need to actually create the sections in HTML first, 
    // for now this is just a placeholder logic to prove interaction.
    const targetSection = document.getElementById(`view-${sectionId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    } else {
        console.warn(`Section ${sectionId} not found, creating temp view...`);
        // Fallback for visual testing if section doesn't exist yet
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
    slideInterval = setInterval(nextSlide, 8000);
}

function stopSlideshow() {
    if (slideInterval) clearInterval(slideInterval);
}

function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
}

// -- Event Listeners --

// Detect any interaction to reset timer
const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
events.forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
});

// Initialize
resetIdleTimer(); // Start the timer
// Ensure Hub is active
document.getElementById('view-hub').classList.add('active');

// -- Hero Slideshow Logic --
const heroImages = [
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=2000&auto=format&fit=crop', // Vue Bali
    'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?q=80&w=2000&auto=format&fit=crop', // Interior Room
    'https://images.unsplash.com/photo-1510525009512-ad7fc13eefab?q=80&w=2000&auto=format&fit=crop', // Pool details
    'https://images.unsplash.com/photo-1627254598128-4ee4540d6c81?q=80&w=2000&auto=format&fit=crop', // Zen Garden
    'https://images.unsplash.com/photo-1604812329355-635fa7c04130?q=80&w=2000&auto=format&fit=crop'  // Living room
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
