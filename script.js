let currentLang = 'ua';
const availableLangs = ['ua', 'en']; 
let langDataCache = {}; 
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };
let financialData = { left: null, right: null };
let drift = { left: 1, right: 1 };

const multipliers = {
    sec: 1, min: 60, hour: 3600, day: 86400,
    week: 604800, month: 2592000, year: 31536000
};

const rateFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

async function init() {
    currentLang = localStorage.getItem('lang') || 'ua';
    applyInitialTheme();
    await preloadLangNames();
    await loadLanguage(currentLang);
    setupEventListeners();
    startTickers();
}

async function preloadLangNames() {
    for (let lang of availableLangs) {
        try {
            const res = await fetch(`i18n/${lang}/main.json`).then(r => r.json());
            langDataCache[lang] = {
                langName: res.ui.lang,  
                shortName: res.ui.short 
            };
        } catch (e) { console.error(`Failed to preload ${lang}`, e); }
    }
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
        applyMainTexts(main);
        renderLangSelector();
        updateUI();
    } catch (e) { console.error("Error loading language", e); }
}

function applyMainTexts(main) {
    document.getElementById('mainTitle').innerText = main.ui.title;
    
    document.getElementById('leftCumLabel').innerText = main.ui.cumulative_label;
    document.getElementById('rightCumLabel').innerText = main.ui.cumulative_label;
    document.getElementById('leftBtnSpending').innerText = main.ui.spending;
    document.getElementById('rightBtnSpending').innerText = main.ui.spending;
    document.getElementById('leftBtnIncome').innerText = main.ui.income;
    document.getElementById('rightBtnIncome').innerText = main.ui.income;

    // Оновлюємо кнопки перемикання одиниць часу
    Object.keys(main.ui.units).forEach(key => {
        const btn = document.getElementById(`unit_${key}`);
        if (btn) btn.innerText = main.ui.units[key];
    });

    document.getElementById('donateTitle').innerText = main.donate.title;
    document.getElementById('donateDesc').innerText = main.donate.desc;
    document.getElementById('seoText').innerHTML = main.seo_text;
    document.getElementById('footerCreated').innerText = main.ui.footer_created;
    document.getElementById('footerSlogan').innerText = main.ui.footer_slogan;
    
    // Зберігаємо переклади юнітів глобально, щоб тікер міг їх брати
    window.langUnits = main.ui.units;
}

function renderLangSelector() {
    const selector = document.getElementById('langSelector');
    const dropdown = document.getElementById('langDropdown');
    const current = langDataCache[currentLang];
    
    selector.innerHTML = `
        <img src="i18n/${currentLang}/${currentLang.toUpperCase()}.png">
        <span>${current ? current.shortName : currentLang.toUpperCase()}</span>
        <span class="arrow-down">▼</span>
    `;
    
    dropdown.innerHTML = availableLangs.map(l => `
        <div class="lang-item" onclick="loadLanguage('${l}')">
            <img src="i18n/${l}/${l.toUpperCase()}.png">
            <span>${langDataCache[l] ? langDataCache[l].langName : l}</span>
        </div>
    `).join('');
}

function toggleLangMenu(event) {
    event.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('active');
}

window.onclick = () => document.getElementById('langDropdown').classList.remove('active');

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeToggle').innerText = next === 'dark' ? '🌙' : '☀️';
}

function applyInitialTheme() {
    const t = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', t);
    document.getElementById('themeToggle').innerText = t === 'dark' ? '🌙' : '☀️';
}

function toggleMode(side, mode) {
    cardModes[side] = mode;
    document.querySelectorAll(`#${side}Card .mode-switcher button`).forEach(b => b.classList.remove('active'));
    const btnId = side === 'left' ? (mode === 'spending' ? 'leftBtnSpending' : 'leftBtnIncome') : (mode === 'spending' ? 'rightBtnSpending' : 'rightBtnIncome');
    document.getElementById(btnId).classList.add('active');
    document.getElementById(`${side}Card`).className = `card ${mode}`;
    updateUI();
}

function updateUI() {
    ["left", "right"].forEach(side => {
        const data = financialData[side];
        if (!data || !data.data[currentYear]) return;
        const mode = cardModes[side];
        const container = document.getElementById(`${side}Details`);
        const breakdown = data.data[currentYear][mode].breakdown;
        
        container.innerHTML = Object.values(breakdown).map(item => `
            <div class="detail-item">
                <div class="detail-info">
                    <span>${item.name}</span>
                    <b>${item.percent}%</b>
                </div>
                <div class="mini-progress-bg">
                    <div class="mini-progress-bar" style="width: ${item.percent}%; background: ${mode === 'spending' ? 'var(--red-accent)' : 'var(--green-accent)'}"></div>
                </div>
            </div>
        `).join('');
    });
}

function startTickers() {
    const update = () => {
        const now = new Date();
        const startOfYear = new Date(parseInt(currentYear), 0, 1);
        let secondsPassed = (now - startOfYear) / 1000;

        // --- НОВА ЛОГІКА МАСШТАБУВАННЯ ---
        // Знаходимо найбільше значення серед вибраних режимів за всі роки
        let currentContextMax = 0;
        ["left", "right"].forEach(side => {
            const data = financialData[side];
            const mode = cardModes[side]; // Дивимось, що вибрано: spending чи income
            if (!data) return;

            Object.keys(data.data).forEach(year => {
                const val = data.data[year][mode].total;
                if (val > currentContextMax) currentContextMax = val;
            });
        });
        currentContextMax = currentContextMax || 1; // Захист від 0
        // --------------------------------

        ["left", "right"].forEach(side => {
            const data = financialData[side];
            if (!data || !data.data[currentYear]) return;
            
            const mode = cardModes[side];
            const yearlyTotal = data.data[currentYear][mode].total;
            const basePerSec = yearlyTotal / multipliers.year;

            let cumulative = (currentYear === "2026") ? secondsPassed * basePerSec : yearlyTotal;
            if (currentYear === "2026") {
                drift[side] += (Math.random() - 0.5) * 0.002;
                drift[side] = Math.max(0.95, Math.min(drift[side], 1.05));
            } else { drift[side] = 1; }

            const rate = basePerSec * drift[side] * multipliers[currentTimeUnit];
            
            document.getElementById(`${side}Name`).innerText = data.name;
            document.getElementById(`${side}Icon`).src = data.image;
            document.getElementById(`${side}Rate`).innerText = (['sec', 'min'].includes(currentTimeUnit)) ? rateFormatter.format(rate) : wholeFormatter.format(rate);
            document.getElementById(`${side}Cumulative`).innerText = wholeFormatter.format(cumulative);
            document.getElementById(`${side}Unit`).innerText = window.langUnits ? window.langUnits[currentTimeUnit] : `/${currentTimeUnit}`;

            const visualizer = document.getElementById(`${side}Visualizer`);
            if (visualizer) {
                if (visualizer.children.length !== 12) {
                    visualizer.innerHTML = Array(12).fill('<div class="bar-column"></div>').join('');
                }

                const columns = visualizer.children;
                const currentMonth = now.getMonth();
                const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
                const monthProgress = now.getDate() / daysInMonth;

                for (let i = 0; i < 12; i++) {
                    const col = columns[i];
                    
                    // Тепер baseHeight рахується від динамічного currentContextMax
                    const baseHeight = (yearlyTotal / currentContextMax) * 100;

                    let heightPercent = 0;
                    if (i < currentMonth || currentYear !== "2026") {
                        heightPercent = ((i + 1) / 12) * baseHeight;
                        col.className = 'bar-column active';
                    } else if (i === currentMonth && currentYear === "2026") {
                        const prevHeight = (i / 12) * baseHeight;
                        const thisMonthMax = (1 / 12) * baseHeight;
                        heightPercent = prevHeight + (thisMonthMax * monthProgress);
                        col.className = 'bar-column active current';
                    } else {
                        heightPercent = ((i + 1) / 12) * baseHeight;
                        col.className = 'bar-column';
                    }

                    col.style.height = `${Math.max(heightPercent, 2)}%`;
                    
                    const color = (mode === 'spending') ? '#ff4d4d' : '#00ff88';
                    const shadow = (mode === 'spending') ? 'rgba(255, 77, 77, 0.3)' : 'rgba(0, 255, 136, 0.3)';
                    col.style.setProperty('--accent-color', color);
                    col.style.setProperty('--accent-shadow', shadow);
                }
            }
        });
        requestAnimationFrame(update);
    };
    update();
}

function setupEventListeners() {
    document.getElementById('timeTabs').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#timeTabs button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeUnit = e.target.dataset.unit;
        }
    });
    document.getElementById('yearSelector').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#yearSelector button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentYear = e.target.innerText;
            updateUI();
        }
    });
}

init();
