/* ==========================================================================
   ANTIKYTHERA MECHANISM - SIMULATOR CORE
   Procedural Rendering, Web Audio Synthesis & Keplerian Orbit Approximations
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // 1. STATE & CONSTANTS
    // ----------------------------------------------------------------------
    const state = {
        currentDays: 0,         // Days elapsed since epoch (Jan 1, 100 BC)
        isPlaying: false,
        speed: 4,               // Scale factor for animation speed
        activeView: 'front',    // 'front', 'internal', 'back'
        audioEnabled: false,
        hoveredComponent: null,
        lastTime: 0,
        accumulatedSunAngle: 0,
        crankAngle: 0
    };

    // Astronomical constant parameters (drifts and cycles)
    const SYNODIC_MONTH = 29.530589; // Lunar Phase cycle (days)
    const SIDEREAL_YEAR = 365.24219; // Solar orbit (days)
    const SIDEREAL_MONTH = 27.321661; // Lunar position relative to stars (days)
    
    // Cycles length in months
    const METONIC_MONTHS = 235; 
    const SAROS_MONTHS = 223;

    // Constellations in Spanish
    const ZODIAC_SIGNS = [
        { name: "Aries", symbol: "♈", range: [0, 30] },
        { name: "Tauro", symbol: "♉", range: [30, 60] },
        { name: "Géminis", symbol: "♊", range: [60, 90] },
        { name: "Cáncer", symbol: "♋", range: [90, 120] },
        { name: "Leo", symbol: "♌", range: [120, 150] },
        { name: "Virgo", symbol: "♍", range: [150, 180] },
        { name: "Libra", symbol: "♎", range: [180, 210] },
        { name: "Escorpio", symbol: "♏", range: [210, 240] },
        { name: "Sagitario", symbol: "♐", range: [240, 270] },
        { name: "Capricornio", symbol: "♑", range: [270, 300] },
        { name: "Acuario", symbol: "♒", range: [300, 330] },
        { name: "Piscis", symbol: "♓", range: [330, 360] }
    ];

    // Egyptian Calendar Months (30 days each + 5 extra days)
    const EGYPTIAN_MONTHS = [
        "Thoth", "Phaophi", "Athyr", "Choiak", "Tybi", "Mecheir",
        "Phamenoth", "Pharmouthi", "Pachon", "Payni", "Epiphi", "Mesore",
        "Epagómenas"
    ];

    // Historical pre-computed eclipses inside a Saros Cycle (223 synodic months)
    // S = Solar, L = Lunar. Values represent index of month in Saros cycle
    const ECLIPSES = {};
    const solarEclipseMonths = [0, 5, 11, 22, 28, 34, 46, 52, 58, 69, 75, 87, 93, 99, 110, 116, 122, 134, 140, 146, 157, 163, 175, 181, 187, 198, 204, 210, 222];
    const lunarEclipseMonths = [6, 12, 23, 29, 35, 47, 53, 59, 70, 76, 88, 94, 100, 111, 117, 123, 135, 141, 147, 158, 164, 176, 182, 188, 199, 205, 211, 223];
    
    solarEclipseMonths.forEach(m => ECLIPSES[m] = { type: 'solar', name: 'Eclipse Solar', glyph: 'H (Ήλιος)' });
    lunarEclipseMonths.forEach(m => ECLIPSES[m] = { type: 'lunar', name: 'Eclipse Lunar', glyph: 'Σ (Σελήνη)' });

    // Procedural colors for canvas elements
    const colors = {
        bronze: { fill: '#c58c56', stroke: '#8c5827', strokeDark: '#4a2f14', accent: '#d9a05b' },
        gold: { fill: '#dfba4b', stroke: '#9e7f27', strokeDark: '#594713', accent: '#f5da7d' },
        darkBronze: { fill: '#57412e', stroke: '#38281c', strokeDark: '#20160f', accent: '#73573e' },
        iron: { fill: '#3d3d4a', stroke: '#252530', strokeDark: '#121217', accent: '#5c5c70' }
    };

    // ----------------------------------------------------------------------
    // 2. GEAR GEOMETRY DEFINITIONS (For "Internal View")
    // ----------------------------------------------------------------------
    // Gears coordinates are offset from Center (375, 300)
    const gears = [
        {
            id: 'A1',
            name: 'Rueda del Sol Principal (A1)',
            x: 375, y: 300,
            teeth: 64, radius: 95,
            color: colors.gold,
            speedRatio: 1, // Base driving gear
            desc: 'Engranaje impulsor de 64 dientes. Representa el ciclo anual del Sol. Es el corazón del mecanismo y transmite el movimiento del usuario a todos los demás trenes de engranajes.'
        },
        {
            id: 'B1',
            name: 'Engranaje de Transmisión (B1)',
            x: 288, y: 250,
            teeth: 38, radius: 56,
            color: colors.bronze,
            speedRatio: -64 / 38,
            desc: 'Recibe el movimiento directo de la Rueda Solar Principal (A1) y lo traslada a velocidad acelerada hacia el dial de fases lunares.'
        },
        {
            id: 'B2',
            name: 'Engranaje Coaxial Lunar (B2)',
            x: 288, y: 250,
            teeth: 48, radius: 72,
            color: colors.darkBronze,
            speedRatio: -64 / 38, // Coaxial with B1, same speed and direction
            desc: 'Rueda de 48 dientes tallados montada sobre el mismo eje que B1. Sirve de puente multiplicador para accionar los cálculos orbitales.'
        },
        {
            id: 'C1',
            name: 'Multiplicador Lunar Intermedio (C1)',
            x: 195, y: 310,
            teeth: 24, radius: 36,
            color: colors.bronze,
            speedRatio: (-64 / 38) * (-48 / 24),
            desc: 'Rueda de 24 dientes que engrana con B2. Cambia el sentido de rotación y duplica la velocidad angular del sistema lunar.'
        },
        {
            id: 'C2',
            name: 'Gran Rueda de Anomalía Lunar (C2)',
            x: 195, y: 310,
            teeth: 127, radius: 180,
            color: colors.gold,
            speedRatio: (-64 / 38) * (-48 / 24), // Coaxial with C1
            desc: 'La rueda más grande del mecanismo, con 127 dientes. Calcula con extrema precisión la órbita de la Luna alrededor de la Tierra, compensando la velocidad no uniforme de la Luna (anomalía lunar).'
        },
        {
            id: 'D1',
            name: 'Rueda de Fase de la Luna (D1)',
            x: 280, y: 410,
            teeth: 32, radius: 48,
            color: colors.iron,
            speedRatio: ((-64 / 38) * (-48 / 24)) * (-127 / 32),
            desc: 'Rueda de 32 dientes. Transmite la rotación al indicador de fase de la Luna en la cara frontal, permitiendo la visualización exacta del ciclo sinódico (29.53 días).'
        },
        {
            id: 'E1',
            name: 'Transmisión del Ciclo Posterior (E1)',
            x: 480, y: 260,
            teeth: 32, radius: 48,
            color: colors.bronze,
            speedRatio: -64 / 32,
            desc: 'Deriva la fuerza de la rueda principal A1 hacia el reverso de la máquina para accionar las lecturas de eclipses y calendarios.'
        },
        {
            id: 'E2',
            name: 'Distribuidor Principal Trasero (E2)',
            x: 480, y: 260,
            teeth: 64, radius: 95,
            color: colors.gold,
            speedRatio: -64 / 32, // Coaxial with E1
            desc: 'Gran engranaje coaxial trasero. Distribuye la velocidad de salida de 2 revoluciones por año hacia los diales de Saros y Metónico.'
        },
        {
            id: 'E3',
            name: 'Reductor Metónico (E3)',
            x: 550, y: 190,
            teeth: 32, radius: 48,
            color: colors.bronze,
            speedRatio: (-64 / 32) * (-64 / 32),
            desc: 'Rueda reductora intermedia de 32 dientes para calibrar el factor exacto del ciclo Metónico de 19 años.'
        },
        {
            id: 'E5',
            name: 'Módulo del Calendario Metónico (E5)',
            x: 620, y: 140,
            teeth: 64, radius: 95,
            color: colors.darkBronze,
            speedRatio: ((-64 / 32) * (-64 / 32)) * (-32 / 64),
            desc: 'Rueda de 64 dientes conectada al dial Metónico. Realiza una revolución completa en 19 años lunares, indicando en qué mes del ciclo de 235 meses nos encontramos.'
        },
        {
            id: 'F1',
            name: 'Módulo del Calendario de Saros (F1)',
            x: 575, y: 390,
            teeth: 54, radius: 81,
            color: colors.bronze,
            speedRatio: (-64 / 32) * (-64 / 54),
            desc: 'Rueda de 54 dientes conectada al dial de Saros. Mueve el indicador en espiral a lo largo de 223 meses sinódicos para señalar la fecha de futuros eclipses de Sol o Luna.'
        }
    ];

    // ----------------------------------------------------------------------
    // 3. UI ELEMENT REFERENCES
    // ----------------------------------------------------------------------
    const canvas = document.getElementById("antikythera-canvas");
    const ctx = canvas.getContext("2d");
    const canvasLoading = document.getElementById("canvas-loading");
    
    const dateDisplay = document.getElementById("date-display");
    const egyptianDateDisplay = document.getElementById("egyptian-date");
    const cycleYearDisplay = document.getElementById("cycle-year");
    
    const timeSlider = document.getElementById("time-slider");
    const speedSlider = document.getElementById("speed-slider");
    const speedReadout = document.getElementById("speed-readout");
    
    const btnPlay = document.getElementById("btn-play");
    const playIcon = document.getElementById("play-icon");
    const playText = document.getElementById("play-text");
    const btnPrev = document.getElementById("btn-prev");
    const btnNext = document.getElementById("btn-next");
    
    const audioToggle = document.getElementById("audio-toggle");
    const volumeIcon = document.getElementById("volume-icon");
    
    const crankDisc = document.getElementById("crank-disc");
    const crankHandle = document.getElementById("crank-handle");
    
    const tabFront = document.getElementById("tab-front");
    const tabInternal = document.getElementById("tab-internal");
    const tabBack = document.getElementById("tab-back");
    const quickViewDesc = document.getElementById("quick-view-desc");
    
    const valSolarLong = document.getElementById("val-solar-long");
    const valLunarLong = document.getElementById("val-lunar-long");
    const valLunarPhase = document.getElementById("val-lunar-phase");
    const valMetonic = document.getElementById("val-metonic");
    const valSaros = document.getElementById("val-saros");
    const valOlympiad = document.getElementById("val-olympiad");
    
    const eclipsePanel = document.getElementById("eclipse-alert-panel");
    const eclipseIcon = document.getElementById("eclipse-icon");
    const eclipseTitle = document.getElementById("eclipse-title");
    const eclipseDesc = document.getElementById("eclipse-desc");
    const componentInfo = document.getElementById("component-info");

    // Hide canvas loader after brief delay
    setTimeout(() => {
        canvasLoading.classList.add("hidden");
    }, 800);

    // Initialize Lucide Icons
    lucide.createIcons();

    // ----------------------------------------------------------------------
    // 4. WEB AUDIO SYNTHESIZER (PROCEDURAL AUDIO Ticks)
    // ----------------------------------------------------------------------
    let audioCtx = null;

    function playGearTick() {
        if (!state.audioEnabled) return;
        
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            const now = audioCtx.currentTime;
            
            // High frequency metallic "ping" of teeth hitting
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            
            osc.type = 'sine';
            // Randomize slightly for organic variance
            osc.frequency.setValueAtTime(1000 + Math.random() * 500, now);
            
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1600, now);
            filter.Q.setValueAtTime(4, now);
            
            gainNode.gain.setValueAtTime(0.06, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.04);
            
            // Lower mechanical thud
            const oscThud = audioCtx.createOscillator();
            const gainNodeThud = audioCtx.createGain();
            
            oscThud.type = 'triangle';
            oscThud.frequency.setValueAtTime(140, now);
            
            gainNodeThud.gain.setValueAtTime(0.04, now);
            gainNodeThud.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
            
            oscThud.connect(gainNodeThud);
            gainNodeThud.connect(audioCtx.destination);
            
            oscThud.start(now);
            oscThud.stop(now + 0.02);
            
        } catch (e) {
            console.warn("Audio failure:", e);
        }
    }

    // ----------------------------------------------------------------------
    // 5. CALENDAR & CYCLES CALCULATIONS
    // ----------------------------------------------------------------------
    function getGregorianDate(days) {
        let year = -100;
        let d = days;
        
        if (d >= 0) {
            while (true) {
                let daysInYear = isLeapYear(year) ? 366 : 365;
                if (d < daysInYear) break;
                d -= daysInYear;
                year++;
            }
        } else {
            while (d < 0) {
                year--;
                let daysInYear = isLeapYear(year) ? 366 : 365;
                d += daysInYear;
            }
        }
        
        const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        
        let month = 0;
        while (d >= monthDays[month]) {
            d -= monthDays[month];
            month++;
        }
        let day = Math.floor(d) + 1;
        
        let yearStr = year < 0 ? `${Math.abs(year)} a.C.` : `${year} d.C.`;
        if (year === 0) yearStr = "1 a.C.";
        
        return `${day.toString().padStart(2, '0')} ${monthNames[month]} ${yearStr}`;
    }
    
    function isLeapYear(year) {
        return Math.abs(year) % 4 === 0;
    }

    function getEgyptianDate(days) {
        // Drift is 0.2422 days per year relative to Sothic cycle, but here we calculate day of 365-day year
        let dayOfYear = Math.floor(days) % 365;
        if (dayOfYear < 0) dayOfYear += 365;
        
        let monthIdx = Math.floor(dayOfYear / 30);
        let day = (dayOfYear % 30) + 1;
        
        // Month 12 is Epagómenas (5 extra days)
        if (monthIdx >= 12) {
            monthIdx = 12;
            day = (dayOfYear - 360) + 1;
        }
        
        return {
            month: EGYPTIAN_MONTHS[monthIdx],
            day: day
        };
    }

    function getZodiacSign(degrees) {
        let deg = degrees % 360;
        if (deg < 0) deg += 360;
        const index = Math.floor(deg / 30);
        return ZODIAC_SIGNS[index];
    }

    // ----------------------------------------------------------------------
    // 6. UPDATE LECTURES & STATISTICS BOARD
    // ----------------------------------------------------------------------
    function updateStatistics() {
        const days = state.currentDays;
        
        // 1. Solar Angles
        const solarLongDeg = ((days / SIDEREAL_YEAR) * 360) % 360;
        const solarLongClean = solarLongDeg < 0 ? solarLongDeg + 360 : solarLongDeg;
        const solarZodiac = getZodiacSign(solarLongClean);
        valSolarLong.textContent = `${solarLongClean.toFixed(1)}° (${solarZodiac.name})`;

        // 2. Lunar Angles
        const lunarLongDeg = ((days / SIDEREAL_MONTH) * 360) % 360;
        const lunarLongClean = lunarLongDeg < 0 ? lunarLongDeg + 360 : lunarLongDeg;
        const lunarZodiac = getZodiacSign(lunarLongClean);
        valLunarLong.textContent = `${lunarLongClean.toFixed(1)}° (${lunarZodiac.name})`;

        // 3. Lunar Phase
        let phaseValue = (days % SYNODIC_MONTH) / SYNODIC_MONTH;
        if (phaseValue < 0) phaseValue += 1;
        const phasePct = Math.round(phaseValue * 100);
        let phaseText = "Nueva";
        if (phaseValue > 0.03 && phaseValue < 0.22) phaseText = "Creciente";
        else if (phaseValue >= 0.22 && phaseValue <= 0.28) phaseText = "Cuarto Creciente";
        else if (phaseValue > 0.28 && phaseValue < 0.47) phaseText = "Gibosa Creciente";
        else if (phaseValue >= 0.47 && phaseValue <= 0.53) phaseText = "Luna Llena";
        else if (phaseValue > 0.53 && phaseValue < 0.72) phaseText = "Gibosa Menguante";
        else if (phaseValue >= 0.72 && phaseValue <= 0.78) phaseText = "Cuarto Menguante";
        else if (phaseValue > 0.78 && phaseValue < 0.97) phaseText = "Menguante";
        valLunarPhase.textContent = `${phaseText} (${phasePct}%)`;

        // 4. Metonic Cycle (235 months in 19 years)
        const totalMonthsMetonic = days / SYNODIC_MONTH;
        let metonicMonth = Math.floor(totalMonthsMetonic % METONIC_MONTHS);
        if (metonicMonth < 0) metonicMonth += METONIC_MONTHS;
        let metonicYear = Math.floor((metonicMonth / METONIC_MONTHS) * 19) + 1;
        valMetonic.textContent = `Mes ${metonicMonth + 1}, Año ${metonicYear}`;
        
        cycleYearDisplay.textContent = `Año Ciclo Metónico: ${metonicYear} / 19`;

        // 5. Saros Cycle (223 months)
        const totalMonthsSaros = days / SYNODIC_MONTH;
        let sarosMonth = Math.floor(totalMonthsSaros % SAROS_MONTHS);
        if (sarosMonth < 0) sarosMonth += SAROS_MONTHS;
        valSaros.textContent = `Mes ${sarosMonth + 1} del Ciclo`;

        // 6. Olympiad (4 years cycle starting at 776 BC)
        // Year 100 BC represents Olympiad 169 (169 * 4 = 676 years since 776 BC)
        const yearsSince100BC = days / SIDEREAL_YEAR;
        const olympiadIndex = 169 + Math.floor(yearsSince100BC / 4);
        const olympiadYear = Math.floor((yearsSince100BC % 4 + 4) % 4) + 1;
        valOlympiad.textContent = `Año ${olympiadYear}, Olimpíada ${olympiadIndex}`;

        // 7. Gregorian Date & Egyptian Calendar Displays
        dateDisplay.textContent = getGregorianDate(days);
        const egyptianDate = getEgyptianDate(days);
        egyptianDateDisplay.textContent = `Egipto: ${egyptianDate.day} de ${egyptianDate.month}`;

        // 8. Eclipse Detection Warning
        const nextEclipse = ECLIPSES[sarosMonth];
        if (nextEclipse) {
            eclipsePanel.className = `eclipse-panel has-eclipse-${nextEclipse.type}`;
            eclipseIcon.setAttribute("data-lucide", nextEclipse.type === 'solar' ? 'sun' : 'moon');
            eclipseTitle.textContent = `${nextEclipse.name} Inminente`;
            eclipseDesc.textContent = `Predicción en el cuadrante de Saros. Glifo de Calibración: ${nextEclipse.glyph}`;
        } else {
            eclipsePanel.className = 'eclipse-panel';
            eclipseIcon.setAttribute("data-lucide", 'sun');
            eclipseTitle.textContent = 'Sin eclipses próximos';
            eclipseDesc.textContent = 'El mecanismo no predice eventos solares o lunares en este mes.';
        }
        lucide.createIcons(); // refresh icons inside widget dynamically
    }

    // ----------------------------------------------------------------------
    // 7. RENDER COMPONENT: PROCEDURAL GEARS DRAWING
    // ----------------------------------------------------------------------
    function drawGear(gear, baseAngle) {
        const gearAngle = baseAngle * gear.speedRatio;
        
        ctx.save();
        ctx.translate(gear.x, gear.y);
        ctx.rotate(gearAngle);

        // Highlight if hovered
        const isHovered = state.hoveredComponent === gear.id;
        ctx.shadowBlur = isHovered ? 15 : 4;
        ctx.shadowColor = isHovered ? 'rgba(255, 215, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        // Gear material styling
        ctx.strokeStyle = isHovered ? '#fff' : gear.color.stroke;
        ctx.fillStyle = gear.color.fill;
        ctx.lineWidth = 1.5;

        // Draw Teeth
        ctx.beginPath();
        const toothCount = gear.teeth;
        const outerRadius = gear.radius;
        const innerRadius = outerRadius - 8;
        const toothWidthAngle = (Math.PI * 2) / toothCount;

        for (let i = 0; i < toothCount; i++) {
            const angle = i * toothWidthAngle;
            
            // Draw profile of a single trapezoidal tooth
            ctx.lineTo(Math.cos(angle - toothWidthAngle/4) * innerRadius, Math.sin(angle - toothWidthAngle/4) * innerRadius);
            ctx.lineTo(Math.cos(angle - toothWidthAngle/6) * outerRadius, Math.sin(angle - toothWidthAngle/6) * outerRadius);
            ctx.lineTo(Math.cos(angle + toothWidthAngle/6) * outerRadius, Math.sin(angle + toothWidthAngle/6) * outerRadius);
            ctx.lineTo(Math.cos(angle + toothWidthAngle/4) * innerRadius, Math.sin(angle + toothWidthAngle/4) * innerRadius);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Remove shadow for inner cutout details
        ctx.shadowBlur = 0;

        // Inner solid ring
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius - 10, 0, Math.PI * 2);
        ctx.strokeStyle = gear.color.strokeDark;
        ctx.stroke();

        // Draw spokes (cuatro brazos mecánicos)
        ctx.beginPath();
        const spokeWidth = innerRadius * 0.12;
        ctx.lineWidth = spokeWidth;
        ctx.strokeStyle = gear.color.fill;
        ctx.lineCap = "round";
        for (let j = 0; j < 4; j++) {
            const angle = (j * Math.PI) / 2;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * (innerRadius - 12), Math.sin(angle) * (innerRadius - 12));
        }
        ctx.stroke();

        // Center golden pivot
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = gear.color.accent;
        ctx.strokeStyle = gear.color.strokeDark;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Draw axle core
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Write tooth count labels aligned vertically
        ctx.rotate(-gearAngle); // Keep labels upright
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gear.teeth.toString(), 0, 0);

        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // 8. RENDER VIEW: FRONT DIAL (ASTRONOMY DIAL)
    // ----------------------------------------------------------------------
    function drawFrontDial(solarAngle, lunarAngle) {
        const cx = 375;
        const cy = 300;
        const rOuter = 230; // Egyptian calendar
        const rInner = 190; // Zodiac calendar
        const rInner2 = 150; // Inner ring

        // Draw Dial Plate Background
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter + 20, 0, Math.PI * 2);
        ctx.fillStyle = '#171720';
        ctx.strokeStyle = '#c58c56';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 1. Draw Egyptian Calendar Ring (365 days / 12 months + Epagomenas)
        ctx.strokeStyle = '#6e4726';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.font = '700 8px "Outfit", sans-serif';
        ctx.fillStyle = '#a0a0b2';
        ctx.textAlign = 'center';

        // Draw 365 tick marks (drawn every 5 days for performance and clarity)
        for (let i = 0; i < 365; i += 5) {
            const angle = (i / 365) * Math.PI * 2;
            const length = (i % 30 === 0) ? 14 : 7;
            const startR = rOuter;
            const endR = rOuter - length;
            
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
            ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);
            ctx.strokeStyle = i % 30 === 0 ? '#dfba4b' : '#6e4726';
            ctx.stroke();
        }

        // Draw Egyptian Month Names
        for (let m = 0; m < 12; m++) {
            const startAngle = (m * 30 / 365) * Math.PI * 2;
            const endAngle = ((m + 1) * 30 / 365) * Math.PI * 2;
            const midAngle = (startAngle + endAngle) / 2;
            
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.fillStyle = '#dfba4b';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.fillText(EGYPTIAN_MONTHS[m].toUpperCase(), 0, -(rOuter - 18));
            ctx.restore();
        }
        
        // Epagomenas (the short month of 5 days at the end)
        const epagMidAngle = ((360 + 362.5) / 365) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(epagMidAngle + Math.PI / 2);
        ctx.fillStyle = '#dfba4b';
        ctx.font = 'bold 6px "JetBrains Mono", monospace';
        ctx.fillText("EPAGÓMENAS", 0, -(rOuter - 18));
        ctx.restore();

        // 2. Draw Zodiac Ring (12 sections of 30 degrees)
        ctx.beginPath();
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
        ctx.strokeStyle = '#c58c56';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let z = 0; z < 12; z++) {
            const angle = (z * 30) * Math.PI / 180;
            
            // Draw sector boundary lines
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
            ctx.lineTo(cx + Math.cos(angle) * rInner2, cy + Math.sin(angle) * rInner2);
            ctx.strokeStyle = '#6e4726';
            ctx.stroke();

            // Draw Constellation name & glyph
            const midAngle = angle + (15 * Math.PI / 180);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(midAngle + Math.PI / 2);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Outfit", sans-serif';
            ctx.fillText(ZODIAC_SIGNS[z].symbol + " " + ZODIAC_SIGNS[z].name.toUpperCase(), 0, -(rInner - 22));
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, rInner2, 0, Math.PI * 2);
        ctx.strokeStyle = '#c58c56';
        ctx.stroke();

        // Inner plate decorative star map
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0f15';
        ctx.strokeStyle = 'rgba(197, 140, 86, 0.2)';
        ctx.fill();
        ctx.stroke();

        // 3. Draw Hands/Pointers
        
        // A. Solar Pointer (Golden arm with a Sun disc)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(solarAngle) * rOuter, cy + Math.sin(solarAngle) * rOuter);
        ctx.strokeStyle = '#dfba4b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Sun disc decoration
        ctx.beginPath();
        ctx.arc(cx + Math.cos(solarAngle) * 130, cy + Math.sin(solarAngle) * 130, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#dfba4b';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#dfba4b';
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        ctx.arc(cx + Math.cos(solarAngle) * 130, cy + Math.sin(solarAngle) * 130, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // B. Lunar Pointer (Silver/Iron pointer with phase sphere)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(lunarAngle) * rInner, cy + Math.sin(lunarAngle) * rInner);
        ctx.strokeStyle = '#a0a0b2';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dynamic 3D Moon Phase indicator at radius 100 on lunar hand
        let phase = (state.currentDays % SYNODIC_MONTH) / SYNODIC_MONTH;
        if (phase < 0) phase += 1;
        drawMoonPhaseSphere(ctx, cx + Math.cos(lunarAngle) * 90, cy + Math.sin(lunarAngle) * 90, 8, phase);

        // Center Axis cap
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#6e4726';
        ctx.fill();

        ctx.restore();
    }

    function drawMoonPhaseSphere(ctx, x, y, radius, phase) {
        ctx.save();
        ctx.translate(x, y);
        
        // Draw black background circle
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0f13';
        ctx.fill();
        
        // Draw phase lighting
        ctx.beginPath();
        if (phase <= 0.5) {
            // Waxing: right side lit
            ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false);
            ctx.fillStyle = '#f5da7d';
            ctx.fill();
            
            ctx.beginPath();
            let rx = radius * (1 - 4 * phase);
            ctx.ellipse(0, 0, Math.abs(rx), radius, 0, 0, Math.PI * 2);
            ctx.fillStyle = rx < 0 ? '#f5da7d' : '#0f0f13';
            ctx.fill();
        } else {
            // Waning: left side lit
            ctx.arc(0, 0, radius, Math.PI / 2, -Math.PI / 2, false);
            ctx.fillStyle = '#f5da7d';
            ctx.fill();
            
            ctx.beginPath();
            let rx = radius * (1 - 4 * (phase - 0.5));
            ctx.ellipse(0, 0, Math.abs(rx), radius, 0, 0, Math.PI * 2);
            ctx.fillStyle = rx > 0 ? '#f5da7d' : '#0f0f13';
            ctx.fill();
        }
        
        // Rim Border
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#dfba4b';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Shiny glossy lens overlay
        let gradient = ctx.createRadialGradient(-radius/3, -radius/3, radius/10, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // 9. RENDER VIEW: BACK DIALS (METONIC & SAROS SPIRALS)
    // ----------------------------------------------------------------------
    function drawBackDials() {
        // Two spirals: Metonic (top) and Saros (bottom)
        const cx = 375;
        const metonicY = 175;
        const sarosY = 425;
        const maxRadius = 115;
        const minRadius = 40;

        // 1. Draw Metonic Spiral (Lunar/Solar Calendar, 5 turns, 235 divisions)
        drawSpiralDial(cx, metonicY, minRadius, maxRadius, 5, METONIC_MONTHS, "CICLO METÓNICO (19 AÑOS)", '#ffd700');
        
        // Calculate pointer angle/position for Metonic Spiral
        const totalMonths = state.currentDays / SYNODIC_MONTH;
        let metonicMonth = totalMonths % METONIC_MONTHS;
        if (metonicMonth < 0) metonicMonth += METONIC_MONTHS;
        drawSpiralPointer(cx, metonicY, minRadius, maxRadius, 5, metonicMonth, METONIC_MONTHS, '#dfba4b');

        // 2. Draw Saros Spiral (Eclipse Cycle, 4 turns, 223 divisions)
        drawSpiralDial(cx, sarosY, minRadius, maxRadius, 4, SAROS_MONTHS, "CICLO DE SAROS (ECLIPSES)", '#c58c56');
        
        // Highlight eclipse months on Saros Spiral
        drawEclipseGlifs(cx, sarosY, minRadius, maxRadius, 4);

        // Calculate pointer angle/position for Saros Spiral
        let sarosMonth = totalMonths % SAROS_MONTHS;
        if (sarosMonth < 0) sarosMonth += SAROS_MONTHS;
        drawSpiralPointer(cx, sarosY, minRadius, maxRadius, 4, sarosMonth, SAROS_MONTHS, '#c58c56');
    }

    function drawSpiralDial(cx, cy, rMin, rMax, turns, divisions, label, color) {
        ctx.save();
        
        // Background container
        ctx.beginPath();
        ctx.arc(cx, cy, rMax + 20, 0, Math.PI * 2);
        ctx.fillStyle = '#14141c';
        ctx.strokeStyle = '#2d2d3a';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#8c8c9e';
        ctx.font = 'bold 9px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1px';
        ctx.fillText(label, cx, cy - (rMax + 8));

        // Spiral Groove path
        ctx.beginPath();
        const step = 0.05;
        const totalRad = turns * Math.PI * 2;
        for (let theta = 0; theta <= totalRad; theta += step) {
            const pct = theta / totalRad;
            const r = rMin + (rMax - rMin) * pct;
            const x = cx + Math.cos(theta) * r;
            const y = cy + Math.sin(theta) * r;
            if (theta === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 14; // groove width
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke(); // spiral line core

        // Draw divisions along spiral
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= divisions; i += 5) {
            const pct = i / divisions;
            const theta = pct * totalRad;
            const r = rMin + (rMax - rMin) * pct;
            const nextR = r + 10;
            
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(theta) * (r - 5), cy + Math.sin(theta) * (r - 5));
            ctx.lineTo(cx + Math.cos(theta) * (r + 5), cy + Math.sin(theta) * (r + 5));
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawSpiralPointer(cx, cy, rMin, rMax, turns, monthValue, totalDivisions, color) {
        ctx.save();
        const totalRad = turns * Math.PI * 2;
        const pct = monthValue / totalDivisions;
        const theta = pct * totalRad;
        const r = rMin + (rMax - rMin) * pct;

        // Radial pointer line from axis to pointer pin
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Brass Sliding Pin traveling along the spiral groove
        ctx.beginPath();
        ctx.arc(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.stroke();

        // Small center cap
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#121216';
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fill();

        ctx.restore();
    }

    function drawEclipseGlifs(cx, cy, rMin, rMax, turns) {
        ctx.save();
        const totalRad = turns * Math.PI * 2;
        
        for (let m in ECLIPSES) {
            const idx = parseInt(m);
            const eclipse = ECLIPSES[idx];
            const pct = idx / SAROS_MONTHS;
            const theta = pct * totalRad;
            const r = rMin + (rMax - rMin) * pct;
            
            const ex = cx + Math.cos(theta) * r;
            const ey = cy + Math.sin(theta) * r;
            
            ctx.beginPath();
            ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = eclipse.type === 'solar' ? '#dfba4b' : '#c58c56';
            ctx.shadowBlur = 5;
            ctx.shadowColor = ctx.fillStyle;
            ctx.fill();
        }
        ctx.restore();
    }

    // ----------------------------------------------------------------------
    // 10. MAIN APP DRAW / LOOP
    // ----------------------------------------------------------------------
    function draw() {
        // Clear canvas with deep space blue
        ctx.fillStyle = '#0f0f13';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid lines in canvas background
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw based on selected view mode
        const solarAngle = (state.currentDays / SIDEREAL_YEAR) * Math.PI * 2;
        const lunarAngle = (state.currentDays / SIDEREAL_MONTH) * Math.PI * 2;

        if (state.activeView === 'front') {
            drawFrontDial(solarAngle, lunarAngle);
        } else if (state.activeView === 'internal') {
            // Draw all procedural gears
            gears.forEach(gear => {
                drawGear(gear, solarAngle);
            });
        } else if (state.activeView === 'back') {
            drawBackDials();
        }
    }

    // Handle tick sound synced with gear teeth movement
    function handleTickSync(previousDays, currentDays) {
        const teethFactor = 2 * Math.PI / 64; // One solar gear tooth increment
        const prevAngle = (previousDays / SIDEREAL_YEAR) * 2 * Math.PI;
        const currAngle = (currentDays / SIDEREAL_YEAR) * 2 * Math.PI;

        const prevTickCell = Math.floor(prevAngle / teethFactor);
        const currTickCell = Math.floor(currAngle / teethFactor);

        if (prevTickCell !== currTickCell) {
            playGearTick();
        }
    }

    function update(timestamp) {
        if (!state.lastTime) state.lastTime = timestamp;
        let delta = (timestamp - state.lastTime) / 1000;
        state.lastTime = timestamp;

        if (state.isPlaying) {
            const previousDays = state.currentDays;
            
            // speed scale is months per second
            const daysPerSec = state.speed * SYNODIC_MONTH;
            state.currentDays += daysPerSec * delta;
            
            handleTickSync(previousDays, state.currentDays);

            // Sync Timeline Slider
            let curYear = Math.round(-100 + (state.currentDays / SIDEREAL_YEAR));
            if (curYear >= -150 && curYear <= 50) {
                timeSlider.value = curYear;
            }
            
            updateStatistics();
            draw();
        }
        
        requestAnimationFrame(update);
    }

    // ----------------------------------------------------------------------
    // 11. INTERACTIVE EVENTS & MANUAL CRANK (DRAG & SPIN)
    // ----------------------------------------------------------------------
    let isCranking = false;
    let startCrankAngle = 0;
    
    crankDisc.addEventListener("mousedown", (e) => {
        isCranking = true;
        const rect = crankDisc.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        startCrankAngle = Math.atan2(dy, dx) - state.crankAngle;
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!isCranking) return;

        const rect = crankDisc.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        
        const newAngle = Math.atan2(dy, dx);
        const delta = newAngle - (startCrankAngle + state.crankAngle);
        
        // Accumulate rotation
        state.crankAngle += delta;
        
        // CSS rotation of handle visualizer
        crankHandle.style.transform = `rotate(${state.crankAngle}rad)`;
        
        // Map 1 full crank turn (2pi rad) to 1 Synodic Month (29.53 days)
        const deltaDays = (delta / (Math.PI * 2)) * SYNODIC_MONTH;
        const previousDays = state.currentDays;
        state.currentDays += deltaDays;
        
        handleTickSync(previousDays, state.currentDays);
        
        // Sync Timeline Slider
        let curYear = Math.round(-100 + (state.currentDays / SIDEREAL_YEAR));
        if (curYear >= -150 && curYear <= 50) {
            timeSlider.value = curYear;
        }

        updateStatistics();
        draw();
    });

    window.addEventListener("mouseup", () => {
        isCranking = false;
    });

    // Touch support for Crank
    crankDisc.addEventListener("touchstart", (e) => {
        isCranking = true;
        const touch = e.touches[0];
        const rect = crankDisc.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        startCrankAngle = Math.atan2(dy, dx) - state.crankAngle;
        e.preventDefault();
    });

    window.addEventListener("touchmove", (e) => {
        if (!isCranking) return;
        const touch = e.touches[0];
        const rect = crankDisc.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        
        const newAngle = Math.atan2(dy, dx);
        const delta = newAngle - (startCrankAngle + state.crankAngle);
        
        state.crankAngle += delta;
        crankHandle.style.transform = `rotate(${state.crankAngle}rad)`;
        
        const deltaDays = (delta / (Math.PI * 2)) * SYNODIC_MONTH;
        const previousDays = state.currentDays;
        state.currentDays += deltaDays;
        
        handleTickSync(previousDays, state.currentDays);
        
        updateStatistics();
        draw();
    });

    window.addEventListener("touchend", () => {
        isCranking = false;
    });

    // Slider inputs
    timeSlider.addEventListener("input", (e) => {
        const year = parseInt(e.target.value);
        state.currentDays = (year + 100) * SIDEREAL_YEAR;
        updateStatistics();
        draw();
    });

    speedSlider.addEventListener("input", (e) => {
        state.speed = parseInt(e.target.value);
        speedReadout.textContent = `Modo: ${state.speed === 1 ? 'Lento' : state.speed > 8 ? 'Rápido' : 'Estándar'} (${state.speed}x)`;
    });

    audioToggle.addEventListener("change", (e) => {
        state.audioEnabled = e.target.checked;
        volumeIcon.setAttribute("data-lucide", state.audioEnabled ? "volume-2" : "volume-x");
        volumeIcon.style.color = state.audioEnabled ? "var(--color-gold)" : "var(--color-text-dark)";
        lucide.createIcons();
    });

    // Playback buttons
    btnPlay.addEventListener("click", () => {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            playIcon.setAttribute("data-lucide", "pause");
            playText.textContent = "Pausar";
            btnPlay.classList.add("btn-secondary");
            btnPlay.classList.remove("btn-primary");
            state.lastTime = performance.now();
        } else {
            playIcon.setAttribute("data-lucide", "play");
            playText.textContent = "Reanudar";
            btnPlay.classList.remove("btn-secondary");
            btnPlay.classList.add("btn-primary");
        }
        lucide.createIcons();
    });

    btnPrev.addEventListener("click", () => {
        const prevDays = state.currentDays;
        state.currentDays -= SYNODIC_MONTH; // go back 1 month
        handleTickSync(prevDays, state.currentDays);
        updateStatistics();
        draw();
    });

    btnNext.addEventListener("click", () => {
        const prevDays = state.currentDays;
        state.currentDays += SYNODIC_MONTH; // forward 1 month
        handleTickSync(prevDays, state.currentDays);
        updateStatistics();
        draw();
    });

    // View toggles
    const tabs = [tabFront, tabInternal, tabBack];
    tabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            tabs.forEach(t => t.classList.remove("active"));
            const targetTab = e.currentTarget;
            targetTab.classList.add("active");
            
            state.activeView = targetTab.dataset.view;
            
            // Update quick view help text
            if (state.activeView === 'front') {
                quickViewDesc.innerHTML = `<strong>Esfera Frontal:</strong> Muestra la posición del Sol y la Luna en el Zodíaco y el calendario egipcio de 365 días. La pequeña esfera bicolor representa la fase lunar exacta.`;
            } else if (state.activeView === 'internal') {
                quickViewDesc.innerHTML = `<strong>Engranajes Internos:</strong> Muestra el tren de engranajes simulados de bronce. Pasa el cursor sobre cualquier engranaje para ver su información de dientes e historia en la barra lateral derecha.`;
            } else if (state.activeView === 'back') {
                quickViewDesc.innerHTML = `<strong>Esferas Traseras:</strong> Muestra el espiral Metónico (235 divisiones) y el Saros (223 divisiones). Los glifos coloreados en el Saros representan predicciones de eclipses solares y lunares.`;
            }

            draw();
        });
    });

    // ----------------------------------------------------------------------
    // 12. HOVER DETECTION (For gears inside canvas)
    // ----------------------------------------------------------------------
    canvas.addEventListener("mousemove", (e) => {
        if (state.activeView !== 'internal') {
            state.hoveredComponent = null;
            return;
        }

        const rect = canvas.getBoundingClientRect();
        // Scale coordinate matching canvas size ratio
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);

        let found = null;
        for (let i = gears.length - 1; i >= 0; i--) {
            const gear = gears[i];
            const dx = mx - gear.x;
            const dy = my - gear.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < gear.radius) {
                found = gear;
                break;
            }
        }

        if (found) {
            if (state.hoveredComponent !== found.id) {
                state.hoveredComponent = found.id;
                
                // Update component education card on the sidebar
                componentInfo.innerHTML = `
                    <div class="info-detail">
                        <h3>${found.name}</h3>
                        <span class="component-tag">Engranaje ${found.id}</span>
                        <p>${found.desc}</p>
                        <div class="math-ratio">
                            <div class="ratio-title">Cantidad de Dientes</div>
                            <div class="ratio-val">${found.teeth} dientes</div>
                        </div>
                        <div class="math-ratio">
                            <div class="ratio-title">Relación de Velocidad</div>
                            <div class="ratio-val">${found.speedRatio.toFixed(4)} revoluciones/año</div>
                        </div>
                    </div>
                `;
                draw(); // Redraw immediately to show highlight
            }
        } else {
            if (state.hoveredComponent !== null) {
                state.hoveredComponent = null;
                componentInfo.innerHTML = `
                    <div class="info-placeholder">
                        <p>Pasa el cursor por los engranajes o diales en la pantalla para analizar su funcionamiento histórico y cantidad de dientes.</p>
                        <div class="info-graphic">
                            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" class="floating-svg">
                                <circle cx="50" cy="50" r="30" stroke="var(--color-bronze)" stroke-width="2" stroke-dasharray="8 4"/>
                                <path d="M50 20 L50 80 M20 50 L80 50" stroke="var(--color-gold-dim)" stroke-width="1.5"/>
                                <circle cx="50" cy="50" r="10" fill="var(--color-bronze-dark)" stroke="var(--color-gold)" stroke-width="2"/>
                            </svg>
                        </div>
                    </div>
                `;
                draw();
            }
        }
    });

    // ----------------------------------------------------------------------
    // 13. BOOTSTRAP INITIALIZATION
    // ----------------------------------------------------------------------
    updateStatistics();
    draw();
    
    // Start requestAnimationFrame loop
    requestAnimationFrame(update);
});
