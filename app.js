const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// View engine
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Socket connection
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("send-location", (data) => {
        // Broadcast to all clients
        io.emit("receive-location", {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        io.emit("user-disconnected", socket.id);
    });
});

// Route
app.get("/", (req, res) => {
    res.render("index");
});

// Start server
server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});