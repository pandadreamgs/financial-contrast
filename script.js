let currentLang = window.location.pathname.includes('/en/') ? 'en' : 'ua';
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
let groupedEntities = {};

const multipliers = {
    sec: 1, min: 60, hour: 3600, day: 86400,
    week: 604800, month: 2592000, year: 31536000
};

const rateFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function syncHeaderHeights() {
    const headers = document.querySelectorAll('.header-main-info');
    
    headers.forEach(h => h.style.height = 'auto');
    
    let maxHeight = 0;
    headers.forEach(h => {
        if (h.offsetHeight > maxHeight) maxHeight = h.offsetHeight;
    });
    
    headers.forEach(h => h.style.height = maxHeight + 'px');
}

window.addEventListener('load', syncHeaderHeights);
window.addEventListener('resize', syncHeaderHeights);

async function init() {
    applyInitialTheme();
    createVisualizerColumns();
    
    // Спочатку вантажимо мову та ПЕРШІ дані
    await loadLanguage(currentLang); 
    
    // Потім збираємо решту списку сутностей
    await preloadLangNames(); 
    
    setupEventListeners();
    startTickers(); // Тепер дані точно є, можна запускати
}

function adjustFontSize(element) {
    const parent = element.parentElement;
    // Отримуємо доступну ширину (віднімаємо аватарку та gap)
    // Або просто порівнюємо з шириною батька, якщо flex: 1
    let maxAllowedWidth = parent.clientWidth - 60; // приблизний запас під аватарку
    
    let currentFontSize = parseInt(window.getComputedStyle(element).fontSize);
    const minFontSize = 10; // поріг, нижче якого вже нечитабельно

    // Скидаємо перед перевіркою
    element.style.fontSize = ""; 
    
    // Цикл зменшення
    while (element.scrollWidth > element.offsetWidth && currentFontSize > minFontSize) {
        currentFontSize -= 1;
        element.style.fontSize = currentFontSize + "px";
    }
}

async function preloadLangNames() {
    for (let lang of availableLangs) {
        try {
            const res = await fetch(`../${lang}/main.json`).then(r => r.json());
            langDataCache[lang] = {
                langName: res.ui.lang,
                shortName: res.ui.short
            };
        } catch (e) { console.error(e); }
    }
    renderLangSelector();

    const promises = entityList.map(async (id) => {
        try {
            const res = await fetch(`./data/${id}.json`).then(r => r.json());
            entityCache[id] = res;
            const cat = (res.category || "OTHER").toUpperCase();
            if (!groupedEntities[cat]) groupedEntities[cat] = [];
            groupedEntities[cat].push({ id, name: res.name });
        } catch (e) { console.log(`Skip ${id}`); }
    });

    await Promise.all(promises);
    renderEntityMenus();
}

async function loadLanguage(lang) {
    if (lang !== currentLang) {
        window.location.href = `../${lang}/`;
        return;
    }
    try {
        const main = await fetch(`./main.json`).then(r => r.json());
        applyMainTexts(main);
        
        // Завантажуємо дані лише для двох вибраних сутностей, щоб не спамити запитами
        const leftId = financialData.left ? financialData.left.id : 'nasa';
        const rightId = financialData.right ? financialData.right.id : 'elon-musk';

        const [leftRes, rightRes] = await Promise.all([
            fetch(`./data/${leftId}.json`).then(r => r.json()),
            fetch(`./data/${rightId}.json`).then(r => r.json())
        ]);

        financialData.left = leftRes;
        financialData.right = rightRes;
        entityCache[leftId] = leftRes;
        entityCache[rightId] = rightRes;

        renderLangSelector();
        renderEntityMenus();
        updateUI();
        setTimeout(syncHeaderHeights, 100);
    } catch (e) { console.error("Error loading language/data", e); }
}

function renderEntityMenus(filterText = '', side = null) {
    const sides = side ? [side] : ['left', 'right'];

    sides.forEach(s => {
        const dropdown = document.getElementById(`${s}EntityMenu`);
        const searchHTML = `<input type="text" class="menu-search" placeholder="Search..." 
                            onclick="event.stopPropagation()" 
                            oninput="renderEntityMenus(this.value, '${s}')" value="${filterText}">`;

        let contentHTML = '';

        const sortedCategories = Object.keys(groupedEntities).sort();

        for (const category of sortedCategories) {
            const entities = groupedEntities[category];
            
            const filtered = entities.filter(e => 
                e.name.toLowerCase().includes(filterText.toLowerCase()) || 
                e.id.toLowerCase().includes(filterText.toLowerCase())
            );

            if (filtered.length > 0) {
                // Додаємо заголовок категорії
                contentHTML += `<div class="menu-category-title">${category}</div>`;
                
                contentHTML += filtered.map(entity => {
                    // ПЕРЕВІРКА ІКОНКИ: беремо з кешу (якщо є) або ставимо дефолтний .svg
                    const cachedData = entityCache[entity.id];
                    const imagePath = cachedData ? `../${cachedData.image}` : `../images/${entity.id}.svg`;

                    return `
                        <div class="entity-item" onclick="selectEntity('${s}', '${entity.id}', event)">
                            <div class="entity-icon-wrapper">
                                <img src="${imagePath}" 
                                     onerror="this.src='../images/default.svg'; this.onerror=null;" 
                                     loading="lazy" 
                                     class="entity-icon">
                            </div>
                            <span>${entity.name}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        const container = dropdown.querySelector('.menu-list-container');
        if (container) {
            container.innerHTML = contentHTML;
        } else {
            dropdown.innerHTML = searchHTML + `<div class="menu-list-container">${contentHTML}</div>`;
        }
    });
}

function toggleEntityMenu(side, event) {
    event.stopPropagation();
    const menu = document.getElementById(`${side}EntityMenu`);
    const otherMenu = document.getElementById(side === 'left' ? 'rightEntityMenu' : 'leftEntityMenu');
    otherMenu.classList.remove('active');
    menu.classList.toggle('active');
}

async function selectEntity(side, id, event) {
    event.stopPropagation();
    try {
        // Завантажуємо дані сутності безпосередньо при кліку
        const res = await fetch(`./data/${id}.json`).then(r => r.json());
        financialData[side] = res;
        entityCache[id] = res;

        updateEntityName(side, res.name);
        document.getElementById(`${side}EntityMenu`).classList.remove('active');
        updateUI();
    } catch (e) { console.error("Error selecting entity", e); }
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
    
    const currentName = (langDataCache[currentLang] && langDataCache[currentLang].shortName) 
                        ? langDataCache[currentLang].shortName 
                        : currentLang.toUpperCase();
    
    selector.innerHTML = `
        <img src="./${currentLang.toUpperCase()}.png">
        <span>${currentName}</span>
        <span class="arrow-down">▼</span>
    `;
    
    dropdown.innerHTML = availableLangs.map(l => {
        const displayName = (langDataCache[l] && langDataCache[l].langName) 
                            ? langDataCache[l].langName 
                            : l.toUpperCase();
        return `
            <div class="lang-item" onclick="loadLanguage('${l}')">
                <img src="../${l}/${l.toUpperCase()}.png">
                <span>${displayName}</span>
            </div>
        `;
    }).join('');
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
        if (!data || !data.data || !data.data[currentYear]) return;
        if (!data || !data.data[currentYear]) return;
        const mode = cardModes[side];
        const container = document.getElementById(`${side}Details`);
        const breakdown = data.data[currentYear][mode].breakdown;
        const sortedItems = Object.values(breakdown).sort((a, b) => {
            return Math.abs(b.percent) - Math.abs(a.percent);
        });

        container.innerHTML = sortedItems.map(item => {
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
        // ------------------------------

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

        let currentContextMax = 0;
        ["left", "right"].forEach(side => {
            const data = financialData[side];
            const mode = cardModes[side];
            if (!data) return;

            Object.keys(data.data).forEach(year => {
                const val = Math.abs(data.data[year][mode].total);
                if (val > currentContextMax) currentContextMax = val;
            });
        });
        currentContextMax = currentContextMax || 1;

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
            
            const lerpFactor = 0.1;
            displayValues[`${side}Rate`] += (rate - displayValues[`${side}Rate`]) * lerpFactor;
            const rateVal = displayValues[`${side}Rate`];
            
            const rateEl = document.getElementById(`${side}Rate`);
            if(rateEl) {
                rateEl.innerText = (['sec', 'min'].includes(currentTimeUnit)) 
                    ? rateFormatter.format(rateVal) 
                    : wholeFormatter.format(rateVal);
            }
            
            const cumElement = document.getElementById(`${side}Cumulative`);
            if (cumElement) {
                if (currentYear === "2026") {
                    displayValues[`${side}Cumulative`] = cumulative;
                } else {
                    displayValues[`${side}Cumulative`] += (cumulative - displayValues[`${side}Cumulative`]) * lerpFactor;
                }
                cumElement.innerText = wholeFormatter.format(displayValues[`${side}Cumulative`]);
                
                if (yearlyTotal < 0) {
                    cumElement.classList.add('bleeding');
                } else {
                    cumElement.classList.remove('bleeding');
                }
            }
            
            const unitEl = document.getElementById(`${side}Unit`);
            if(unitEl) {
                const unitText = window.langUnits ? window.langUnits[currentTimeUnit] : `/${currentTimeUnit}`;
                // Додаємо рік після одиниці часу
                unitEl.innerText = `${unitText} ${currentYear}`; 
            }

            if (window.uiLabels) {
                const labelText = (mode === 'spending') ? window.uiLabels.spent : 
                                 (yearlyTotal >= 0 ? window.uiLabels.income : window.uiLabels.loss);
                const labelElement = document.getElementById(`${side}CumLabel`);
                if (labelElement) labelElement.innerText = labelText; 
            }

            // ВИПРАВЛЕНО: Видалено дублювання оголошення yearBadge
            const card = document.getElementById(`${side}Card`);
            if (card) {
                let badge = card.querySelector('.year-badge');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'year-badge';
                    card.appendChild(badge);
                }

                if (currentYear === "2026") {
                    badge.innerHTML = `<span class="live-dot"></span> ${currentYear}`;
                    badge.className = 'year-badge live-active';
                    badge.style.display = 'flex';
                } else {
                    badge.innerText = currentYear;
                    badge.className = 'year-badge';
                    badge.style.display = 'block';
                    badge.style.color = 'var(--text-dim)';
                }
            }

            const visualizer = document.getElementById(`${side}Visualizer`);
            if (visualizer) {
                const columns = visualizer.querySelectorAll('.bar-column');
                const isYearlyLoss = yearlyTotal < 0;

                for (let i = 0; i < 12; i++) {
                    const col = columns[i];
                    if(!col) continue;
                    
                    const baseHeight = (Math.abs(yearlyTotal) / currentContextMax) * 100;
                    let heightPercent = ((i + 1) / 12) * baseHeight;
                    
                    col.style.height = `${Math.max(heightPercent, 2)}%`;
                    const color = (mode === 'spending' || isYearlyLoss) ? '#ff4d4d' : '#00ff88';
                    col.style.setProperty('--accent-color', color);
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

function updateEntityName(side, name) {
    const nameElement = document.getElementById(side + 'Name');
    if (!nameElement) return;

    nameElement.innerText = name; 
    
    // Скидаємо розмір до стандартного з CSS перед розрахунком
    nameElement.style.fontSize = ''; 

    // Викликаємо автоматику з мікро-затримкою, щоб браузер встиг "відмалювати" текст
    setTimeout(() => {
        adjustFontSize(nameElement);
        syncHeaderHeights(); 
    }, 10);
}

async function takeScreenshot() {
    const btn = document.querySelector('.header-controls-right .tool-wrapper:first-child');
    const originalContent = btn.innerHTML;
    
    // 1. МИТТЄВА РЕАКЦІЯ
    btn.innerHTML = '...';
    
    try {
        const target = document.querySelector('.contrast-grid');
        if (!target) return;

        const canvas = await html2canvas(target, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-color'),
            scale: 2,
            onclone: (clonedDoc) => {
              const toHide = clonedDoc.querySelectorAll('.info-tooltip-wrapper, .selector-arrow, .entity-dropdown');
              toHide.forEach(el => el.style.display = 'none');
          
              clonedDoc.querySelectorAll('.card').forEach(card => {
                  let badge = card.querySelector('.year-badge');
                  if (!badge) {
                      badge = document.createElement('div');
                      badge.className = 'year-badge';
                      card.appendChild(badge);
                  }
                  
                  // Встановлюємо стилі для скріншота
                  badge.style.position = 'absolute';
                  badge.style.top = '10px';
                  badge.style.right = '10px';
                  badge.style.display = 'flex';
                  badge.style.alignItems = 'center';
          
                  if (currentYear === "2026") {
                      badge.innerHTML = `<span style="display:inline-block; width:6px; height:6px; background:#ff4d4d; border-radius:50%; margin-right:4px;"></span> 2026`;
                      badge.style.color = '#ff4d4d';
                  } else {
                      badge.innerText = currentYear;
                      badge.style.color = '#888888'; // або var(--text-dim)
                      badge.style.border = '1px solid #333';
                  }
              });
          
              const grid = clonedDoc.querySelector('.contrast-grid');
              if (grid) {
                  grid.style.padding = '30px 15px';
                  grid.style.background = '#0d0d0d'; // жорсткий колір для стабільності
              }
          }
        });

        const image = canvas.toDataURL("image/png", 1.0);
        const blob = await (await fetch(image)).blob();
        const file = new File([blob], `cashclash_${currentYear}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'CashClash',
                text: `${window.uiLabels.shareText}\nhttps://cashclash.github.io/${currentLang}/`
            });
        } else {
            const link = document.createElement('a');
            link.download = `cashclash_${currentYear}.png`;
            link.href = image;
            link.click();
        }
    } catch (err) {
        console.error("Screenshot error:", err);
    } finally {
        btn.innerHTML = originalContent;
    }
}
function createVisualizerColumns() {
    ["left", "right"].forEach(side => {
        const visualizer = document.getElementById(`${side}Visualizer`);
        if (visualizer) {
            // Очищуємо все, крім бейджа року (якщо він там є)
            const badge = visualizer.querySelector('.year-badge-inside');
            visualizer.innerHTML = ''; 
            if (badge) visualizer.appendChild(badge);

            // Створюємо 12 стовпців
            for (let i = 0; i < 12; i++) {
                const bar = document.createElement('div');
                bar.className = 'bar-column';
                visualizer.appendChild(bar);
            }
        }
    });
}
init();
