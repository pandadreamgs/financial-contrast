let currentLang = 'ua';
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };
let financialData = { left: null, right: null };
let drift = { left: 1, right: 1 };
let langLabels = {}; // Сюди завантажимо назви мов

const multipliers = {
    sec: 1, min: 60, hour: 3600, day: 86400,
    week: 604800, month: 2592000, year: 31536000
};

const rateFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

async function init() {
    currentLang = localStorage.getItem('lang') || 'ua';
    applyInitialTheme();
    await loadLanguage(currentLang);
    setupEventListeners();
    startTickers();
}

async function loadLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    try {
        const [main, nasa, musk] = await Promise.all([
            fetch(`i18n/${lang}/main.json`).then(r => r.json()),
            fetch(`i18n/${lang}/data/nasa.json`).then(r => r.json()),
            fetch(`i18n/${lang}/data/elon-musk.json`).then(r => r.json())
        ]);

        financialData.left = nasa;
        financialData.right = musk;

        // Завантажуємо назви всіх мов для списку
        const availableLangs = ['ua', 'en']; 
        for (let l of availableLangs) {
            if (!langLabels[l]) {
                const res = await fetch(`i18n/${l}/main.json`).then(r => r.json());
                langLabels[l] = res.ui.lang;
            }
        }

        applyMainTexts(main);
        renderLangSelector();
        updateUI();
    } catch (e) { console.error("Error loading language", e); }
}

function applyMainTexts(main) {
    document.getElementById('mainTitle').innerText = main.ui.title;
    document.getElementById('leftCumLabel').innerText = main.ui.cumulative_label;
    document.getElementById('rightCumLabel').innerText = main.ui.cumulative_label;
}

function renderLangSelector() {
    const selector = document.getElementById('langSelector');
    const dropdown = document.getElementById('langDropdown');
    const availableLangs = ['ua', 'en'];

    // Кнопка: прапор + назва поточної мови
    selector.innerHTML = `
        <img src="i18n/${currentLang}/${currentLang.toUpperCase()}.png">
        <span>${langLabels[currentLang]}</span>
    `;

    // Список: всі інші мови
    dropdown.innerHTML = availableLangs.map(l => `
        <div class="lang-item" onclick="loadLanguage('${l}')">
            <img src="i18n/${l}/${l.toUpperCase()}.png">
            <span>${langLabels[l]}</span>
        </div>
    `).join('');
}

function toggleLangMenu(e) {
    e.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('active');
}

// Закриваємо меню при кліку в будь-якому місці
window.onclick = () => {
    document.getElementById('langDropdown').classList.remove('active');
};

function toggleMode(side, mode) {
    cardModes[side] = mode;
    document.querySelectorAll(`#${side}Card .mode-switcher button`).forEach(b => b.classList.remove('active'));
    document.getElementById(`${side}Btn${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
    document.getElementById(`${side}Card`).className = `card ${mode}`;
    updateUI();
}

function updateUI() {
    ["left", "right"].forEach(side => {
        const data = financialData[side];
        if (!data) return;
        const mode = cardModes[side];
        const container = document.getElementById(`${side}Details`);
        const breakdown = data.data[currentYear][mode].breakdown;
        container.innerHTML = Object.values(breakdown).map(item => 
            `<div class="detail-item"><span>${item.name}</span><b>${item.percent}%</b></div>`
        ).join('');
    });
}

function startTickers() {
    const update = () => {
        const now = new Date();
        const startOfSelectedYear = new Date(parseInt(currentYear), 0, 1);
        let secondsPassed = (now - startOfSelectedYear) / 1000;

        ["left", "right"].forEach(side => {
            const data = financialData[side];
            if (!data) return;
            const mode = cardModes[side];
            const baseTotal = data.data[currentYear][mode].total;
            const basePerSec = baseTotal / multipliers.year;

            let displayCumulative = 0;
            if (currentYear === "2026") {
                drift[side] += (Math.random() - 0.5) * 0.002;
                drift[side] = Math.max(0.95, Math.min(drift[side], 1.05));
                displayCumulative = secondsPassed * basePerSec;
            } else {
                drift[side] = 1;
                displayCumulative = baseTotal;
            }

            const currentRate = basePerSec * drift[side] * multipliers[currentTimeUnit];
            
            document.getElementById(`${side}Name`).innerText = data.name;
            document.getElementById(`${side}Icon`).src = data.image;
            document.getElementById(`${side}Rate`).innerText = (['sec', 'min'].includes(currentTimeUnit)) ? rateFormatter.format(currentRate) : wholeFormatter.format(currentRate);
            document.getElementById(`${side}Cumulative`).innerText = wholeFormatter.format(displayCumulative);
            document.getElementById(`${side}Unit`).innerText = `/ ${currentTimeUnit}`;
            document.getElementById(`${side}Approx`).style.visibility = (currentYear === "2026") ? "visible" : "hidden";

            const h = (basePerSec / 10000) * 100;
            document.getElementById(`${side}Bar`).style.height = `${Math.min(Math.max(h, 10), 95)}%`;
        });
        requestAnimationFrame(update);
    };
    update();
}

function setupEventListeners() {
    document.getElementById('timeTabs').onclick = (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#timeTabs button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeUnit = e.target.dataset.unit;
        }
    };
    document.getElementById('yearSelector').onclick = (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#yearSelector button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentYear = e.target.innerText;
            updateUI();
        }
    };
}

function applyInitialTheme() {
    const t = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', t);
    document.getElementById('themeToggle').innerText = t === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeToggle').innerText = next === 'dark' ? '🌙' : '☀️';
}

init();
                                             
