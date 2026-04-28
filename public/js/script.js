const socket = io();

const status = document.createElement("div");
status.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:20px;z-index:9999;font-size:14px;";
status.innerText = "Requesting location...";
document.body.appendChild(status);

const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
}).addTo(map);

const markers = {};
let myId = null;

socket.on("connect", () => {
    myId = socket.id;
});

if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
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
        timeout: 10000,
        maximumAge: 0
    });
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

    // only center map on your own marker
    if (id === myId) {
        map.setView([latitude, longitude], 16);
    }
});

socket.on("user-disconnected", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});
