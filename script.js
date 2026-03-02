let currentLang = 'ua';
const availableLangs = ['ua', 'en']; 
const entityList = ['nasa', 'elon-musk', 'bezos'];
let langDataCache = {}; 
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };
let financialData = { left: null, right: null };
let drift = { left: 1, right: 1 };
let entityCache = {};

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
        const main = await fetch(`i18n/${lang}/main.json`).then(r => r.json());
        applyMainTexts(main);
        
        // Завантажуємо дані для всіх сутностей зі списку
        const entityPromises = entityList.map(id => 
            fetch(`i18n/${lang}/data/${id}.json`).then(r => r.json())
        );
        const entities = await Promise.all(entityPromises);
        
        // Зберігаємо в кеш для швидкого перемикання
        entities.forEach(e => entityCache[e.id] = e);

        // Початковий вибір (якщо ще нічого не вибрано)
        if (!financialData.left) financialData.left = entityCache['nasa'];
        if (!financialData.right) financialData.right = entityCache['elon-musk'];
        
        // Оновлюємо дані, якщо мова змінилася (беремо свіжі переклади з кешу)
        financialData.left = entityCache[financialData.left.id];
        financialData.right = entityCache[financialData.right.id];

        renderLangSelector();
        renderEntityMenus();
        updateUI();
    } catch (e) { console.error("Error loading language/data", e); }
}

function renderEntityMenus() {
    // Групуємо сутності за категоріями для "гармошки"
    const categories = {};
    Object.values(entityCache).forEach(entity => {
        if (!categories[entity.category]) categories[entity.category] = [];
        categories[entity.category].push(entity);
    });

    ['left', 'right'].forEach(side => {
        const dropdown = document.getElementById(`${side}EntityMenu`);
        dropdown.innerHTML = Object.keys(categories).map(cat => `
            <div class="category-group">
                <div class="category-name">${cat}</div>
                ${categories[cat].map(e => `
                    <div class="entity-item" onclick="selectEntity('${side}', '${e.id}', event)">
                        <img src="${e.image}">
                        <span>${e.name}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    });
}

function toggleEntityMenu(side, event) {
    event.stopPropagation();
    const menu = document.getElementById(`${side}EntityMenu`);
    const otherMenu = document.getElementById(side === 'left' ? 'rightEntityMenu' : 'leftEntityMenu');
    otherMenu.classList.remove('active');
    menu.classList.toggle('active');
}

function selectEntity(side, id, event) {
    event.stopPropagation();
    financialData[side] = entityCache[id];
    document.getElementById(`${side}EntityMenu`).classList.remove('active');
    updateUI();
}

window.addEventListener('click', () => {
    document.querySelectorAll('.entity-dropdown').forEach(m => m.classList.remove('active'));
});

function applyMainTexts(main) {
    document.getElementById('mainTitle').innerText = main.ui.title;

    window.uiLabels = {
        income: main.ui.income_label,
        spent: main.ui.spent_label,
        loss: main.ui.loss_label
    };

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
        
        container.innerHTML = Object.values(breakdown).map(item => {
            // --- РОЗУМНА ЛОГІКА КОЛЬОРУ ---
            // 1. Якщо ми в режимі витрат (spending) — все червоне.
            // 2. Якщо в доходах (income): 
            //    - якщо відсоток мінусовий — червоне (збиток)
            //    - якщо відсоток плюсовий — зелене (прибуток)
            
            let barColor = 'var(--green-accent)';
            
            if (mode === 'spending' || item.percent < 0) {
                barColor = 'var(--red-accent)';
            }

            // Для відображення тексту використовуємо Math.abs, 
            // щоб не малювати мінус перед відсотками в інтерфейсі (за бажанням)
            const displayPercent = Math.abs(item.percent);

            return `
                <div class="detail-item">
                    <div class="detail-info">
                        <span>${item.name}</span>
                        <b>${displayPercent}%</b>
                    </div>
                    <div class="mini-progress-bg">
                        <div class="mini-progress-bar" style="width: ${displayPercent}%; background: ${barColor}"></div>
                    </div>
                </div>
            `;
        }).join('');
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
                const val = Math.abs(data.data[year][mode].total); // Використовуємо абсолютне значення
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

            // --- НОВА ЛОГІКА ВИБОРУ ЯРЛИКА (Підпис під великим числом) ---
            let labelText = "";
            if (window.uiLabels) {
                if (mode === 'spending') {
                    labelText = window.uiLabels.spent;
                } else {
                    // Якщо доходи, але число мінусове (втрата капіталу)
                    labelText = (yearlyTotal >= 0) ? window.uiLabels.income : window.uiLabels.loss;
                }
                const labelElement = document.getElementById(`${side}CumLabel`);
                if (labelElement) labelElement.innerText = labelText;
            }
            // -----------------------------------------------------------

            const visualizer = document.getElementById(`${side}Visualizer`);
            if (visualizer) {
                if (visualizer.children.length !== 12) {
                    visualizer.innerHTML = Array(12).fill('<div class="bar-column"></div>').join('');
                }

                const columns = visualizer.children;
                const currentMonth = now.getMonth();
                const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
                const monthProgress = now.getDate() / daysInMonth;

                // Перевіряємо, чи загальний результат року від'ємний
                const isYearlyLoss = yearlyTotal < 0;

                for (let i = 0; i < 12; i++) {
                    const col = columns[i];
                    
                    const baseHeight = (Math.abs(yearlyTotal) / currentContextMax) * 100;

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
                    
                    // --- ЛОГІКА КОЛЬОРУ ГРАФІКА ---
                    // Якщо режим 'spending' АБО якщо доходи пішли в мінус — малюємо червоним
                    const color = (mode === 'spending' || isYearlyLoss) ? '#ff4d4d' : '#00ff88';
                    const shadow = (mode === 'spending' || isYearlyLoss) ? 'rgba(255, 77, 77, 0.3)' : 'rgba(0, 255, 136, 0.3)';
                    
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
