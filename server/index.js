const cors = require("cors");
const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");

const server = http.createServer(app);
app.use(cors({
    origin: true
}));
const io = new Server(server);

// app.use(express.static("build"));
// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, "build", "index.html"));
// });

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
};

io.on("connection", (socket) => {
    console.log(`Socket connected with id: ${socket.id}`);
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        // notify that new user join
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    // sync the code
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });
    socket.on(ACTIONS.SEND_MESSAGE, ({ roomId, message }) => {
        socket.in(roomId).emit(ACTIONS.SEND_MESSAGE, { message });
    });
    // when new user join the room all the code which are there are also shows on that persons editor
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });
    // leave room
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        // leave all the room
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is runnint on port ${PORT}`));