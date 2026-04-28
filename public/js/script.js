const socket = io();

// service worker
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").then(async (reg) => {
        navigator.serviceWorker.addEventListener("message", (e) => {
            if (e.data.type === "request-location") getLocation();
        });
        if ("periodicSync" in reg) {
            try { await reg.periodicSync.register("location-sync", { minInterval: 7000 }); } catch (e) {}
        }
    });
}

// wake lock
async function requestWakeLock() {
    try { await navigator.wakeLock.request("screen"); } catch (e) {}
}
requestWakeLock();
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        requestWakeLock();
        getLocation();
    }
});

// ui elements
const statusDot  = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const myCoords   = document.getElementById("my-coords");
const otherCoords= document.getElementById("other-coords");
const distanceBar= document.getElementById("distance-bar");
const distanceText=document.getElementById("distance-text");
const btnMe      = document.getElementById("btn-me");
const btnBoth    = document.getElementById("btn-both");
const btnOther   = document.getElementById("btn-other");

// map
const map = L.map("map", { zoomControl: false }).setView([0, 0], 2);
L.control.zoom({ position: "topright" }).addTo(map);

const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" });
const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri" });
const streetDetail = L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap France" });
streets.addTo(map);
L.control.layers({ "🗺️ Street": streets, "🛰️ Satellite": satellite, "🏙️ Detail": streetDetail }).addTo(map);

// custom icons
const myIcon = L.divIcon({ className: "my-marker-icon",    iconSize: [32, 32], iconAnchor: [16, 32] });
const otherIcon = L.divIcon({ className: "other-marker-icon", iconSize: [32, 32], iconAnchor: [16, 32] });

let myId       = null;
let myMarker   = null;
let otherMarker= null;
let myLatLng   = null;
let otherLatLng= null;
let mapCentered= false;
let userInteracted = false;

map.on("dragstart zoomstart", () => { userInteracted = true; });

socket.on("connect", () => { myId = socket.id; });

// distance calculation (haversine)
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return d < 1000 ? `${Math.round(d)} m` : `${(d/1000).toFixed(2)} km`;
}

function updateDistance() {
    if (myLatLng && otherLatLng) {
        distanceBar.style.display = "block";
        distanceText.innerText = calcDistance(myLatLng.lat, myLatLng.lng, otherLatLng.lat, otherLatLng.lng);
    }
}

function getLocation() {
    if (!navigator.geolocation) {
        statusDot.className = "error";
        statusText.innerText = "Geolocation not supported";
        return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        socket.emit("send-location", { latitude, longitude });
        myLatLng = { lat: latitude, lng: longitude };
        myCoords.innerText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        statusDot.className = "active";
        statusText.innerText = "Sharing location";
        updateDistance();
    }, (err) => {
        statusDot.className = "error";
        statusText.innerText = err.message;
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

// instant low-accuracy fix first
getLocation();

// high accuracy watch for real-time updates
navigator.geolocation && navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    socket.emit("send-location", { latitude, longitude });
    myLatLng = { lat: latitude, lng: longitude };
    myCoords.innerText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    statusDot.className = "active";
    statusText.innerText = "Sharing location";
    updateDistance();
}, (err) => {
    statusDot.className = "error";
    statusText.innerText = err.message;
}, { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });

socket.on("receive-location", ({ id, latitude, longitude }) => {
    if (id === myId) {
        // update own marker
        if (!myMarker) {
            myMarker = L.marker([latitude, longitude], { icon: myIcon }).addTo(map).bindPopup("You");
        } else {
            myMarker.setLatLng([latitude, longitude]);
        }
        if (!mapCentered) {
            map.setView([latitude, longitude], 17);
            mapCentered = true;
        }
    } else {
        // update other user's marker
        otherLatLng = { lat: latitude, lng: longitude };
        otherCoords.innerText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        btnOther.disabled = false;
        if (!otherMarker) {
            otherMarker = L.marker([latitude, longitude], { icon: otherIcon }).addTo(map).bindPopup("Other");
        } else {
            otherMarker.setLatLng([latitude, longitude]);
        }
        updateDistance();
        // auto fit both if user hasn't interacted
        if (!userInteracted && myMarker) {
            map.fitBounds(L.latLngBounds([myMarker.getLatLng(), otherMarker.getLatLng()]), { padding: [80, 80], maxZoom: 18 });
        }
    }
});

socket.on("user-disconnected", () => {
    if (otherMarker) { map.removeLayer(otherMarker); otherMarker = null; }
    otherLatLng = null;
    otherCoords.innerText = "Disconnected";
    btnOther.disabled = true;
    distanceBar.style.display = "none";
});

socket.on("room-full", () => {
    statusDot.className = "error";
    statusText.innerText = "Session full. Max 2 users allowed.";
});

// buttons
btnMe.addEventListener("click", () => {
    if (myMarker) { map.setView(myMarker.getLatLng(), 17); userInteracted = false; }
});

btnBoth.addEventListener("click", () => {
    if (myMarker && otherMarker) {
        map.fitBounds(L.latLngBounds([myMarker.getLatLng(), otherMarker.getLatLng()]), { padding: [80, 80], maxZoom: 18 });
        userInteracted = false;
    } else if (myMarker) {
        map.setView(myMarker.getLatLng(), 17);
    }
});

btnOther.addEventListener("click", () => {
    if (otherMarker) { map.setView(otherMarker.getLatLng(), 17); }
});
