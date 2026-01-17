const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- QUIZ DATA ---
const QUESTIONS = [
    { id: 1, text: "In Cyberpunk 2077, what is the name of the city?", options: ["Neo Tokyo", "Night City", "Los Santos", "Mega City One"], correct: 1 },
    { id: 2, text: "Which language runs in the browser?", options: ["Java", "Python", "JavaScript", "C#"], correct: 2 },
    { id: 3, text: "What does HTML stand for?", options: ["High Text Make Language", "Hyper Text Markup Language", "Hyper Tool Multi Level", "Home Tool Markup Language"], correct: 1 }
];

const rooms = {};

io.on('connection', (socket) => {
    
    // 1. HOST: Create Game (Fixed Code: 122333)
    socket.on('create_room', () => {
        const roomCode = "122333"; 
        
        rooms[roomCode] = {
            host: socket.id,
            players: [],
            currentQuestion: 0,
            answers: {}, 
            gameState: 'LOBBY'
        };
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
    });

    // 2. PLAYER: Join Game
    socket.on('join_room', ({ code, name }) => {
        const room = rooms[code];
        if (room) {
            socket.join(code);
            // Reconnect logic: Update socket ID if name matches, else add new
            const existingPlayer = room.players.find(p => p.name === name);
            if(existingPlayer) {
                existingPlayer.id = socket.id;
            } else {
                room.players.push({ id: socket.id, name, score: 0 });
            }
            
            io.to(code).emit('player_update', room.players);
            socket.emit('join_success', room.gameState);
        } else {
            socket.emit('error', 'Invalid Room Code');
        }
    });

    // 3. HOST: Start Game
    socket.on('start_game', (code) => {
        const room = rooms[code];
        if (room && socket.id === room.host) {
            sendQuestion(code);
        }
    });

    // 4. HOST: Next Question
    socket.on('next_question', (code) => {
        const room = rooms[code];
        if (room && socket.id === room.host) {
            room.currentQuestion++;
            
            if (room.currentQuestion < QUESTIONS.length) {
                sendQuestion(code);
            } else {
                // Game Over - Send Leaderboard
                const leaderboard = room.players.sort((a,b) => b.score - a.score);
                io.to(code).emit('game_over', leaderboard);
            }
        }
    });

    // 5. HOST: Stop Session
    socket.on('stop_game', (code) => {
        io.to(code).emit('session_ended');
        delete rooms[code];
    });

    // 6. PLAYER: Submit Answer
    socket.on('submit_answer', ({ code, answerIdx, timeLeft }) => {
        const room = rooms[code];
        if (!room || room.gameState !== 'PLAYING') return;

        room.answers[socket.id] = answerIdx;
        io.to(room.host).emit('live_answer_update', { playerId: socket.id });

        const question = QUESTIONS[room.currentQuestion];
        if (question.correct === answerIdx) {
            const points = 50 + (timeLeft * 2); 
            const player = room.players.find(p => p.id === socket.id);
            if (player) player.score += points;
        }
    });

    // --- HELPERS ---
    function sendQuestion(code) {
        const room = rooms[code];
        room.gameState = 'PLAYING';
        room.answers = {}; 
        
        const qData = QUESTIONS[room.currentQuestion];
        io.to(code).emit('new_question', {
            text: qData.text,
            options: qData.options,
            current: room.currentQuestion + 1,
            total: QUESTIONS.length
        });

        // Server Timer (30s)
        let timeLeft = 30;
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timer);
                revealAnswers(code);
            }
        }, 1000);
    }

    function revealAnswers(code) {
        const room = rooms[code];
        room.gameState = 'REVEAL';
        const correctIdx = QUESTIONS[room.currentQuestion].correct;
        const leaderboard = room.players.sort((a, b) => b.score - a.score);
        io.to(code).emit('round_ended', { leaderboard, correctIdx });
    }
});

server.listen(3001, () => console.log('SERVER RUNNING ON PORT 3001'));