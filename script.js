let financialData = null;
let currentYear = "2026";
let currentTimeUnit = "sec";
let cardModes = { left: "spending", right: "income" };

// Стан для плавного дрейфу чисел (+-15%)
let drift = { left: 1, right: 1 };

const multipliers = {
    sec: 1, min: 60, hour: 3600, day: 86400,
    week: 604800, month: 2592000, year: 31536000
};

async function init() {
    try {
        const response = await fetch('data.json');
        financialData = await response.json();
        setupEventListeners();
        startTickers();
    } catch (e) { console.error(e); }
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
        }
    });

    document.querySelectorAll('.mode-switch').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const side = card.dataset.side;
            const mode = e.target.dataset.mode;
            cardModes[side] = mode;
            card.className = `card ${mode}`;
            card.querySelectorAll('.mode-switch').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function startTickers() {
    const update = () => {
        if (!financialData) return;
        const now = new Date();
        const isCurrentYear = now.getFullYear().toString() === currentYear;
        
        let secondsPassed = isCurrentYear ? 
            (now - new Date(now.getFullYear(), 0, 1)) / 1000 : multipliers.year;

        financialData.entities.forEach((entity, index) => {
            const side = index === 0 ? "left" : "right";
            const mode = cardModes[side];
            const yearData = entity.data[currentYear] || entity.data["2025"];
            
            const baseValuePerYear = yearData[mode];
            const basePerSec = baseValuePerYear / multipliers.year;

            // --- НАТУРАЛЬНИЙ ДРЕЙФ (Random Walk) ---
            if (isCurrentYear && currentTimeUnit !== "year") {
                // Кожен кадр додаємо мікро-зміну, щоб число плавало
                drift[side] += (Math.random() - 0.5) * 0.002;
                // М'яко повертаємо до меж 0.85 - 1.15
                if (drift[side] > 1.15) drift[side] -= 0.001;
                if (drift[side] < 0.85) drift[side] += 0.001;
            } else {
                drift[side] = 1;
            }

            const currentRatePerSec = basePerSec * drift[side];
            const cumulative = secondsPassed * basePerSec;

            let displayRate = (currentTimeUnit === 'year') ? 
                baseValuePerYear : currentRatePerSec * multipliers[currentTimeUnit];

            // --- ОНОВЛЕННЯ ТЕКСТУ ---
            document.getElementById(`${side}Name`).innerText = entity.name;
            document.getElementById(`${side}Type`).innerText = entity.category;
            document.getElementById(`${side}Unit`).innerText = `/ ${currentTimeUnit}`;
            document.getElementById(`${side}Approx`).style.display = isCurrentYear ? "inline" : "none";
            
            const formatter = new Intl.NumberFormat('en-US', {
                maximumFractionDigits: (currentTimeUnit === 'sec' || currentTimeUnit === 'min') ? 2 : 0
            });

            document.getElementById(`${side}Rate`).innerText = formatter.format(displayRate);
            document.getElementById(`${side}Cumulative`).innerText = Math.floor(cumulative).toLocaleString('en-US');
            
            const iconEl = document.getElementById(`${side}Icon`);
            iconEl.src = entity.image || `https://ui-avatars.com/api/?name=${entity.name}&background=333&color=fff`;

            // Масштаб бару
            const height = Math.min((basePerSec / 15000) * 100, 85);
            document.getElementById(`${side}Bar`).style.height = `${15 + height}%`;
        });

        requestAnimationFrame(update);
    };
    update();
}

init();
                
