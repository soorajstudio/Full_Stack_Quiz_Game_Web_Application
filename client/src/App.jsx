import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io(); // Uses relative path, works with Vite proxy and Cloudflare

function App() {
  const [role, setRole] = useState(null); // 'HOST' or 'PLAYER'
  const [screen, setScreen] = useState("HOME"); // HOME, LOBBY, GAME, RESULT, PODIUM
  
  // Game State
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [correctIdx, setCorrectIdx] = useState(null);
  
  // Player State
  const [playerName, setPlayerName] = useState("");
  const [myAnswer, setMyAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  
  // Host State
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    // --- SOCKET LISTENERS ---
    socket.on("room_created", (code) => {
      setRoomCode(code);
      setRole("HOST");
      setScreen("LOBBY");
    });

    socket.on("join_success", () => {
      setRole("PLAYER");
      setScreen("LOBBY");
    });

    socket.on("player_update", (list) => setPlayers(list));

    socket.on("new_question", (data) => {
      setQuestion(data);
      setScreen("GAME");
      setMyAnswer(null);
      setCorrectIdx(null);
      setTimeLeft(30);
      setAnsweredCount(0);
    });

    socket.on("live_answer_update", () => setAnsweredCount(prev => prev + 1));

    socket.on("round_ended", ({ leaderboard, correctIdx }) => {
      setPlayers(leaderboard);
      setCorrectIdx(correctIdx);
      setScreen("RESULT");
    });

    socket.on("game_over", (leaderboard) => {
        setPlayers(leaderboard);
        setScreen("PODIUM");
    });

    socket.on("session_ended", () => {
        alert("Session ended by host.");
        window.location.reload();
    });

    socket.on("error", (msg) => alert(msg));

    return () => socket.off();
  }, []);

  // Timer Countdown Logic
  useEffect(() => {
    if (screen === "GAME" && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [screen, timeLeft]);

  // --- ACTIONS ---
  const hostCreate = () => socket.emit("create_room");
  const hostStart = () => socket.emit("start_game", roomCode);
  const hostNext = () => socket.emit("next_question", roomCode);
  const hostStop = () => socket.emit("stop_game", roomCode);

  const playerJoin = () => {
    if(!playerName || !roomCode) return alert("Need Name & Code");
    socket.emit("join_room", { code: roomCode, name: playerName });
  };

  const submitAnswer = (idx) => {
    if (myAnswer !== null) return; // Prevent multiple clicks
    setMyAnswer(idx);
    socket.emit("submit_answer", { code: roomCode, answerIdx: idx, timeLeft });
  };

  // Helper: CSS Class for Buttons
  const getOptionClass = (idx) => {
    if (screen === "GAME") {
      if (myAnswer === null) return "option-btn"; 
      if (myAnswer === idx) return "option-btn selected"; 
      return "option-btn dimmed";
    }
    if (screen === "RESULT") {
       if (idx === correctIdx) return "option-btn correct"; 
       if (idx === myAnswer && idx !== correctIdx) return "option-btn wrong"; 
       return "option-btn dimmed";
    }
    return "option-btn";
  };

  // Helper: Determine Background FX
  let bgClass = "";
  if (screen === "RESULT" && role === "PLAYER") {
      if (myAnswer === correctIdx) {
          bgClass = "bg-victory"; // Green Pulse
      } else {
          bgClass = "bg-fail";    // Red Pulse
      }
  }

  return (
    <>
    {/* CRT Scanline Overlay */}
    <div className="scanlines"></div>
    
    {/* Dynamic Background FX (Victory/Fail) */}
    <div className={`background-fx ${bgClass}`}></div>
    
    <div className="container">
      
      {/* 1. HOME SCREEN */}
      {screen === "HOME" && (
        <div className="card">
          <h1 className="glitch" data-text="SiteForge">SiteForge</h1>
          
          <div style={{marginTop: '30px', display:'flex', flexDirection:'column', gap:'20px'}}>
             {/* HOST PANEL */}
             <div style={{border:'1px dashed #fcee0a', padding:'20px'}}>
                <h3 style={{margin:0, border: 'none', color: '#fcee0a'}}>NET RUNNER (HOST)</h3>
                <button className="btn-host" onClick={hostCreate}>INITIATE SERVER</button>
             </div>
             
             {/* PLAYER PANEL */}
             <div>
                <h3 style={{margin:0, border: 'none', color: '#00f0ff'}}>PLAYER LOGIN</h3>
                <input placeholder="ROOM CODE (122333)" onChange={e => setRoomCode(e.target.value)} />
                <input placeholder="YOUR NAME" onChange={e => setPlayerName(e.target.value)} />
                <button className="btn-primary" onClick={playerJoin}>ENTER</button>
             </div>
          </div>
        </div>
      )}

      {/* 2. LOBBY SCREEN */}
      {screen === "LOBBY" && (
        <div className="card">
          <h2>GAME CREATED</h2>
          <h1 style={{fontSize:'3rem', letterSpacing:'5px'}}>{roomCode}</h1>
          
          <div style={{margin: '20px 0', borderTop:'2px solid #333', paddingTop:'15px'}}>
             <p style={{color:'#666', fontSize:'0.8rem'}}>CONNECTED AGENTS:</p>
             {players.map(p => (
               <div key={p.id} className="player-tag">
                  {p.name}
               </div>
             ))}
          </div>

          {role === "HOST" ? (
             <button className="btn-start" onClick={hostStart}>START GAME</button>
          ) : (
             <p className="pulse">AWAITING HOST COMMAND...</p>
          )}
        </div>
      )}

      {/* 3. GAMEPLAY SCREEN */}
      {screen === "GAME" && (
        <div className="card">
           {role === "HOST" && <div className="host-badge">ADMIN MODE</div>}
           
           {/* NUMERICAL TIMER */}
           <div className="timer-wrapper">
             <div className={`timer-digit ${
                timeLeft <= 10 ? 'critical' : 
                timeLeft <= 20 ? 'warning' : ''
             }`}>
                {timeLeft}
             </div>
             <div className="timer-label">Seconds Remaining</div>
           </div>

           {/* PROGRESS BAR */}
           <div className="timer-box">
             <div className="timer-bar" style={{width: `${(timeLeft/30)*100}%`}}></div>
           </div>

          <h3 style={{fontSize:'1.6rem', lineHeight:'1.3', marginTop: '25px'}}>{question.text}</h3>
          
          {/* PLAYER OPTIONS */}
          {role === "PLAYER" && (
             <div className="options-grid">
               {question.options.map((opt, i) => (
                 <button key={i} className={getOptionClass(i)} onClick={() => submitAnswer(i)}>
                   {opt}
                 </button>
               ))}
             </div>
          )}

          {/* HOST STATS */}
          {role === "HOST" && (
             <div style={{textAlign:'center', marginTop:'30px', borderTop:'1px solid #333', paddingTop:'20px'}}>
                <h1 style={{fontSize:'4rem', color:'#00f0ff', margin:0}}>{answeredCount} / {players.length}</h1>
                <p style={{letterSpacing:'2px', color:'#666'}}>NUMBER OF PLAYERS</p>
             </div>
          )}
        </div>
      )}

      {/* 4. RESULT SCREEN */}
      {screen === "RESULT" && (
        <div className="card">
           {role === "PLAYER" && (
              <>
                <h2 style={{fontSize:'2.5rem', marginBottom:'10px'}}>
                    {myAnswer === correctIdx ? "SUCCESS" : "FAILURE"}
                </h2>
                <div className="options-grid" style={{transform:'scale(0.9)', opacity:0.8, pointerEvents:'none'}}>
                   {question.options.map((opt, i) => (
                     <button key={i} className={getOptionClass(i)} disabled>{opt}</button>
                   ))}
                </div>
              </>
           )}

           <h3 style={{marginTop:'20px', borderLeft:'4px solid #fcee0a', paddingLeft:'10px'}}>CURRENT RANKING</h3>
           <div style={{maxHeight:'200px', overflowY:'auto', paddingRight:'5px'}}>
              {players.map((p, i) => (
                <div key={p.id} className={`rank-row ${p.id === socket.id ? 'me' : ''}`}>
                   <span>#{i+1} {p.name}</span>
                   <span style={{color:'var(--cy-yellow)'}}>{p.score} EXP</span>
                </div>
              ))}
           </div>

           {role === "HOST" ? (
              <button className="btn-next" onClick={hostNext}>NEXT SEQUENCE &gt;&gt;</button> 
           ) : (
              <p className="pulse">SYNCHRONIZING WITH SERVER...</p>
           )}
        </div>
      )}

      {/* 5. PODIUM SCREEN */}
      {screen === "PODIUM" && (
          <div className="card">
              <h1 className="glitch" data-text="MISSION COMPLETE">MISSION COMPLETE</h1>
              
              {/* TOP 3 PODIUM */}
              <div className="podium-container">
                  {players[1] && (
                    <div className="podium-bar silver">
                        <div className="bar-block" style={{height:'100px'}}></div>
                        <div className="podium-name">{players[1].name}</div>
                        <div className="podium-score">{players[1].score}</div>
                    </div>
                  )}
                  {players[0] && (
                    <div className="podium-bar gold">
                        <div className="avatar">👑</div>
                        <div className="bar-block" style={{height:'160px'}}></div>
                        <div className="podium-name">{players[0].name}</div>
                        <div className="podium-score">{players[0].score}</div>
                    </div>
                  )}
                  {players[2] && (
                    <div className="podium-bar bronze">
                        <div className="bar-block" style={{height:'70px'}}></div>
                        <div className="podium-name">{players[2].name}</div>
                        <div className="podium-score">{players[2].score}</div>
                    </div>
                  )}
              </div>

              {/* HONOR ROLL (4th PLACE AND BELOW) */}
              {players.length > 3 && (
                <div className="honor-roll">
                    <h3 style={{borderBottom: '1px solid #333', paddingBottom:'10px', marginTop:'20px', fontSize:'1rem', color:'#666'}}>HONOR ROLL</h3>
                    <div style={{maxHeight: '150px', overflowY: 'auto'}}>
                        {players.slice(3).map((p, i) => (
                            <div key={p.id} className="rank-row">
                                <span style={{color:'#888', width:'30px'}}>#{i + 4}</span>
                                <span style={{flexGrow:1}}>{p.name}</span>
                                <span style={{color:'var(--cy-yellow)'}}>{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {role === "HOST" ? (
                  <button className="btn-danger" onClick={hostStop}>TERMINATE SESSION</button>
              ) : (
                  <p className="pulse">AWAITING TERMINATION...</p>
              )}
          </div>
      )}

    </div>
    </>
  );
}

export default App;