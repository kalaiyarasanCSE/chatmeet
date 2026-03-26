const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// rooms[roomCode] = { host: socketId, users: [{ id, name, muted }] }
let rooms = {};

function broadcastUsers(room) {
    if (!rooms[room]) return;
    io.to(room).emit("roomUsers", {
        users: rooms[room].users,
        host: rooms[room].host
    });
}

function systemMsg(room, text) {
    io.to(room).emit("message", { name: "System", text, time: Date.now() });
}

io.on("connection", (socket) => {

    // JOIN ROOM
    socket.on("joinRoom", ({ name, room, isHost }) => {
        socket.join(room);

        if (!rooms[room]) {
            rooms[room] = { host: socket.id, users: [] };
        }

        if (!rooms[room].users.find(u => u.id === socket.id)) {
            rooms[room].users.push({ id: socket.id, name, muted: false });
        }

        if (isHost) rooms[room].host = socket.id;

        broadcastUsers(room);
        socket.to(room).emit("message", { name: "System", text: `${name} joined the chat`, time: Date.now() });
    });

    // SEND MESSAGE
    socket.on("sendMessage", (data) => {
        const { room } = data;
        const roomData = rooms[room];
        if (!roomData) return;

        const user = roomData.users.find(u => u.id === socket.id);
        if (user && user.muted) {
            socket.emit("blocked", "You are muted and cannot send messages.");
            return;
        }

        io.to(room).emit("message", { ...data, time: Date.now() });
    });

    // TYPING
    socket.on("typing", ({ room, name }) => {
        socket.to(room).emit("typing", { name });
    });

    // MUTE / UNMUTE TOGGLE
    socket.on("muteUser", ({ room, userId }) => {
        const roomData = rooms[room];
        if (!roomData || roomData.host !== socket.id) return;

        const user = roomData.users.find(u => u.id === userId);
        if (user) {
            user.muted = !user.muted;
            broadcastUsers(room);
            const status = user.muted ? "muted" : "unmuted";
            systemMsg(room, `${user.name} has been ${status} by the host.`);
        }
    });

    // KICK USER
    socket.on("kickUser", ({ room, userId }) => {
        const roomData = rooms[room];
        if (!roomData || roomData.host !== socket.id) return;

        const kicked = roomData.users.find(u => u.id === userId);
        io.to(userId).emit("kicked", "You have been kicked from the room.");

        const kickedSocket = io.sockets.sockets.get(userId);
        if (kickedSocket) kickedSocket.leave(room);

        roomData.users = roomData.users.filter(u => u.id !== userId);
        broadcastUsers(room);
        if (kicked) systemMsg(room, `${kicked.name} was kicked by the host.`);
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        for (let room in rooms) {
            const user = rooms[room].users.find(u => u.id === socket.id);
            const wasHost = rooms[room].host === socket.id;

            rooms[room].users = rooms[room].users.filter(u => u.id !== socket.id);

            if (rooms[room].users.length === 0) {
                delete rooms[room];
            } else {
                if (wasHost) {
                    rooms[room].host = rooms[room].users[0].id;
                    systemMsg(room, `${rooms[room].users[0].name} is now the host.`);
                }
                if (user) systemMsg(room, `${user.name} left the chat.`);
                broadcastUsers(room);
            }
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
