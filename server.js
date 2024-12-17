const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (like index.html)
app.use(express.static(__dirname));

// Store active sessions
const sessions = {};

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Create a session
    socket.on("createSession", ({ playerName, playerCount }) => {
        const sessionId = Math.random().toString(36).substring(2, 7);
        sessions[sessionId] = { players: [], playerCount };
        sessions[sessionId].players.push({ id: socket.id, name: playerName, symbol: "X" });

        socket.join(sessionId);
        socket.emit("sessionCreated", { sessionId, players: sessions[sessionId].players });
        io.emit("updateSessions", sessions);
        console.log(`Session ${sessionId} created for ${playerCount} players.`);
    });

    // Join a session
    socket.on("joinSession", ({ sessionId, playerName }) => {
        const session = sessions[sessionId];
        if (session) {
            if (session.players.length < session.playerCount) {
                const symbols = ["X", "O", "#", "@"];
                const playerSymbol = symbols[session.players.length];
                session.players.push({ id: socket.id, name: playerName, symbol: playerSymbol });

                socket.join(sessionId);
                io.to(sessionId).emit("playerJoined", { players: session.players });
            } else {
                socket.emit("sessionFull", { message: "This session is full." });
            }
        } else {
            socket.emit("error", { message: "Session not found." });
        }
    });

    // Handle moves
    socket.on("makeMove", ({ sessionId, row, col }) => {
        if (sessions[sessionId]) {
            sessions[sessionId].moves.push({ row, col, playerId: socket.id });
            io.to(sessionId).emit("moveMade", { row, col, playerId: socket.id });
        }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);
        for (const sessionId in sessions) {
            sessions[sessionId].players = sessions[sessionId].players.filter(player => player.id !== socket.id);
            io.to(sessionId).emit("playerLeft", { players: sessions[sessionId].players });
        }
    });

    socket.on("leaveSession", () => {
        for (const sessionId in sessions) {
            sessions[sessionId].players = sessions[sessionId].players.filter(p => p.id !== socket.id);
            io.to(sessionId).emit("playerJoined", { players: sessions[sessionId].players });
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
