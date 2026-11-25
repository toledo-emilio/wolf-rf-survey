const formulario = document.getElementById("medicionForm");
const tabla = document.getElementById("tablaMediciones");

const totalMediciones = document.getElementById("totalMediciones");
const promedioRssi = document.getElementById("promedioRssi");
const puntosCriticos = document.getElementById("puntosCriticos");
const estadoGeneral = document.getElementById("estadoGeneral");
const diagnostico = document.getElementById("diagnostico");

let mediciones =
    JSON.parse(localStorage.getItem("mediciones")) || [];

// GRAFICO
const ctx = document.getElementById("rssiChart").getContext("2d");

const grafico = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "RSSI",
            data: [],
            borderWidth: 3,
            tension: 0.3
        }]
    },
    options: {
        responsive: true
    }
});

// GUARDAR MEDICION
formulario.addEventListener("submit", function (e) {

    e.preventDefault();

    const medicion = {
        fecha: new Date().toLocaleString("es-CL"),
        punto: document.getElementById("punto").value,
        zona: document.getElementById("zona").value,
        responsable: document.getElementById("responsable").value,
        rssi: Number(document.getElementById("rssi").value),
        snr: Number(document.getElementById("snr").value),
        canal: document.getElementById("canal").value,
        banda: document.getElementById("banda").value,
        latencia: document.getElementById("latencia").value,
        dispositivo: document.getElementById("dispositivo").value,
        observaciones: document.getElementById("observaciones").value
    };
    if (medicion.rssi > -30 || medicion.rssi < -100) {
    alert("Ingrese un RSSI válido entre -30 y -100 dBm");
    return;
}

    mediciones.push(medicion);

    localStorage.setItem(
    "mediciones",
    JSON.stringify(mediciones)
);

actualizarTabla();
actualizarDashboard();
actualizarGrafico();

document.getElementById("btnLimpiar").addEventListener("click", () => {

    if (confirm("¿Seguro que deseas borrar todas las mediciones?")) {

        mediciones = [];

        localStorage.removeItem("mediciones");

        actualizarTabla();
        actualizarDashboard();
        actualizarGrafico();

        diagnostico.textContent =
            "Aún no existen mediciones registradas.";
    }

});

    formulario.reset();
});

// TABLA
function actualizarTabla() {

    tabla.innerHTML = "";

    mediciones.forEach((m, index) => {


        let estado = "Excelente";

        if (m.rssi < -80) {
            estado = "Crítico";
        } else if (m.rssi < -67) {
            estado = "Regular";
        }

        tabla.innerHTML += `
            <tr>
                <td>${m.punto}</td>
                <td>${m.fecha}</td>
                <td>${m.zona}</td>
                <td>${m.responsable}</td>
                <td>${m.rssi}</td>
                <td>${m.observaciones}</td>
                <td>${estado}</td>
                <td>
    <button onclick="eliminarMedicion(${index})">
        🗑
    </button>
</td>

            </tr>
        `;
    });
}

// DASHBOARD
function actualizarDashboard() {

    totalMediciones.textContent = mediciones.length;

    const sumaRSSI = mediciones.reduce(
        (total, item) => total + item.rssi,
        0
    );

    const promedio = Math.round(
        sumaRSSI / mediciones.length
    );

    promedioRssi.textContent = promedio;

    const criticos = mediciones.filter(
        m => m.rssi < -80
    ).length;

    puntosCriticos.textContent = criticos;

    if (promedio >= -67) {
        estadoGeneral.textContent = "Excelente";
    } else if (promedio >= -80) {
        estadoGeneral.textContent = "Regular";
    } else {
        estadoGeneral.textContent = "Crítico";
    }

    diagnostico.textContent =
        `Se han registrado ${mediciones.length} mediciones. RSSI promedio: ${promedio} dBm.`;
}

// GRAFICO
function actualizarGrafico() {

    grafico.data.labels = mediciones.map(
        m => m.punto
    );

    grafico.data.datasets[0].data = mediciones.map(
        m => m.rssi
    );

    grafico.update();
}
actualizarTabla();
actualizarDashboard();
actualizarGrafico();

function eliminarMedicion(index) {

    if (!confirm("¿Eliminar esta medición?")) {
        return;
    }

    mediciones.splice(index, 1);

    localStorage.setItem(
        "mediciones",
        JSON.stringify(mediciones)
    );

    actualizarTabla();
    actualizarDashboard();
    actualizarGrafico();
}

// =========================================================
// MÓDULO ADICIONAL: MAPA DE CALOR RF (WI-FI + LORAWAN)
// =========================================================
(function iniciarMapaCalorRF() {
    const canvas = document.getElementById("pizarraRfCanvas");
    if (!canvas) return;
    const ctxRf = canvas.getContext("2d");

    // Estado de la pizarra
    let modoActual = "muro"; // "muro" | "equipo"
    let dibujandoMuro = false;
    let inicioMuro = null;
    let muros = [];   // { x1, y1, x2, y2, atenuacion }
    let equipos = []; // { nombre, tipo, freqMhz, tx, gain, sf, x, y }

    // Referencias DOM
    const btnMuro = document.getElementById("btnModoMuro");
    const btnEquipo = document.getElementById("btnModoEquipo");
    const btnLimpiar = document.getElementById("btnLimpiarPizarra");
    const materialMuro = document.getElementById("materialMuro");

    const eqNombre = document.getElementById("eqNombre");
    const eqTipo = document.getElementById("eqTipo");
    const eqTxRange = document.getElementById("eqTxRange");
    const eqTxNum = document.getElementById("eqTxNum");
    const eqGainRange = document.getElementById("eqGainRange");
    const eqGainNum = document.getElementById("eqGainNum");
    const eqSfRange = document.getElementById("eqSfRange");
    const eqSfNum = document.getElementById("eqSfNum");
    const escalaRange = document.getElementById("escalaRange");
    const escalaNum = document.getElementById("escalaNum");
    const resumenEquipo = document.getElementById("resumenEquipo");
    const listaEquiposPlano = document.getElementById("listaEquiposPlano");

    // Sincronización estricta de sliders y cajas numéricas con límites
    function vincularControl(rangeEl, numEl, min, max) {
        rangeEl.addEventListener("input", () => {
            numEl.value = rangeEl.value;
            actualizarResumenYRender();
        });
        numEl.addEventListener("input", () => {
            let val = parseFloat(numEl.value);
            if (isNaN(val)) return;
            if (val < min) val = min;
            if (val > max) val = max;
            numEl.value = val;
            rangeEl.value = val;
            actualizarResumenYRender();
        });
    }

    vincularControl(eqTxRange, eqTxNum, 0, 30);
    vincularControl(eqGainRange, eqGainNum, 0, 15);
    vincularControl(eqSfRange, eqSfNum, 7, 12);
    vincularControl(escalaRange, escalaNum, 20, 500);

    eqTipo.addEventListener("change", actualizarResumenYRender);

    function obtenerConfigActual() {
        const tipo = eqTipo.value;
        const tx = parseFloat(eqTxNum.value) || 0;
        const gain = parseFloat(eqGainNum.value) || 0;
        const sf = parseInt(eqSfNum.value) || 10;

        let freqMhz = 915;
        let etiqueta = "LoRaWAN 915 MHz";
        // Sensibilidad base según tecnología y SF
        let sensibilidad = -120 - (sf - 7) * 2.5;

        if (tipo === "wifi24") {
            freqMhz = 2437;
            etiqueta = "Wi-Fi 2.4 GHz";
            sensibilidad = -85;
        } else if (tipo === "wifi5") {
            freqMhz = 5180;
            etiqueta = "Wi-Fi 5 GHz";
            sensibilidad = -82;
        } else if (tipo === "loranode") {
            freqMhz = 915;
            etiqueta = "Nodo LoRa 915 MHz";
        }

        return {
            nombre: eqNombre.value.trim() || "Equipo-RF",
            tipo,
            etiqueta,
            freqMhz,
            tx,
            gain,
            sf,
            eirp: tx + gain,
            sensibilidad
        };
    }

    function actualizarResumenYRender() {
        const cfg = obtenerConfigActual();
        resumenEquipo.innerHTML = `EIRP Calculado: <strong>${cfg.eirp.toFixed(1)} dBm</strong> | Sensibilidad Umbral: <strong>${cfg.sensibilidad.toFixed(1)} dBm</strong>`;
        renderizarTodo();
    }

    // Cambio de modo en la pizarra
    btnMuro.addEventListener("click", () => {
        modoActual = "muro";
        btnMuro.classList.add("activo");
        btnEquipo.classList.remove("activo");
    });

    btnEquipo.addEventListener("click", () => {
        modoActual = "equipo";
        btnEquipo.classList.add("activo");
        btnMuro.classList.remove("activo");
    });

    btnLimpiar.addEventListener("click", () => {
        muros = [];
        equipos = [];
        actualizarListaEquipos();
        renderizarTodo();
    });

    // Intersección de segmentos (para detectar muros atravesados por la señal)
    function seIntersectan(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false;
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    // Cálculo de RSSI en un punto (px, py)
    function calcularRssiEnPunto(px, py) {
        if (equipos.length === 0) return -150;
        const metrosAlto = parseFloat(escalaNum.value) || 100;
        const metrosPorPixel = metrosAlto / canvas.height;
        let mejorRssi = -150;

        for (const eq of equipos) {
            const dx = (px - eq.x) * metrosPorPixel;
            const dy = (py - eq.y) * metrosPorPixel;
            const distMetros = Math.max(1, Math.sqrt(dx * dx + dy * dy));

            // Pérdida en espacio libre (FSPL en dB)
            const fspl = 20 * Math.log10(distMetros) + 20 * Math.log10(eq.freqMhz) - 27.55;

            // Atenuación acumulada por muros interiores (sticks)
            let perdidaMuros = 0;
            for (const m of muros) {
                if (seIntersectan(eq.x, eq.y, px, py, m.x1, m.y1, m.x2, m.y2)) {
                    perdidaMuros += m.atenuacion;
                }
            }

            const rssi = eq.eirp - fspl - perdidaMuros;
            if (rssi > mejorRssi && rssi >= eq.sensibilidad) {
                mejorRssi = rssi;
            }
        }
        return mejorRssi;
    }

    function colorParaRssi(rssi) {
        if (rssi <= -135) return [255, 255, 255, 0];
        if (rssi >= -45) return [239, 68, 68, 175];   // Rojo intenso (muy cerca)
        if (rssi >= -67) return [245, 158, 11, 160];  // Naranja/Amarillo (Wi-Fi óptimo)
        if (rssi >= -85) return [34, 197, 94, 145];   // Verde (Wi-Fi aceptable / LoRa fuerte)
        if (rssi >= -108) return [6, 182, 212, 130];  // Cian (Cobertura LoRa media)
        return [59, 130, 246, 115];                   // Azul (Alcance extendido LoRaWAN)
    }

    function renderizarTodo(muroTemporal = null) {
        ctxRf.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Grilla suave de pizarra vertical
        ctxRf.strokeStyle = "#f1f5f9";
        ctxRf.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += 40) {
            ctxRf.beginPath();
            ctxRf.moveTo(x, 0);
            ctxRf.lineTo(x, canvas.height);
            ctxRf.stroke();
        }
        for (let y = 0; y <= canvas.height; y += 40) {
            ctxRf.beginPath();
            ctxRf.moveTo(0, y);
            ctxRf.lineTo(canvas.width, y);
            ctxRf.stroke();
        }

        // 2. Renderizar Mapa de Calor por celdas de 6x6 px para fluidez en tiempo real
        if (equipos.length > 0) {
            const paso = 6;
            for (let y = 0; y < canvas.height; y += paso) {
                for (let x = 0; x < canvas.width; x += paso) {
                    const rssi = calcularRssiEnPunto(x + paso / 2, y + paso / 2);
                    const [r, g, b, a] = colorParaRssi(rssi);
                    if (a > 0) {
                        ctxRf.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                        ctxRf.fillRect(x, y, paso, paso);
                    }
                }
            }
        }

        // 3. Dibujar muros (sticks interiores)
        ctxRf.lineCap = "round";
        for (const m of muros) {
            ctxRf.strokeStyle = "#0f172a";
            ctxRf.lineWidth = m.atenuacion >= 12 ? 6 : 4;
            ctxRf.beginPath();
            ctxRf.moveTo(m.x1, m.y1);
            ctxRf.lineTo(m.x2, m.y2);
            ctxRf.stroke();
        }

        if (muroTemporal) {
            ctxRf.strokeStyle = "#2563eb";
            ctxRf.lineWidth = 4;
            ctxRf.setLineDash([6, 4]);
            ctxRf.beginPath();
            ctxRf.moveTo(muroTemporal.x1, muroTemporal.y1);
            ctxRf.lineTo(muroTemporal.x2, muroTemporal.y2);
            ctxRf.stroke();
            ctxRf.setLineDash([]);
        }

        // 4. Dibujar íconos de equipos asignados
        for (const eq of equipos) {
            ctxRf.fillStyle = "#0f172a";
            ctxRf.beginPath();
            ctxRf.arc(eq.x, eq.y, 9, 0, Math.PI * 2);
            ctxRf.fill();

            ctxRf.fillStyle = "#38bdf8";
            ctxRf.beginPath();
            ctxRf.arc(eq.x, eq.y, 4, 0, Math.PI * 2);
            ctxRf.fill();

            ctxRf.fillStyle = "#0f172a";
            ctxRf.font = "bold 11px Inter, sans-serif";
            ctxRf.fillText(`${eq.nombre} (${eq.eirp}dBm)`, eq.x + 12, eq.y + 4);
        }
    }

    function actualizarListaEquipos() {
        listaEquiposPlano.innerHTML = "";
        equipos.forEach((eq, idx) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span><strong>${eq.nombre}</strong> · ${eq.etiqueta} (EIRP: ${eq.eirp} dBm)</span>
                <button type="button" data-idx="${idx}">Quitar</button>
            `;
            li.querySelector("button").addEventListener("click", () => {
                equipos.splice(idx, 1);
                actualizarListaEquipos();
                renderizarTodo();
            });
            listaEquiposPlano.appendChild(li);
        });
    }

    // Eventos del mouse en la pizarra
    function obtenerCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    canvas.addEventListener("mousedown", (e) => {
        const pos = obtenerCoords(e);
        if (modoActual === "muro") {
            dibujandoMuro = true;
            inicioMuro = pos;
        } else if (modoActual === "equipo") {
            const cfg = obtenerConfigActual();
            equipos.push({
                ...cfg,
                x: pos.x,
                y: pos.y
            });
            actualizarListaEquipos();
            renderizarTodo();
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!dibujandoMuro || !inicioMuro) return;
        const pos = obtenerCoords(e);
        renderizarTodo({
            x1: inicioMuro.x,
            y1: inicioMuro.y,
            x2: pos.x,
            y2: pos.y
        });
    });

    canvas.addEventListener("mouseup", (e) => {
        if (!dibujandoMuro || !inicioMuro) return;
        const pos = obtenerCoords(e);
        const dist = Math.hypot(pos.x - inicioMuro.x, pos.y - inicioMuro.y);
        if (dist > 8) {
            muros.push({
                x1: inicioMuro.x,
                y1: inicioMuro.y,
                x2: pos.x,
                y2: pos.y,
                atenuacion: parseFloat(materialMuro.value) || 12
            });
        }
        dibujandoMuro = false;
        inicioMuro = null;
        renderizarTodo();
    });

    actualizarResumenYRender();
})();

