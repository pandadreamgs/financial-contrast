let financialData = null;
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };
let drift = { left: 1, right: 1 };

const multipliers = {
    sec: 1, min: 60, hour: 3600, day: 86400,
    week: 604800, month: 2592000, year: 31536000
};

const rateFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

async function init() {
    try {
        const response = await fetch('data.json');
        financialData = await response.json();
        setupEventListeners();
        startTickers();
    } catch (e) { console.error("Error loading JSON:", e); }
}

function setupEventListeners() {
    document.getElementById('timeTabs').addEventListener('click', (e) => {
        if (e.target.dataset.unit) {
            document.querySelectorAll('#timeTabs button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeUnit = e.target.dataset.unit;
        }
    });

    document.getElementById('yearSelector').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#yearSelector button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentYear = e.target.innerText === "Total" ? "2026" : e.target.innerText;
        }
    });

    document.querySelectorAll('.mode-switch').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const side = card.dataset.side;
            cardModes[side] = e.target.dataset.mode;
            card.className = `card ${cardModes[side]}`;
            card.querySelectorAll('.mode-switch').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateDetails(side); // Оновлюємо список при зміні режиму
        });
    });
}

// Нова функція для динамічного оновлення категорій та методології
function updateDetails(side) {
    const entity = side === "left" ? financialData.entities[0] : financialData.entities[1];
    const mode = cardModes[side];
    const yearData = entity.data[currentYear] || entity.data["2025"];
    
    if (!yearData) return;

    // 1. Оновлення списку категорій/джерел
    const detailsContainer = document.getElementById(`${side}Details`);
    detailsContainer.innerHTML = '';

    // Якщо це Income, можемо спочатку вивести sources, а потім breakdown
    const dataObj = yearData[mode];
    if (dataObj && dataObj.breakdown) {
        Object.values(dataObj.breakdown).forEach(item => {
            const row = document.createElement('div');
            row.className = 'detail-item';
            row.innerHTML = `<span class="detail-name">${item.name}</span><span class="detail-value">${item.percent}%</span>`;
            detailsContainer.appendChild(row);
        });
    }

    // 2. Оновлення підказки методології
    const infoBtn = document.getElementById(`${side}Methodology`);
    infoBtn.onclick = () => alert(`Methodology (${entity.name}):\n\n${yearData.methodology}`);
}

function startTickers() {
    const update = () => {
        if (!financialData) return;
        const now = new Date();
        const secondsPassed = (now - new Date(now.getFullYear(), 0, 1)) / 1000;

        financialData.entities.forEach((entity, index) => {
            const side = index === 0 ? "left" : "right";
            const mode = cardModes[side];
            const yearData = entity.data[currentYear] || entity.data["2025"];
            const baseValuePerYear = yearData[mode].total || 0;
            const basePerSec = baseValuePerYear / multipliers.year;

            // Дрифт для "живого" ефекту
            drift[side] += (Math.random() - 0.5) * 0.002;
            drift[side] = Math.max(0.85, Math.min(drift[side], 1.15));

            const cumulative = secondsPassed * basePerSec;
            const displayRate = (currentTimeUnit === 'year') ? baseValuePerYear : (basePerSec * drift[side]) * multipliers[currentTimeUnit];
            
            // Базові тексти
            document.getElementById(`${side}Name`).innerText = entity.name;
            document.getElementById(`${side}Type`).innerText = entity.category;
            document.getElementById(`${side}Unit`).innerText = `/ ${currentTimeUnit}`;
            
            const formatter = (currentTimeUnit === 'sec' || currentTimeUnit === 'min') ? rateFormatter : wholeFormatter;
            document.getElementById(`${side}Rate`).innerText = formatter.format(displayRate);
            document.getElementById(`${side}Cumulative`).innerText = wholeFormatter.format(Math.floor(cumulative));
            document.getElementById(`${side}Icon`).src = entity.image;

            // Візуалізація бару (масштабування)
            let heightFactor = (basePerSec / 10000) * 100; 
            document.getElementById(`${side}Bar`).style.height = `${Math.max(5, Math.min(heightFactor, 95))}%`;
        });
        requestAnimationFrame(update);
    };
    
    // Ініціалізуємо деталі вперше
    updateDetails("left");
    updateDetails("right");
    update();
}

init();
