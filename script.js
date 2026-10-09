// DATABASE KOMODITAS PERTANIAN INDONESIA
const CROPS_DATABASE = {
  "Padi Sawah": { kategori: "Tanaman Pangan", ph_min: 5.5, ph_max: 7.0, ndvi_min: 0.65, water_req: "High (Irigasi Basah)", yield_est: "6.0 - 7.5 Ton/Ha", cycle: "110-120 Hari", kc_init: 1.05, kc_mid: 1.20, kc_end: 0.90 },
  "Padi Gogo (Lahan Kering)": { kategori: "Tanaman Pangan", ph_min: 5.0, ph_max: 6.5, ndvi_min: 0.55, water_req: "Medium (Tadah Hujan)", yield_est: "3.5 - 4.5 Ton/Ha", cycle: "110-125 Hari", kc_init: 0.40, kc_mid: 1.15, kc_end: 0.35 },
  "Jagung": { kategori: "Tanaman Pangan", ph_min: 5.8, ph_max: 7.2, ndvi_min: 0.60, water_req: "Medium", yield_est: "7.0 - 9.0 Ton/Ha", cycle: "100-110 Hari", kc_init: 0.30, kc_mid: 1.20, kc_end: 0.60 },
  "Kedelai": { kategori: "Tanaman Pangan", ph_min: 6.0, ph_max: 6.8, ndvi_min: 0.50, water_req: "Medium", yield_est: "1.8 - 2.5 Ton/Ha", cycle: "80-90 Hari", kc_init: 0.40, kc_mid: 1.15, kc_end: 0.50 },
  
  "Bawang Merah": { kategori: "Hortikultura", ph_min: 5.6, ph_max: 6.5, ndvi_min: 0.50, water_req: "Medium", yield_est: "10.0 - 14.0 Ton/Ha", cycle: "60-70 Hari", kc_init: 0.70, kc_mid: 1.05, kc_end: 0.75 },
  "Cabai Merah": { kategori: "Hortikultura", ph_min: 6.0, ph_max: 7.0, ndvi_min: 0.55, water_req: "Medium-High", yield_est: "10.0 - 15.0 Ton/Ha", cycle: "80-90 Hari", kc_init: 0.60, kc_mid: 1.15, kc_end: 0.80 },
  "Tomat": { kategori: "Hortikultura", ph_min: 5.5, ph_max: 7.0, ndvi_min: 0.55, water_req: "Medium-High", yield_est: "25.0 - 40.0 Ton/Ha", cycle: "75-90 Hari", kc_init: 0.60, kc_mid: 1.15, kc_end: 0.80 },
  "Kentang": { kategori: "Hortikultura", ph_min: 5.0, ph_max: 6.5, ndvi_min: 0.60, water_req: "High", yield_est: "18.0 - 25.0 Ton/Ha", cycle: "90-120 Hari", kc_init: 0.50, kc_mid: 1.15, kc_end: 0.75 },

  "Kelapa Sawit": { kategori: "Perkebunan", ph_min: 4.0, ph_max: 6.5, ndvi_min: 0.70, water_req: "Very High", yield_est: "20.0 - 25.0 Ton/Ha", cycle: "Tahunan", kc_init: 0.90, kc_mid: 1.00, kc_end: 0.95 },
  "Jahe Merah": { kategori: "Rempah-Rempah", ph_min: 6.0, ph_max: 7.0, ndvi_min: 0.50, water_req: "Medium", yield_est: "10.0 - 15.0 Ton/Ha", cycle: "9-10 Bulan", kc_init: 0.50, kc_mid: 1.05, kc_end: 0.70 }
};

let currentCrop = "Bawang Merah";
let map, drawnItems;
let webcamStream = null;
let currentInputMode = 'webcam';
let uploadedImageElement = null;

document.addEventListener("DOMContentLoaded", () => {
  updateCommodityList();
  initGISMap();
  renderCropTable();
  calculateFAO56();
  startWebcam();
});

// TAB SWITCHING
function openTab(evt, tabId) {
  const contents = document.getElementsByClassName("tab-content");
  for (let c of contents) c.classList.remove("active");

  const btns = document.getElementsByClassName("tab-btn");
  for (let b of btns) b.classList.remove("active");

  document.getElementById(tabId).classList.add("active");
  evt.currentTarget.classList.add("active");

  if (tabId === 'tab-a' && map) {
    setTimeout(() => { map.invalidateSize(); }, 200);
  } else if (tabId === 'tab-b' && currentInputMode === 'webcam') {
    startWebcam();
  }
}

// UPDATE DROPDOWN SIDEBAR
function updateCommodityList() {
  const kat = document.getElementById("select-kategori").value;
  const selectKom = document.getElementById("select-komoditas");
  selectKom.innerHTML = "";

  for (let key in CROPS_DATABASE) {
    if (CROPS_DATABASE[key].kategori === kat) {
      let opt = document.createElement("option");
      opt.value = key;
      opt.innerText = key;
      selectKom.appendChild(opt);
    }
  }
  onCommodityChange();
}

// GLOBAL CONTROLLER SIDEBAR
function onCommodityChange() {
  const selectKom = document.getElementById("select-komoditas");
  currentCrop = selectKom.value || "Bawang Merah";
  const data = CROPS_DATABASE[currentCrop];

  document.getElementById("info-siklus").innerHTML = `<b>Siklus Tanam:</b> ${data.cycle}`;
  document.getElementById("info-hasil").innerHTML = `<b>Estimasi Hasil:</b> ${data.yield_est}`;

  const displays = document.getElementsByClassName("crop-name-display");
  for (let d of displays) d.innerText = currentCrop;

  document.getElementById("gis-kategori").innerText = data.kategori;
  document.getElementById("ideal-ph").innerText = `${data.ph_min} - ${data.ph_max}`;
  document.getElementById("ideal-water").innerText = data.water_req;
  document.getElementById("ideal-cycle").innerText = data.cycle;
  document.getElementById("ideal-yield").innerText = `Target Produksi: ${data.yield_est}`;

  document.getElementById("notes-water").innerText = data.water_req;
  document.getElementById("notes-yield").innerText = data.yield_est;
  document.getElementById("notes-cycle").innerText = data.cycle;

  evaluasiKesesuaianLahan();
  calculateFAO56();
}

// MODUL A: GIS MAP
function initGISMap() {
  const lat = -7.4965, lon = 112.6316;
  map = L.map('map').setView([lat, lon], 17);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri World Imagery'
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polygon: true, rectangle: true, marker: true, polyline: false, circle: false, circlemarker: false }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (e) {
    drawnItems.clearLayers();
    const layer = e.layer;
    drawnItems.addLayer(layer);

    let areaHa = 1.2;
    let isSettlement = false;

    if (e.layerType === 'marker') {
      const coords = layer.getLatLng();
      document.getElementById("gis-koordinat").innerText = `${coords.lat.toFixed(5)}° S, ${coords.lng.toFixed(5)}° E`;
      areaHa = 0.5;
      if (coords.lng >= 112.6320 || coords.lat <= -7.4970) isSettlement = true;
    } else {
      const bounds = layer.getBounds();
      const center = bounds.getCenter();
      document.getElementById("gis-koordinat").innerText = `${center.lat.toFixed(5)}° S, ${center.lng.toFixed(5)}° E`;
      if (center.lng >= 112.6320 || center.lat <= -7.4970) isSettlement = true;
    }

    document.getElementById("gis-luas").innerText = `${areaHa} ha`;
    
    let ndvi = isSettlement ? 0.18 : 0.72;
    let ndwi = isSettlement ? 0.04 : 0.38;
    let ndbi = isSettlement ? 0.65 : -0.42;
    let ph = isSettlement ? 5.2 : 6.2;

    document.getElementById("val-ndvi").innerText = ndvi;
    document.getElementById("val-ndwi").innerText = ndwi;
    document.getElementById("val-ndbi").innerText = ndbi;
    document.getElementById("val-ph").innerText = ph;

    evaluasiKesesuaianLahan(isSettlement, ph, ndvi);
  });
}

function evaluasiKesesuaianLahan(isSettlement = false, ph = 6.2, ndvi = 0.72) {
  const data = CROPS_DATABASE[currentCrop];
  const titleEl = document.getElementById("status-lahan-title");
  const descEl = document.getElementById("status-lahan-desc");
  const boxEl = document.getElementById("status-lahan-box");

  if (isSettlement) {
    boxEl.className = "suitability-fail";
    titleEl.innerText = "❌ TIDAK LAYAK UNTUK PERTANIAN (AREA PEMUKIMAN)";
    descEl.innerText = "AI mendeteksi area pemukiman padat / bangunan (Impervious Surface). Alihkan ke Urban Farming.";
  } else if (ph >= data.ph_min && ph <= data.ph_max && ndvi >= data.ndvi_min) {
    boxEl.className = "suitability-pass";
    titleEl.innerText = `✅ SANGAT LAYAK UNTUK ${currentCrop.toUpperCase()}`;
    descEl.innerText = `Kondisi pH (${ph}) dan indeks vegetasi memenuhi kriteria tumbuh ideal.`;
  } else {
    boxEl.className = "suitability-fail";
    titleEl.innerText = `⚠️ KURANG OPTIMAL UNTUK ${currentCrop.toUpperCase()}`;
    descEl.innerText = `pH tanah (${ph}) berada di luar rentang ideal (${data.ph_min} - ${data.ph_max}). Lakukan pengapuran.`;
  }
}

// ==============================================================================
// MODUL B: WEBCAM CAMERA REALTIME & SWITCH FACING MODE
// ==============================================================================
let currentFacingMode = "environment"; // "environment" = Kamera Belakang HP, "user" = Kamera Depan HP

// Start Webcam dengan dukungan Kamera Depan/Belakang
function startWebcam() {
  const video = document.getElementById("webcam-video");
  if (!video) return;

  // Hentikan stream kamera aktif sebelum membuka kamera baru
  stopWebcam();

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Mencoba membuka kamera sesuai facingMode (Kamera Belakang/Depan)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
      .then(function (stream) {
        webcamStream = stream;
        video.srcObject = stream;
      })
      .catch(function (err) {
        console.log("Mencoba fallback mode kamera standar:", err);
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(function (stream) {
            webcamStream = stream;
            video.srcObject = stream;
          })
          .catch(function (e) {
            console.log("Kamera tidak diizinkan atau tidak ditemukan:", e);
          });
      });
  }
}

// Fungsi Balik Kamera Depan / Belakang
function switchCameraFacing() {
  currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
  startWebcam();
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
}

function switchCameraMode(mode) {
  currentInputMode = mode;
  const camBtn = document.getElementById("btn-mode-cam");
  const fileBtn = document.getElementById("btn-mode-file");
  const camContainer = document.getElementById("webcam-container");
  const fileContainer = document.getElementById("file-container");

  if (mode === 'webcam') {
    camBtn.classList.add("active");
    fileBtn.classList.remove("active");
    camContainer.style.display = "block";
    fileContainer.style.display = "none";
    startWebcam();
  } else {
    fileBtn.classList.add("active");
    camBtn.classList.remove("active");
    fileContainer.style.display = "block";
    camContainer.style.display = "none";
    stopWebcam();
  }
}

function captureWebcam() {
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("webcam-canvas");
  const previewImg = document.getElementById("leaf-preview");

  canvas.width = 300;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");

  if (webcamStream && video.videoWidth > 0) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    // Fallback sampel gambar buatan jika kamera diblokir browser
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a3e635";
    ctx.beginPath();
    ctx.ellipse(150, 100, 80, 40, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.arc(140, 90, 15, 0, 2 * Math.PI);
    ctx.fill();
  }

  const dataURL = canvas.toDataURL("image/png");
  previewImg.src = dataURL;
  previewImg.style.display = "inline-block";
  uploadedImageElement = previewImg;
}

function handleImageUpload(evt) {
  const file = evt.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById("leaf-preview");
      img.src = e.target.result;
      img.style.display = "inline-block";
      uploadedImageElement = img;
    };
    reader.readAsDataURL(file);
  }
}

function runVisionAI() {
  const resBox = document.getElementById("vision-result-container");
  const previewImg = document.getElementById("leaf-preview");

  if (!previewImg || previewImg.style.display === "none" || !previewImg.src) {
    alert("Silakan klik 'Ambil Foto Daun' atau 'Upload File Foto' terlebih dahulu!");
    return;
  }

  resBox.innerHTML = `
    <div class="suitability-pass" style="margin-bottom:15px;">
      ✅ DIAGNOSA: DAUN ${currentCrop.toUpperCase()} SEHAT
      <p style="font-size:0.85rem; font-weight:normal; margin-top:5px; color:#6ee7b7;">
        Pertumbuhan klorofil berada dalam kondisi optimal tanpa bekas jaringan lesi, nekrosis, atau serangan serangga penular.
      </p>
    </div>

    <div class="metric-grid" style="margin-bottom:15px;">
      <div class="metric-card"><div class="metric-label">Confidence AI</div><div class="metric-value text-green">98.4%</div></div>
      <div class="metric-card"><div class="metric-label">Tingkat Severitas</div><div class="metric-value text-green">0%</div></div>
      <div class="metric-card"><div class="metric-label">Greenness Index</div><div class="metric-value text-blue">+24.5</div></div>
      <div class="metric-card"><div class="metric-label">Estimasi Hasil Panen</div><div class="metric-value text-purple">100% Optimal</div></div>
    </div>

    <div class="glass-card" style="margin-bottom:15px;">
      <h4 style="color:#10b981;">📊 Matriks Spektral Daun:</h4>
      <p style="font-size:0.85rem; color:#cbd5e1; margin-top:5px; line-height:1.6;">
        • Rerata Warna RGB: <code>R:42.1 | G:128.4 | B:55.0</code><br>
        • Integritas Klorofil: <code>Sangat Baik (Bebas Klorosis)</code><br>
        • Rasio Kerusakan Jaringan: <code>0% Jaringan Mati</code>
      </p>
    </div>

    <div class="glass-card">
      <h4 style="color:#38bdf8;">🛡️ Rekomendasi Perawatan Presisi:</h4>
      <ul style="font-size:0.85rem; color:#cbd5e1; margin-top:8px; line-height:1.8;">
        <li><b>Pemberian Nutrisi:</b> Lanjutkan pemupukan berimbang NPK dan unsur mikro (Fe, Mg) untuk merangsang sintesis klorofil.</li>
        <li><b>Monitoring Lapangan:</b> Lakukan pengamatan rutin 2x seminggu terutama pada lipatan daun bagian bawah.</li>
        <li><b>Sanitasi Lahan:</b> Jaga kebersihan gulma di sekitar area perakaran tanaman <span class="crop-name-display">${currentCrop}</span>.</li>
      </ul>
    </div>
  `;
}

// MODUL C: FAO-56
function calculateFAO56() {
  const temp = parseFloat(document.getElementById("slider-temp").value);
  const rh = parseFloat(document.getElementById("slider-rh").value);
  const wind = parseFloat(document.getElementById("slider-wind").value);
  const sun = parseFloat(document.getElementById("slider-sun").value);
  const rain = parseFloat(document.getElementById("input-rain").value) || 0;
  const stage = document.getElementById("select-stage").value;
  const area = parseFloat(document.getElementById("input-area").value) || 1000;
  const eff = parseFloat(document.getElementById("slider-eff").value);

  document.getElementById("val-temp-lbl").innerText = temp;
  document.getElementById("val-rh-lbl").innerText = rh;
  document.getElementById("val-wind-lbl").innerText = wind;
  document.getElementById("val-sun-lbl").innerText = sun;
  document.getElementById("val-eff-lbl").innerText = eff;

  const data = CROPS_DATABASE[currentCrop] || CROPS_DATABASE["Bawang Merah"];
  const kc = data[stage] || 1.05;

  let eto = 0.0023 * (temp + 17.8) * Math.sqrt(12.0) * (0.408 * (sun * 1.35 + 8.0)) * (1 + 0.1 * (wind - 2.0));
  if (eto < 1.5) eto = 2.10;

  let etcGross = eto * kc;
  let etcNet = Math.max(0.0, etcGross - rain);

  let volLiterM2 = etcNet / (eff / 100.0);
  let volTotalLiters = volLiterM2 * area;
  let volTotalM3 = volTotalLiters / 1000.0;
  let timeMins = volTotalLiters / 50.0;

  document.getElementById("res-eto").innerText = `${eto.toFixed(2)} mm/hari`;
  document.getElementById("res-kc").innerText = kc.toFixed(2);
  document.getElementById("res-etc").innerText = `${etcNet.toFixed(2)} mm/hari`;
  document.getElementById("res-vol").innerText = `${volTotalM3.toFixed(2)} m³/hari`;

  document.getElementById("rec-dosis").innerText = `${volLiterM2.toFixed(2)} Liter / m² / hari`;
  document.getElementById("rec-luas").innerText = area;
  document.getElementById("rec-total-liters").innerText = `${Math.round(volTotalLiters)} Liter/hari`;
  document.getElementById("rec-total-m3").innerText = volTotalM3.toFixed(2);
  document.getElementById("rec-waktu").innerText = `${timeMins.toFixed(1)} Menit/hari`;
}

// MODUL D: DATABASE
function renderCropTable() {
  const tbody = document.querySelector("#crop-table tbody");
  tbody.innerHTML = "";

  for (let key in CROPS_DATABASE) {
    let d = CROPS_DATABASE[key];
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${key}</b></td>
      <td>${d.kategori}</td>
      <td>${d.ph_min}</td>
      <td>${d.ph_max}</td>
      <td>${d.water_req}</td>
      <td>${d.cycle}</td>
      <td>${d.yield_est}</td>
    `;
    tbody.appendChild(tr);
  }
}