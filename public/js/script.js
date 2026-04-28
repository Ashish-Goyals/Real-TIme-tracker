const socket = io();

const status = document.createElement("div");
status.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:20px;z-index:9999;font-size:14px;";
status.innerText = "Requesting location...";
document.body.appendChild(status);

const userCount = document.createElement("div");
userCount.style.cssText = "position:fixed;top:50px;left:50%;transform:translateX(-50%);background:rgba(0,100,0,0.8);color:white;padding:6px 14px;border-radius:20px;z-index:9999;font-size:13px;";
userCount.innerText = "Users: 0";
document.body.appendChild(userCount);

const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
}).addTo(map);

const markers = {};
let myId = null;
let mapInitialized = false;

// get own socket id on connect
socket.on("connect", () => {
    myId = socket.id;
});

if (navigator.geolocation) {
    setInterval(() => {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            socket.emit("send-location", { latitude, longitude });
            status.innerText = `📍 Sharing: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        },
        (error) => {
            status.style.background = "rgba(200,0,0,0.8)";
            status.innerText = `❌ Location error: ${error.message}`;
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    }, 2000);
} else {
    status.style.background = "rgba(200,0,0,0.8)";
    status.innerText = "❌ Geolocation not supported";
}

socket.on("receive-location", (data) => {
    const { id, latitude, longitude } = data;

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude]).addTo(map);
    }

    // center map on YOUR own location first time only
    if (id === myId && !mapInitialized) {
        map.setView([latitude, longitude], 18);
        mapInitialized = true;
    }

    // once map is initialized, fit all markers
    if (mapInitialized) {
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
