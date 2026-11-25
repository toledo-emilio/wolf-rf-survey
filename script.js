// ==========================================
// DATOS INICIALES DE EJEMPLO (10 PUNTOS CASA)
// ==========================================
const DATOS_DEMO = [
    { escenario: "antes", fecha: "2026-11-25 10:00", punto: "P01", x: 1, y: 1, zona: "Living / Router", responsable: "Técnico RF", rssi: -45, snr: 42, canal: 6, banda: "2.4 GHz", latencia: 11, throughput: 140, dispositivo: "Notebook", observaciones: "Línea base junto al router" },
    { escenario: "antes", fecha: "2026-11-25 10:05", punto: "P02", x: 2, y: 2, zona: "Comedor", responsable: "Técnico RF", rssi: -58, snr: 30, canal: 6, banda: "2.4 GHz", latencia: 88, throughput: 32, dispositivo: "Notebook", observaciones: "Canal 6 saturado por vecinos" },
    { escenario: "antes", fecha: "2026-11-25 10:10", punto: "P03", x: 3, y: 2, zona: "Cocina", responsable: "Técnico RF", rssi: -66, snr: 22, canal: 6, banda: "2.4 GHz", latencia: 95, throughput: 24, dispositivo: "Notebook", observaciones: "Atenuación por muro y electrodomésticos" },
    { escenario: "antes", fecha: "2026-11-25 10:15", punto: "P04", x: 4, y: 3, zona: "Dormitorio Principal", responsable: "Técnico RF", rssi: -77, snr: 13, canal: 6, banda: "2.4 GHz", latencia: 76, throughput: 18, dispositivo: "Notebook", observaciones: "Dos muros interiores" },
    { escenario: "antes", fecha: "2026-11-25 10:20", punto: "P05", x: 5, y: 4, zona: "Dormitorio 2", responsable: "Técnico RF", rssi: -83, snr: 9, canal: 6, banda: "2.4 GHz", latencia: 130, throughput: 8, dispositivo: "Notebook", observaciones: "Zona crítica al fondo" },

    { escenario: "despues", fecha: "2026-11-25 11:00", punto: "P01", x: 1, y: 1, zona: "Living / Router", responsable: "Técnico RF", rssi: -43, snr: 45, canal: 36, banda: "5 GHz", latencia: 8, throughput: 420, dispositivo: "Notebook", observaciones: "Migrado a 5 GHz canal 36" },
    { escenario: "despues", fecha: "2026-11-25 11:05", punto: "P02", x: 2, y: 2, zona: "Comedor", responsable: "Técnico RF", rssi: -53, snr: 36, canal: 36, banda: "5 GHz", latencia: 14, throughput: 310, dispositivo: "Notebook", observaciones: "Sin interferencia co-canal" },
    { escenario: "despues", fecha: "2026-11-25 11:10", punto: "P03", x: 3, y: 2, zona: "Cocina", responsable: "Técnico RF", rssi: -61, snr: 28, canal: 36, banda: "5 GHz", latencia: 19, throughput: 215, dispositivo: "Notebook", observaciones: "Mejora clara de estabilidad" },
    { escenario: "despues", fecha: "2026-11-25 11:15", punto: "P04", x: 4, y: 3, zona: "Dormitorio Principal", responsable: "Técnico RF", rssi: -68, snr: 21, canal: 44, banda: "5 GHz", latencia: 24, throughput: 145, dispositivo: "Notebook", observaciones: "Router reubicado en altura" },
    { escenario: "despues", fecha: "2026-11-25 11:20", punto: "P05", x: 5, y: 4, zona: "Dormitorio 2", responsable: "Técnico RF", rssi: -73, snr: 17, canal: 44, banda: "5 GHz", latencia: 32, throughput: 95, dispositivo: "Notebook", observaciones: "Cobertura recuperada" }
];

let mediciones = JSON.parse(localStorage.getItem("wolf_mediciones")) || [...DATOS_DEMO];
let filtroEscenario = "todos";
let textoBusqueda = "";
let puntoResaltadoId = null;

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const formulario = document.getElementById("medicionForm");
const tabla = document.getElementById("tablaMediciones");
const totalMediciones = document.getElementById("totalMediciones");
const promedioRssi = document.getElementById("promedioRssi");
const promedioLatencia = document.getElementById("promedioLatencia");
const puntosCriticos = document.getElementById("puntosCriticos");
const estadoGeneral = document.getElementById("estadoGeneral");
const diagnostico = document.getElementById("diagnostico");

const filtroEscenarioGlobal = document.getElementById("filtroEscenarioGlobal");
const buscadorMapa = document.getElementById("buscadorMapa");
const buscadorTabla = document.getElementById("buscadorTabla");

// ==========================================
// MOTOR DE MAPA DE CALOR + DETECCIÓN DE MUROS
// ==========================================
const canvas = document.getElementById("planoCanvas");
const ctx = canvas.getContext("2d");

const GRID_W = 152;
const GRID_H = 96;
let wallGrid = new Uint8Array(GRID_W * GRID_H);
let planoFondoImg = null;
let routerPos = { x: 140, y: 120 };
let modoInteraccion = "router"; // router | muro | borrar
let dibujando = false;

const habitacionesEjemplo = [
    { nombre: "LIVING (Router)", x: 110, y: 95 },
    { nombre: "COMEDOR", x: 310, y: 120 },
    { nombre: "COCINA", x: 560, y: 110 },
    { nombre: "PASILLO", x: 340, y: 255 },
    { nombre: "DORM. PRINCIPAL", x: 150, y: 375 },
    { nombre: "DORM. 2", x: 560, y: 375 }
];

function generarPlanoBaseEjemplo() {
    planoFondoImg = null;
    wallGrid.fill(0);

    const dibujarMuroRect = (x1, y1, x2, y2) => {
        const gx1 = Math.max(0, Math.min(GRID_W - 1, Math.floor((x1 / canvas.width) * GRID_W)));
        const gy1 = Math.max(0, Math.min(GRID_H - 1, Math.floor((y1 / canvas.height) * GRID_H)));
        const gx2 = Math.max(0, Math.min(GRID_W - 1, Math.floor((x2 / canvas.width) * GRID_W)));
        const gy2 = Math.max(0, Math.min(GRID_H - 1, Math.floor((y2 / canvas.height) * GRID_H)));
        for (let y = Math.min(gy1, gy2); y <= Math.max(gy1, gy2); y++) {
            for (let x = Math.min(gx1, gx2); x <= Math.max(gx1, gx2); x++) {
                wallGrid[y * GRID_W + x] = 1;
            }
        }
    };

    // Perímetro exterior
    dibujarMuroRect(20, 20, 740, 26);
    dibujarMuroRect(20, 454, 740, 460);
    dibujarMuroRect(20, 20, 26, 460);
    dibujarMuroRect(734, 20, 740, 460);

    // Muros interiores con puertas
    dibujarMuroRect(240, 20, 246, 165);
    dibujarMuroRect(460, 20, 466, 175);
    dibujarMuroRect(20, 220, 210, 226);
    dibujarMuroRect(450, 220, 740, 226);
    dibujarMuroRect(380, 290, 386, 460);

    routerPos = { x: 120, y: 110 };
    renderizarMapaCalor();
}

function detectarMurosDesdeImagen(img) {
    const offCanvas = document.createElement("canvas");
    offCanvas.width = GRID_W;
    offCanvas.height = GRID_H;
    const offCtx = offCanvas.getContext("2d");
    offCtx.drawImage(img, 0, 0, GRID_W, GRID_H);

    const imgData = offCtx.getImageData(0, 0, GRID_W, GRID_H).data;
    const umbral = Number(document.getElementById("umbralMuros").value);
    wallGrid.fill(0);

    let murosDetectados = 0;
    for (let i = 0; i < GRID_W * GRID_H; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const a = imgData[i * 4 + 3];
        const brillo = 0.299 * r + 0.587 * g + 0.114 * b;

        if (a > 128 && brillo < umbral) {
            wallGrid[i] = 1;
            murosDetectados++;
        }
    }

    document.getElementById("estadoMapaTexto").textContent =
        `✅ Plano cargado: ${murosDetectados} celdas de muro detectadas automáticamente. Haz clic para mover el Router.`;
    renderizarMapaCalor();
}

function contarMurosEnLinea(gx0, gy0, gx1, gy1) {
    let cruces = 0;
    let enMuro = false;
    const dx = gx1 - gx0;
    const dy = gy1 - gy0;
    const pasos = Math.max(Math.abs(dx), Math.abs(dy));
    if (pasos === 0) return 0;

    for (let s = 1; s <= pasos; s++) {
        const x = Math.round(gx0 + (dx * s) / pasos);
        const y = Math.round(gy0 + (dy * s) / pasos);
        if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
            const esMuro = wallGrid[y * GRID_W + x] === 1;
            if (esMuro && !enMuro) {
                cruces++;
                enMuro = true;
            } else if (!esMuro) {
                enMuro = false;
            }
        }
    }
    return cruces;
}

function colorSegunRssi(rssi) {
    // Verde (-35 dBm) -> Amarillo (-65 dBm) -> Rojo (-88 dBm)
    const norm = Math.max(0, Math.min(1, (rssi - -88) / (-35 - -88)));
    let r, g, b = 30;
    if (norm < 0.5) {
        const t = norm * 2;
        r = 235;
        g = Math.round(60 + t * 175);
    } else {
        const t = (norm - 0.5) * 2;
        r = Math.round(235 - t * 200);
        g = 215;
    }
    return [r, g, b, 150];
}

function renderizarMapaCalor() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Fondo blanco o imagen subida
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (planoFondoImg) {
        ctx.drawImage(planoFondoImg, 0, 0, canvas.width, canvas.height);
    }

    // 2. Calcular propagación RF + atenuación por muros (Raycasting)
    const txPower = Number(document.getElementById("potenciaTx").value);
    const perdidaPorMuro = Number(document.getElementById("materialMuro").value);
    const rGx = Math.floor((routerPos.x / canvas.width) * GRID_W);
    const rGy = Math.floor((routerPos.y / canvas.height) * GRID_H);

    const heatCanvas = document.createElement("canvas");
    heatCanvas.width = GRID_W;
    heatCanvas.height = GRID_H;
    const hCtx = heatCanvas.getContext("2d");
    const heatImg = hCtx.createImageData(GRID_W, GRID_H);

    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const idx = (y * GRID_W + x) * 4;
            if (wallGrid[y * GRID_W + x] === 1) {
                heatImg.data[idx] = 15;
                heatImg.data[idx + 1] = 23;
                heatImg.data[idx + 2] = 42;
                heatImg.data[idx + 3] = 235;
                continue;
            }

            const distPx = Math.hypot(x - rGx, y - rGy);
            const distMetros = Math.max(1, distPx * 0.18);
            const murosCruzados = contarMurosEnLinea(rGx, rGy, x, y);

            // Modelo log-distancia + pérdida por muros
            const rssiEstimado = txPower - 42 - 22 * Math.log10(distMetros) - murosCruzados * perdidaPorMuro;
            const [r, g, b, a] = colorSegunRssi(rssiEstimado);

            heatImg.data[idx] = r;
            heatImg.data[idx + 1] = g;
            heatImg.data[idx + 2] = b;
            heatImg.data[idx + 3] = a;
        }
    }

    hCtx.putImageData(heatImg, 0, 0);
    ctx.drawImage(heatCanvas, 0, 0, canvas.width, canvas.height);

    // 3. Etiquetas de habitaciones si es plano ejemplo
    if (!planoFondoImg) {
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
        habitacionesEjemplo.forEach(h => {
            ctx.fillText(h.nombre, h.x, h.y);
        });
    }

    // 4. Dibujar puntos reales medidos encima del plano
    const visibles = obtenerMedicionesFiltradas();
    visibles.forEach(m => {
        const px = ((Number(m.x) - 0.5) / 5) * (canvas.width - 100) + 50;
        const py = ((Number(m.y) - 0.5) / 5) * (canvas.height - 80) + 40;
        const esResaltado = puntoResaltadoId && m.punto.toLowerCase().includes(puntoResaltadoId.toLowerCase());

        if (esResaltado) {
            ctx.beginPath();
            ctx.arc(px, py, 22, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(37, 99, 235, 0.28)";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#1d4ed8";
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fillStyle = m.rssi >= -67 ? "#16a34a" : (m.rssi >= -75 ? "#eab308" : "#dc2626");
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.fillText(`${m.punto} (${m.rssi} dBm)`, px + 14, py + 4);
    });

    // 5. Dibujar icono del Router/AP
    ctx.beginPath();
    ctx.arc(routerPos.x, routerPos.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillText("AP", routerPos.x - 8, routerPos.y + 4);
}

// Eventos del canvas
canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    if (modoInteraccion === "router") {
        routerPos = { x: cx, y: cy };
        renderizarMapaCalor();
    } else {
        dibujando = true;
        editarCeldaMuro(cx, cy, modoInteraccion === "muro" ? 1 : 0);
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (!dibujando) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    editarCeldaMuro(cx, cy, modoInteraccion === "muro" ? 1 : 0);
});

window.addEventListener("mouseup", () => {
    dibujando = false;
});

function editarCeldaMuro(cx, cy, valor) {
    const gx = Math.floor((cx / canvas.width) * GRID_W);
    const gy = Math.floor((cy / canvas.height) * GRID_H);
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                wallGrid[ny * GRID_W + nx] = valor;
            }
        }
    }
    renderizarMapaCalor();
}

// Controles del mapa
document.getElementById("inputPlanoImg").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            planoFondoImg = img;
            detectarMurosDesdeImagen(img);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById("btnPlanoEjemplo").addEventListener("click", generarPlanoBaseEjemplo);

document.getElementById("umbralMuros").addEventListener("input", (e) => {
    document.getElementById("valUmbral").textContent = e.target.value;
    if (planoFondoImg) detectarMurosDesdeImagen(planoFondoImg);
});

document.getElementById("potenciaTx").addEventListener("input", (e) => {
    document.getElementById("valTx").textContent = `${e.target.value} dBm`;
    renderizarMapaCalor();
});

document.getElementById("materialMuro").addEventListener("change", renderizarMapaCalor);

const setModo = (modo, btnId) => {
    modoInteraccion = modo;
    ["btnModoRouter", "btnModoMuro", "btnModoBorrarMuro"].forEach(id => {
        document.getElementById(id).className = id === btnId ? "btn-activo" : "btn-neutro";
    });
};

document.getElementById("btnModoRouter").addEventListener("click", () => setModo("router", "btnModoRouter"));
document.getElementById("btnModoMuro").addEventListener("click", () => setModo("muro", "btnModoMuro"));
document.getElementById("btnModoBorrarMuro").addEventListener("click", () => setModo("borrar", "btnModoBorrarMuro"));

// ==========================================
// GRÁFICOS CHART.JS (RSSI + USO DE CANALES)
// ==========================================
const graficoRssi = new Chart(document.getElementById("rssiChart").getContext("2d"), {
    type: "bar",
    data: {
        labels: [],
        datasets: [
            { label: "ANTES (dBm)", data: [], backgroundColor: "rgba(239, 68, 68, 0.75)" },
            { label: "DESPUÉS (dBm)", data: [], backgroundColor: "rgba(16, 185, 129, 0.75)" }
        ]
    },
    options: {
        responsive: true,
        scales: {
            y: { suggestedMin: -95, suggestedMax: -30 }
        }
    }
});

const graficoCanales = new Chart(document.getElementById("canalesChart").getContext("2d"), {
    type: "bar",
    data: {
        labels: [],
        datasets: [
            { label: "Puntos en ANTES", data: [], backgroundColor: "rgba(245, 158, 11, 0.8)" },
            { label: "Puntos en DESPUÉS", data: [], backgroundColor: "rgba(37, 99, 235, 0.8)" }
        ]
    },
    options: {
        responsive: true,
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
    }
});

// ==========================================
// REGLAS DE DIAGNÓSTICO LÓGICO WOLF
// ==========================================
function evaluarReglasWolf(m) {
    const alertas = [];
    if (m.rssi <= -75) alertas.push("Cobertura baja (RSSI <= -75 dBm)");
    if (m.snr < 15) alertas.push("Margen SNR bajo (< 15 dB)");
    if (m.rssi > -62 && m.latencia >= 80) alertas.push("Posible interferencia/saturación con buena señal");
    if (m.banda === "2.4 GHz" && [1, 6, 11].includes(Number(m.canal)) && m.latencia >= 80) {
        alertas.push("Canal 2.4 GHz congestionado");
    }
    return alertas.length > 0 ? alertas.join(" | ") : "Condición dentro de parámetros normales";
}

// ==========================================
// FILTRADO Y BUSCADOR SINCRONIZADO
// ==========================================
function obtenerMedicionesFiltradas() {
    return mediciones.filter(m => {
        const cumpleEscenario = filtroEscenario === "todos" || m.escenario === filtroEscenario;
        if (!cumpleEscenario) return false;
        if (!textoBusqueda) return true;

        const q = textoBusqueda.toLowerCase();
        const diag = evaluarReglasWolf(m).toLowerCase();
        return (
            m.punto.toLowerCase().includes(q) ||
            m.zona.toLowerCase().includes(q) ||
            m.banda.toLowerCase().includes(q) ||
            `ch ${m.canal}`.includes(q) ||
            String(m.canal).includes(q) ||
            m.escenario.toLowerCase().includes(q) ||
            (m.observaciones || "").toLowerCase().includes(q) ||
            diag.includes(q)
        );
    });
}

function sincronizarBusqueda(valor) {
    textoBusqueda = valor.trim();
    buscadorMapa.value = valor;
    buscadorTabla.value = valor;
    puntoResaltadoId = textoBusqueda || null;

    const filtradas = obtenerMedicionesFiltradas();
    if (textoBusqueda && filtradas.length > 0) {
        document.getElementById("estadoMapaTexto").textContent =
            `🔍 Mostrando ${filtradas.length} coincidencia(s) para "${textoBusqueda}" resaltadas en el plano y tabla.`;
    } else if (textoBusqueda) {
        document.getElementById("estadoMapaTexto").textContent =
            `⚠️ Sin coincidencias para "${textoBusqueda}".`;
    } else {
        document.getElementById("estadoMapaTexto").textContent =
            "💡 Haz clic en cualquier habitación para ubicar el Router o escribe arriba para localizar un punto medido.";
    }

    actualizarTabla();
    renderizarMapaCalor();
}

buscadorMapa.addEventListener("input", (e) => sincronizarBusqueda(e.target.value));
buscadorTabla.addEventListener("input", (e) => sincronizarBusqueda(e.target.value));

document.getElementById("btnLimpiarBusquedaMapa").addEventListener("click", () => sincronizarBusqueda(""));
document.getElementById("btnLimpiarBusquedaTabla").addEventListener("click", () => sincronizarBusqueda(""));

filtroEscenarioGlobal.addEventListener("change", (e) => {
    filtroEscenario = e.target.value;
    guardarYActualizar();
});

// ==========================================
// ACTUALIZACIÓN DE INTERFAZ Y GRÁFICOS
// ==========================================
function actualizarTabla() {
    tabla.innerHTML = "";
    const lista = obtenerMedicionesFiltradas();

    lista.forEach((m) => {
        const indexReal = mediciones.indexOf(m);
        let estado = "Excelente";
        if (m.rssi <= -75) estado = "Crítico";
        else if (m.rssi < -67) estado = "Regular";

        const diag = evaluarReglasWolf(m);
        const claseFila = textoBusqueda ? "fila-resaltada" : "";

        tabla.innerHTML += `
            <tr class="${claseFila}">
                <td><strong>${m.escenario.toUpperCase()}</strong></td>
                <td><strong>${m.punto}</strong></td>
                <td>(${m.x},${m.y})</td>
                <td>${m.zona}</td>
                <td>${m.banda} / Ch ${m.canal}</td>
                <td>${m.rssi} dBm</td>
                <td>${m.snr} dB</td>
                <td>${m.latencia} ms</td>
                <td>${m.throughput} Mbps</td>
                <td><span style="font-weight:700; color:${estado === 'Crítico' ? '#dc2626' : (estado === 'Regular' ? '#d97706' : '#16a34a')}">${estado}</span></td>
                <td style="text-align:left">${diag}${m.observaciones ? ` — <em>${m.observaciones}</em>` : ""}</td>
                <td><button class="btn-peligro" style="padding:4px 8px;" onclick="eliminarMedicion(${indexReal})">🗑</button></td>
            </tr>
        `;
    });
}

function actualizarDashboard() {
    const lista = obtenerMedicionesFiltradas();
    totalMediciones.textContent = lista.length;

    if (lista.length === 0) {
        promedioRssi.textContent = "0 dBm";
        promedioLatencia.textContent = "0 ms";
        puntosCriticos.textContent = "0";
        estadoGeneral.textContent = "Sin datos";
        diagnostico.textContent = "Aún no existen mediciones para el filtro seleccionado.";
        return;
    }

    const promRssi = (lista.reduce((s, m) => s + Number(m.rssi), 0) / lista.length).toFixed(1);
    const promLat = (lista.reduce((s, m) => s + Number(m.latencia), 0) / lista.length).toFixed(1);
    const criticos = lista.filter(m => Number(m.rssi) <= -75).length;

    promedioRssi.textContent = `${promRssi} dBm`;
    promedioLatencia.textContent = `${promLat} ms`;
    puntosCriticos.textContent = criticos;

    if (promRssi >= -67) estadoGeneral.textContent = "Excelente";
    else if (promRssi > -75) estadoGeneral.textContent = "Regular";
    else estadoGeneral.textContent = "Crítico";

    const antes = mediciones.filter(m => m.escenario === "antes");
    const despues = mediciones.filter(m => m.escenario === "despues");

    let htmlDiag = `📊 <strong>Resumen activo:</strong> ${lista.length} mediciones | RSSI promedio: <strong>${promRssi} dBm</strong> | Latencia promedio: <strong>${promLat} ms</strong> | Puntos críticos (≤ -75 dBm): <strong>${criticos}</strong>.`;

    if (antes.length > 0 && despues.length > 0) {
        const rssiA = (antes.reduce((s, m) => s + Number(m.rssi), 0) / antes.length).toFixed(1);
        const rssiD = (despues.reduce((s, m) => s + Number(m.rssi), 0) / despues.length).toFixed(1);
        const latA = (antes.reduce((s, m) => s + Number(m.latencia), 0) / antes.length).toFixed(1);
        const latD = (despues.reduce((s, m) => s + Number(m.latencia), 0) / despues.length).toFixed(1);

        htmlDiag += `<br><br>⚖️ <strong>Comparativa Antes vs Después:</strong> RSSI pasó de <strong>${rssiA} dBm</strong> a <strong>${rssiD} dBm</strong> (${(rssiD - rssiA).toFixed(1)} dB) y la latencia pasó de <strong>${latA} ms</strong> a <strong>${latD} ms</strong>.`;
    }

    diagnostico.innerHTML = htmlDiag;
}

function actualizarGraficos() {
    // 1. Gráfico RSSI por Punto
    const puntos = [...new Set(mediciones.map(m => m.punto))];
    graficoRssi.data.labels = puntos;
    graficoRssi.data.datasets[0].data = puntos.map(p => {
        const m = mediciones.find(x => x.punto === p && x.escenario === "antes");
        return m ? m.rssi : null;
    });
    graficoRssi.data.datasets[1].data = puntos.map(p => {
        const m = mediciones.find(x => x.punto === p && x.escenario === "despues");
        return m ? m.rssi : null;
    });
    graficoRssi.update();

    // 2. Gráfico de Canales Utilizados
    const canalesUnicos = [...new Set(mediciones.map(m => `Ch ${m.canal} (${m.banda})`))];
    graficoCanales.data.labels = canalesUnicos;
    graficoCanales.data.datasets[0].data = canalesUnicos.map(label =>
        mediciones.filter(m => `Ch ${m.canal} (${m.banda})` === label && m.escenario === "antes").length
    );
    graficoCanales.data.datasets[1].data = canalesUnicos.map(label =>
        mediciones.filter(m => `Ch ${m.canal} (${m.banda})` === label && m.escenario === "despues").length
    );
    graficoCanales.update();
}

function guardarYActualizar() {
    localStorage.setItem("wolf_mediciones", JSON.stringify(mediciones));
    actualizarTabla();
    actualizarDashboard();
    actualizarGraficos();
    renderizarMapaCalor();
}

// ==========================================
// ACCIONES DEL FORMULARIO Y CSV
// ==========================================
formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    const nueva = {
        escenario: document.getElementById("escenario").value,
        fecha: new Date().toLocaleString("es-CL"),
        punto: document.getElementById("punto").value.trim(),
        x: Number(document.getElementById("posX").value),
        y: Number(document.getElementById("posY").value),
        zona: document.getElementById("zona").value,
        responsable: document.getElementById("responsable").value,
        rssi: Number(document.getElementById("rssi").value),
        snr: Number(document.getElementById("snr").value),
        canal: Number(document.getElementById("canal").value),
        banda: document.getElementById("banda").value,
        latencia: Number(document.getElementById("latencia").value),
        throughput: Number(document.getElementById("throughput").value),
        dispositivo: document.getElementById("dispositivo").value,
        observaciones: document.getElementById("observaciones").value.trim()
    };

    mediciones.push(nueva);
    guardarYActualizar();
    formulario.reset();
});

window.eliminarMedicion = (index) => {
    if (!confirm("¿Eliminar esta medición?")) return;
    mediciones.splice(index, 1);
    guardarYActualizar();
};

document.getElementById("btnLimpiar").addEventListener("click", () => {
    if (!confirm("¿Borrar todas las mediciones guardadas?")) return;
    mediciones = [];
    guardarYActualizar();
});

document.getElementById("btnCargarDemo").addEventListener("click", () => {
    mediciones = [...DATOS_DEMO];
    guardarYActualizar();
});

// Captura en vivo (intenta conectar con backend Python si está corriendo; si no, simula medición realista)
document.getElementById("btnCapturarAuto").addEventListener("click", async () => {
    const esc = document.getElementById("escenario").value;
    const puntoId = document.getElementById("punto").value.trim() || `P0${(mediciones.length % 9) + 1}`;
    const x = Number(document.getElementById("posX").value) || 2;
    const y = Number(document.getElementById("posY").value) || 2;

    try {
        const res = await fetch(`/api/capturar?escenario=${esc}&punto_id=${puntoId}&x=${x}&y=${y}`);
        if (!res.ok) throw new Error("Sin backend");
        const data = await res.json();
        if (data.ok && data.registro) {
            mediciones.push(data.registro);
            guardarYActualizar();
            return;
        }
    } catch (_) {
        // Fallback realista si se abre directo como archivo local sin Python
        const esDespues = esc === "despues";
        const rssiSim = esDespues ? -52 - Math.floor(Math.random() * 14) : -65 - Math.floor(Math.random() * 18);
        const latSim = esDespues ? 12 + Math.floor(Math.random() * 15) : 55 + Math.floor(Math.random() * 55);

        mediciones.push({
            escenario: esc,
            fecha: new Date().toLocaleString("es-CL"),
            punto: puntoId,
            x,
            y,
            zona: document.getElementById("zona").value,
            responsable: "Técnico RF",
            rssi: rssiSim,
            snr: Math.max(8, rssiSim + 92),
            canal: esDespues ? 36 : 6,
            banda: esDespues ? "5 GHz" : "2.4 GHz",
            latencia: latSim,
            throughput: esDespues ? 240 : 28,
            dispositivo: "Notebook",
            observaciones: "Captura rápida desde estación de trabajo"
        });
        guardarYActualizar();
    }
});

// Exportar CSV
document.getElementById("btnExportarCsv").addEventListener("click", () => {
    if (mediciones.length === 0) return alert("No hay datos para exportar.");
    const headers = ["escenario", "fecha", "punto", "x", "y", "zona", "responsable", "rssi", "snr", "canal", "banda", "latencia", "throughput", "dispositivo", "observaciones"];
    const filas = mediciones.map(m => headers.map(h => `"${String(m[h] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...filas].join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = "mediciones_wolf_rf.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// Importar CSV
document.getElementById("inputImportarCsv").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const lineas = ev.target.result.split(/\r?\n/).filter(l => l.trim());
        if (lineas.length < 2) return;
        const headers = lineas[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        const importados = [];

        for (let i = 1; i < lineas.length; i++) {
            const cols = lineas[i].split(",").map(c => c.replace(/^"|"$/g, "").trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = cols[idx]);
            importados.push({
                escenario: obj.escenario || "antes",
                fecha: obj.fecha || new Date().toLocaleString("es-CL"),
                punto: obj.punto || `P0${i}`,
                x: Number(obj.x) || 1,
                y: Number(obj.y) || 1,
                zona: obj.zona || "General",
                responsable: obj.responsable || "Técnico RF",
                rssi: Number(obj.rssi) || -65,
                snr: Number(obj.snr) || 25,
                canal: Number(obj.canal) || 36,
                banda: obj.banda || "5 GHz",
                latencia: Number(obj.latencia) || 20,
                throughput: Number(obj.throughput) || 100,
                dispositivo: obj.dispositivo || "Notebook",
                observaciones: obj.observaciones || ""
            });
        }
        mediciones = importados;
        guardarYActualizar();
    };
    reader.readAsText(file);
});

// INICIALIZAR TODO
generarPlanoBaseEjemplo();
guardarYActualizar();