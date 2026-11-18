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