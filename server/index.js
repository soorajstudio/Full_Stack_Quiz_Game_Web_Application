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
    // --- General Knowledge ---
    {
        id: 1,
        text: "Which organization manages global domain names and IP addresses?",
        options: ["W3C", "ICANN", "IEEE", "ISO"],
        correct: 1 // B
    },
    {
        id: 2,
        text: "Which factor MOST affects website loading speed?",
        options: ["Font color", "Image size", "Text alignment", "HTML comments"],
        correct: 1 // B
    },
    {
        id: 3,
        text: "Code: <img src='photo.jpg' alt='My Image'>. If the image fails to load, what is shown?",
        options: ["Nothing", "photo.jpg", "My Image", "Error"],
        correct: 2 // C
    },
    {
        id: 4,
        text: "What does a domain name represent on the internet?",
        options: ["A programming instruction", "A file location", "A human-readable address", "A browser extension"],
        correct: 2 // C
    },
    {
        id: 5,
        text: "What is the role of a search engine?",
        options: ["To design websites", "To host web servers", "To locate information", "To protect websites"],
        correct: 2 // C
    },
    {
        id: 6,
        text: "Anu's site looks good on a laptop but breaks on a phone. What concept fixes this?",
        options: ["Static design", "Responsive design", "Server optimization", "Data encryption"],
        correct: 1 // B
    },
    {
        id: 7,
        text: "Which part of a website remains the same even if design changes?",
        options: ["CSS", "HTML content", "Colors", "Fonts"],
        correct: 1 // B
    },

    // --- CS ---
    {
        id: 8,
        text: "Code: <style>p{color:red;}</style> <div><p>A</p><span>B</span></div>. Which text appears red?",
        options: ["A only", "B only", "A and B", "None"],
        correct: 0 // A
    },
    {
        id: 9,
        text: "Output of: <h1>Hello</h1><h1>Hello</h1>?",
        options: ["Both on same line", "One hides the other", "Appear on separate lines", "Error"],
        correct: 2 // C
    },
    {
        id: 10,
        text: "What is the default position value in CSS?",
        options: ["absolute", "fixed", "relative", "static"],
        correct: 3 // D
    },
    {
        id: 11,
        text: "A designer saves a project, but it must be run in a browser to work. The website is a:",
        options: ["Process", "Program", "Thread", "Resource"],
        correct: 1 // B
    },
    {
        id: 12,
        text: "Changing design affects all pages automatically. What is the MAIN advantage of CSS?",
        options: ["Faster internet", "Centralized control", "Better storage", "More security"],
        correct: 1 // B
    },
    {
        id: 13,
        text: "What is the main advantage of using external CSS?",
        options: ["Faster typing", "Reuse style across pages", "More HTML tags", "Less browser support"],
        correct: 1 // B
    },

    // --- HTML & CSS ---
    {
        id: 14,
        text: "Which CSS unit is relative to the parent element?",
        options: ["px", "em", "vh", "cm"],
        correct: 1 // B
    },
    {
        id: 15,
        text: "Which HTML element is semantic?",
        options: ["<div>", "<span>", "<section>", "<font>"],
        correct: 2 // C
    },
    {
        id: 16,
        text: "Which CSS selector has the highest priority?",
        options: ["Element selector", "Class selector", "ID selector", "Universal selector"],
        correct: 2 // C
    },
    {
        id: 17,
        text: "What happens with: div { position: absolute; }?",
        options: ["Stays in normal flow", "Removed from flow", "Acts like relative", "Centered"],
        correct: 1 // B
    },
    {
        id: 18,
        text: "Which CSS concept improves readability by adding empty space?",
        options: ["Animation", "Whitespace", "Border", "Overflow"],
        correct: 1 // B
    },
    {
        id: 19,
        text: "A student notices styles overriding others unexpectedly. Which concept explains this?",
        options: ["Compilation", "Specificity", "Encryption", "Rendering"],
        correct: 1 // B
    }
];

const rooms = {};
let isGameActive = false; 

io.on('connection', (socket) => {
    
    // 1. ON CONNECT: Tell new user if game is already running
    socket.emit('game_active', isGameActive);

    // 2. HOST: Create Game
    socket.on('create_room', () => {
        if (isGameActive) return; 
        
        isGameActive = true; 
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
        
        // BROADCAST: Tell EVERYONE the game has started
        io.emit('game_active', true); 
    });

    // 3. PLAYER: Join Game
    socket.on('join_room', ({ code, name }) => {
        const room = rooms[code];
        if (room) {
            socket.join(code);
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

    // 4. HOST: Start Game
    socket.on('start_game', (code) => {
        const room = rooms[code];
        if (room && socket.id === room.host) {
            sendQuestion(code);
        }
    });

    // 5. HOST: Next Question
    socket.on('next_question', (code) => {
        const room = rooms[code];
        if (room && socket.id === room.host) {
            room.currentQuestion++;
            if (room.currentQuestion < QUESTIONS.length) {
                sendQuestion(code);
            } else {
                const leaderboard = room.players.sort((a,b) => b.score - a.score);
                io.to(code).emit('game_over', leaderboard);
            }
        }
    });

    // 6. HOST: Stop Session
    socket.on('stop_game', (code) => {
        io.to(code).emit('session_ended');
        delete rooms[code];
        
        isGameActive = false; // Unlock
        io.emit('game_active', false); 
    });

    // 7. PLAYER: Submit Answer
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