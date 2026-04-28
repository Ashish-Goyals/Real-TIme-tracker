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

const userLocations = {};

// Socket connection
io.on("connection", (socket) => {
    // Send existing users' locations to newly connected user
    Object.keys(userLocations).forEach(id => {
        socket.emit("receive-location", { id, ...userLocations[id] });
    });

    socket.on("send-location", (data) => {
        userLocations[socket.id] = data;
        io.emit("receive-location", { id: socket.id, ...data });
    });

    socket.on("disconnect", () => {
        delete userLocations[socket.id];
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