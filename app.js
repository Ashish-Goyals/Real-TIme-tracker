const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const userLocations = {};

io.on("connection", (socket) => {
    // send only currently connected users' locations
    Object.entries(userLocations).forEach(([id, data]) => {
        if (io.sockets.sockets.get(id)) {
            socket.emit("receive-location", { id, ...data });
        } else {
            delete userLocations[id];
        }
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

app.get("/", (req, res) => res.render("index"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
