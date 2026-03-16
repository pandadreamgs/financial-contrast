let currentLang = 'ua';
const availableLangs = ['ua', 'en']; 
const entityList = ['african-union', 'amazon', 'amnesty-international', 'apple', 'arab-league', 'asean', 'bernard-arnault', 'bezos', 'bill-gates', 'bundeswehr',
                    'cern', 'china', 'coca-cola', 'cristiano-ronaldo', 'department-of-energy', 'disney', 'dubai', 'eda', 'elon-musk', 'emirates', 'esa', 'european-union',
                    'faa', 'fbi', 'fifa', 'g7', 'gates-foundation', 'google', 'greenpeace', 'healthcare-canada', 'hong-kong', 'iceland', 'imf', 'indian-railways', 'irs',
                    'japan-post-holdings', 'jensen-huang', 'kyiv', 'larry-ellison', 'london', 'los-angeles', 'mara', 'mark-zuckerberg', 'microsoft', 'monaco', 'mrbeast',
                    'msf', 'mukesh-ambani', 'nasa', 'nato', 'netflix', 'new-york', 'nhs', 'north-korea', 'open-society', 'paris', 'pbc', 'pentagon', 'red-cross',
                    'rf-ministry-defense', 'rotary-foundation', 'salvation-army', 'saudi-aramco', 'seoul', 'shanghai', 'singapore', 'south-sudan', 'switzerland', 'taylor-swift',
                    'terrorist-country', 'tokio', 'toyota', 'tsmc', 'tuvalu', 'ua-ministry-defense', 'uk-ministry-defense', 'ukraine', 'un', 'unicef', 'us-defence-department',
                    'us-department-education', 'usa', 'vatican', 'walmart', 'warren-buffett', 'wellcome-trust', 'who', 'world-bank', 'wwf'];

let langDataCache = {}; 
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };
let financialData = { left: null, right: null };
let drift = { left: 1, right: 1 };
let displayValues = { leftCumulative: 0, rightCumulative: 0, leftRate: 0, rightRate: 0 };
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

    window.uiLabels = {
        shareText: main.ui.share_text,
        income: main.ui.income_label,
        spent: main.ui.spent_label,
        loss: main.ui.loss_label,
        errorScreenshot: main.ui.error_screenshot
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
            
            let barColor = 'var(--green-accent)';
            
            if (mode === 'spending' || item.percent < 0) {
                barColor = 'var(--red-accent)';
            }

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
        const methElement = document.getElementById(`${side}Methodology`);
        if (methElement && data.data[currentYear].methodology) {
            methElement.innerText = data.data[currentYear].methodology;
        }
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

            // --- ЛОГІКА ПРОКРУТКИ ЧИСЕЛ (LERP) ---
            const lerpFactor = 0.1; 
            
            // Плавне оновлення Rate
            displayValues[`${side}Rate`] += (rate - displayValues[`${side}Rate`]) * lerpFactor;
            const rateVal = displayValues[`${side}Rate`];
            
            document.getElementById(`${side}Rate`).innerText = (['sec', 'min'].includes(currentTimeUnit)) 
                ? rateFormatter.format(rateVal) 
                : wholeFormatter.format(rateVal);
            
            // --- ЛОГІКА КУМУЛЯТИВНОГО ЧИСЛА ТА ПУЛЬСАЦІЇ ---
            const cumElement = document.getElementById(`${side}Cumulative`);
            if (cumElement) {
                // Плавне оновлення Cumulative (тільки якщо не Live режим, щоб не було затримки)
                if (currentYear === "2026") {
                    displayValues[`${side}Cumulative`] = cumulative;
                } else {
                    displayValues[`${side}Cumulative`] += (cumulative - displayValues[`${side}Cumulative`]) * lerpFactor;
                }
                
                cumElement.innerText = wholeFormatter.format(displayValues[`${side}Cumulative`]);
                
                // Якщо загальний баланс мінусовий — вмикаємо пульсацію "кровотечі"
                if (yearlyTotal < 0) {
                    cumElement.classList.add('bleeding');
                } else {
                    cumElement.classList.remove('bleeding');
                }
            }
            // -----------------------------------------------
            
            document.getElementById(`${side}Unit`).innerText = window.langUnits ? window.langUnits[currentTimeUnit] : `/${currentTimeUnit}`;

            // --- НОВА ЛОГІКА ВИБОРУ ЯРЛИКА (Підпис під великим числом) ---
            if (window.uiLabels) {
                const labelText = (mode === 'spending') ? window.uiLabels.spent : 
                                 (yearlyTotal >= 0 ? window.uiLabels.income : window.uiLabels.loss);
                
                const labelElement = document.getElementById(`${side}CumLabel`);
                if (labelElement) {
                    labelElement.innerText = labelText; 
                }
            }

            // --- ДОДАЄМО ТЕГ РОКУ НА КАРТКУ (З ЕФЕКТОМ LIVE) ---
            const card = document.getElementById(`${side}Card`);
            let yearBadge = card.querySelector('.year-badge');
            if (!yearBadge) {
                yearBadge = document.createElement('div');
                yearBadge.className = 'year-badge';
                card.appendChild(yearBadge);
            }

            if (currentYear === "2026") {
                yearBadge.innerHTML = `<span class="live-dot"></span> LIVE ${currentYear}`;
                yearBadge.classList.add('live-active');
            } else {
                yearBadge.innerText = currentYear;
                yearBadge.classList.remove('live-active');
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

async function takeScreenshot() {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "⌛";

    // Вибираємо контейнер з картками
    const element = document.querySelector('.contrast-grid'); 

    try {
        const canvas = await html2canvas(element, {
            useCORS: true,
            allowTaint: false, // Для мобільних краще false
            logging: true,     // Увімкни, щоб бачити помилки в консолі
            backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-color'),
            scale: 2,          // Золота середина якості
            imageTimeout: 0,   // Чекати до переможного кінця завантаження картинок
            onclone: (clonedDoc) => {
                // Приховуємо все зайве на копії документа перед знімком
                const toHide = clonedDoc.querySelectorAll('.info-tooltip-wrapper, .selector-arrow');
                toHide.forEach(el => el.style.display = 'none');
            }
        });

        const image = canvas.toDataURL("image/png", 1.0);

        // Перевіряємо Share API
        if (navigator.share && navigator.canShare) {
            const blob = await (await fetch(image)).blob();
            const file = new File([blob], 'financial_contrast.png', { type: 'image/png' });
            
            try {
                await navigator.share({
                    files: [file],
                    title: 'CashClash',
                    text: `${window.uiLabels.shareText}\nhttps://cashclash.github.io/`
                });
            } catch (shareErr) {
                console.log("User cancelled share");
            }
        } else {
            // Резервний метод: Скачування
            const link = document.createElement('a');
            link.download = 'financial_snapshot.png';
            link.href = image;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (err) {
        console.error("Screenshot error:", err);
        alert(window.uiLabels.errorScreenshot || "Error creating screenshot.");
    } finally {
        btn.innerHTML = originalContent;
    }
}

init();
