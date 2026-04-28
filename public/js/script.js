const socket = io();

// service worker registration
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").then(async (reg) => {
        navigator.serviceWorker.addEventListener("message", (e) => {
            if (e.data.type === "request-location") sendLocation();
        });
        if ("periodicSync" in reg) {
            try {
                await reg.periodicSync.register("location-sync", { minInterval: 2000 });
            } catch (e) {}
        }
    });
}

// wake lock - keep screen on
async function requestWakeLock() {
    try { await navigator.wakeLock.request("screen"); } catch (e) {}
}
requestWakeLock();
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestWakeLock();
});

// status bar
const status = document.createElement("div");
status.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:20px;z-index:9999;font-size:14px;";
status.innerText = "Requesting location...";
document.body.appendChild(status);

// user count
const userCount = document.createElement("div");
userCount.style.cssText = "position:fixed;top:50px;left:50%;transform:translateX(-50%);background:rgba(0,100,0,0.8);color:white;padding:6px 14px;border-radius:20px;z-index:9999;font-size:13px;";
userCount.innerText = "Users: 0";
document.body.appendChild(userCount);

// map setup
const map = L.map("map").setView([0, 0], 2);

const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
});

const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "© Esri"
});

const streetDetail = L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap France"
});

streets.addTo(map);

L.control.layers({
    "🗺️ Street": streets,
    "🛰️ Satellite": satellite,
    "🏙️ Street Detail": streetDetail
}).addTo(map);

const markers = {};
let myId = null;
let mapCentered = false;

socket.on("connect", () => { myId = socket.id; });

function sendLocation() {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit("send-location", { latitude, longitude });
        status.innerText = `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }, (error) => {
        status.style.background = "rgba(200,0,0,0.8)";
        status.innerText = `❌ ${error.message}`;
    }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
}

if (navigator.geolocation) {
    setInterval(sendLocation, 2000);
} else {
    status.style.background = "rgba(200,0,0,0.8)";
    status.innerText = "❌ Geolocation not supported";
}

socket.on("receive-location", ({ id, latitude, longitude }) => {
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude]).addTo(map);
    }

    // center on own location first time
    if (id === myId && !mapCentered) {
        map.setView([latitude, longitude], 18);
        mapCentered = true;
    }

    // fit all markers on screen
    if (mapCentered) {
        const allLatLngs = Object.values(markers).map(m => m.getLatLng());
        if (allLatLngs.length > 1) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [80, 80], maxZoom: 18 });
        }
    }

    userCount.innerText = `Users: ${Object.keys(markers).length}`;
});

socket.on("user-disconnected", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    userCount.innerText = `Users: ${Object.keys(markers).length}`;
});
