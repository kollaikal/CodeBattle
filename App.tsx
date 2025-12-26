
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Player, AIGuard, CodeSnippet, GameStats, HighScore } from './types';
import ArenaCanvas from './components/ArenaCanvas';
import TypingEngine from './components/TypingEngine';
import { fetchRandomSnippet } from './services/githubService';
import { gameAudio } from './services/audioService';

const INITIAL_SAFE_ZONE = { x: 400, y: 300, radius: 450 };
const TICK_RATE = 100;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guards, setGuards] = useState<AIGuard[]>([]);
  const [safeZone, setSafeZone] = useState(INITIAL_SAFE_ZONE);
  const [snippet, setSnippet] = useState<CodeSnippet | null>(null);
  const [usedSnippetUrls, setUsedSnippetUrls] = useState<string[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [highScore, setHighScore] = useState<HighScore | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [loadingSnippet, setLoadingSnippet] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<{msg: string, type: 'err' | 'sys' | 'info'}[]>([]);
  const [spectatorChat, setSpectatorChat] = useState<string[]>([]);
  const [myPlayerId] = useState(`player-${Math.random().toString(36).substr(2, 9)}`);

  const gameLoopRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load High Score
  useEffect(() => {
    const saved = localStorage.getItem('codebattle_high_score');
    if (saved) setHighScore(JSON.parse(saved));
  }, []);

  const addLog = (msg: string, type: 'err' | 'sys' | 'info' = 'info') => {
    setTerminalLogs(prev => [...prev.slice(-15), { msg, type }]);
  };

  const startLobby = useCallback(async () => {
    setGameState(GameState.LOBBY);
    setIsStarted(false);
    setSafeZone(INITIAL_SAFE_ZONE);
    setGuards([]);
    setWpm(0);
    setAccuracy(100);
    setUsedSnippetUrls([]);
    setStats(null);
    setSpectatorChat([]);
    setTerminalLogs([{ msg: "Initializing virtual shell environment...", type: 'info' }]);

    const botNames = [
      "SyntaxError", "NullPointerEx", "StackOverflow", "BugSquasher", "GitGud", 
      "KernelPanic", "VimGod", "IndentationError", "HeapDump", "MemoryLeak",
      "RaceCondition", "SegFault", "AsyncAwait", "BinarySearch", "Deadlock",
      "Gopher", "Rustacean", "PyExpert", "NodeNinja", "ReactWizard"
    ];
    
    const initialPlayers: Player[] = [
      { id: myPlayerId, name: "YOU (MasterBranch)", x: 400, y: 300, isAlive: true, wpm: 0, accuracy: 100, health: 100, avatar: '', isBot: false }
    ];

    for (let i = 0; i < 49; i++) {
      initialPlayers.push({
        id: `bot-${i}`,
        name: botNames[i % botNames.length] + `_${Math.floor(Math.random()*999)}`,
        x: Math.random() * 800,
        y: Math.random() * 600,
        isAlive: true,
        wpm: 0,
        accuracy: 100,
        health: 100,
        avatar: '',
        isBot: true
      });
    }

    setPlayers(initialPlayers);
    
    setLoadingSnippet(true);
    try {
      const firstSnippet = await fetchRandomSnippet([]);
      setSnippet(firstSnippet);
    } catch (e) {
      addLog("Failed to fetch initial snippet.", "err");
    } finally {
      setLoadingSnippet(false);
    }
  }, [myPlayerId]);

  useEffect(() => {
    startLobby();
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [startLobby]);

  const onFirstKey = () => {
    if (!isStarted && gameState === GameState.LOBBY) {
      setIsStarted(true);
      setGameState(GameState.PLAYING);
      startTimeRef.current = Date.now();
      addLog("Battle Royale Protocol Engaged.", "sys");
    }
  };

  const getNextSnippet = async () => {
    setLoadingSnippet(true);
    const currentGitUrl = snippet?.gitUrl || "";
    const exclude = [...usedSnippetUrls, currentGitUrl].filter(url => url !== "");
    
    try {
      const next = await fetchRandomSnippet(exclude);
      setSnippet(null); 
      setTimeout(() => {
        setSnippet(next);
        setUsedSnippetUrls(exclude);
        setLoadingSnippet(false);
      }, 50);
    } catch (e) {
      addLog("Snippet fetch error.", "err");
      setLoadingSnippet(false);
    }
  };

  const handleProgress = (correct: number, total: number, errors: number) => {
    if (!isStarted) onFirstKey();
    
    const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
    const currentWpm = elapsedMinutes > 0 ? Math.round((correct / 5) / elapsedMinutes) : 0;
    const currentAcc = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
    setWpm(currentWpm);
    setAccuracy(currentAcc);
  };

  const handleErrorThreshold = () => {
    addLog("STRIKE DETECTED. Guard Inbound.", "err");
    gameAudio.playAlert();
    setPlayers(pts => pts.map(p => p.id === myPlayerId ? { ...p, health: Math.max(0, p.health - 25) } : p));
    setGuards(prev => [...prev, {
      id: `guard-${Date.now()}`,
      x: Math.random() > 0.5 ? 0 : 800,
      y: Math.random() * 600,
      targetId: myPlayerId,
      speed: 3.0
    }]);
    
    setTimeout(() => {
      getNextSnippet();
    }, 1200);
  };

  const handleComplete = async () => {
    addLog("Commit successful. Restore HP.", "sys");
    setPlayers(pts => pts.map(p => p.id === myPlayerId ? { ...p, health: Math.min(100, p.health + 20) } : p));
    await getNextSnippet();
  };

  // Fix: Added handleRestart function to reset the game lobby
  const handleRestart = () => {
    startLobby();
  };

  useEffect(() => {
    if (gameState !== GameState.PLAYING || !isStarted) return;

    const tick = () => {
      const nextRadius = Math.max(safeZone.radius - 0.75, 15);
      if (Math.floor(nextRadius) % 50 === 0 && Math.floor(nextRadius) !== Math.floor(safeZone.radius)) {
        gameAudio.playAlert();
        addLog("Critical: Safe zone shrinking rapidly.", "sys");
      }
      setSafeZone(prev => ({ ...prev, radius: nextRadius }));

      setPlayers(prevPlayers => {
        const aliveBotsCount = prevPlayers.filter(p => p.isAlive && p.isBot).length;
        const myPlayer = prevPlayers.find(p => p.id === myPlayerId);
        
        return prevPlayers.map(p => {
          if (!p.isAlive) return p;

          let newHealth = p.health;
          const dist = Math.sqrt(Math.pow(p.x - safeZone.x, 2) + Math.pow(p.y - safeZone.y, 2));
          
          if (dist > safeZone.radius) {
            newHealth -= 1.8;
          }

          let newX = p.x;
          let newY = p.y;
          if (p.isBot) {
            const dx = safeZone.x - p.x;
            const dy = safeZone.y - p.y;
            const distToCenter = Math.sqrt(dx*dx + dy*dy);
            if (distToCenter > 4) {
              newX += (dx / distToCenter) * 0.8;
              newY += (dy / distToCenter) * 0.8;
            }
            if (Math.random() < 0.003 + (INITIAL_SAFE_ZONE.radius - safeZone.radius) / 8000) {
              newHealth = 0;
            }
          }

          if (newHealth <= 0) {
            gameAudio.playElimination();
            if (p.id === myPlayerId) {
              setGameState(GameState.GAMEOVER);
              const finalStats = {
                rank: aliveBotsCount + 1,
                totalPlayers: 50,
                wpm: wpm,
                accuracy: accuracy,
                timeSurvived: Math.floor((Date.now() - startTimeRef.current) / 1000)
              };
              setStats(finalStats);

              // Update High Score
              const currentHigh = JSON.parse(localStorage.getItem('codebattle_high_score') || '{"wpm":0,"accuracy":0}');
              if (wpm > currentHigh.wpm) {
                const newHigh = { wpm, accuracy };
                localStorage.setItem('codebattle_high_score', JSON.stringify(newHigh));
                setHighScore(newHigh);
              }
            } else if (p.isBot) {
               addLog(`Process ${p.name} killed.`, "err");
               if (!myPlayer?.isAlive) {
                 setSpectatorChat(prev => [...prev.slice(-5), `Spectator: RIP ${p.name}`]);
               }
            }
            return { ...p, health: 0, isAlive: false };
          }

          return { ...p, health: newHealth, x: newX, y: newY };
        });
      });

      setGuards(prevGuards => {
        const myPlayer = players.find(p => p.id === myPlayerId);
        if (!myPlayer || !myPlayer.isAlive) return prevGuards;

        return prevGuards.map(g => {
          const dx = myPlayer.x - g.x;
          const dy = myPlayer.y - g.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < 12) {
             setPlayers(pts => pts.map(p => p.id === myPlayerId ? { ...p, health: Math.max(0, p.health - 25) } : p));
             gameAudio.playElimination(); // Impact sound
             return null;
          }
          return { ...g, x: g.x + (dx / dist) * g.speed, y: g.y + (dy / dist) * g.speed };
        }).filter(Boolean) as AIGuard[];
      });
    };

    gameLoopRef.current = window.setInterval(tick, TICK_RATE);
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, isStarted, safeZone, players, myPlayerId, accuracy, wpm]);

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#abb2bf] flex flex-col font-sans selection:bg-[#528bff]/40">
      <header className="h-9 flex items-center justify-between px-3 bg-[#323233] border-b border-[#2b2b2b] text-[11px] text-[#cccccc] font-medium shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
            <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
          </div>
          <div className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded cursor-default">
            <span>Battle Royale</span>
            <span className="opacity-50">v1.2.0</span>
          </div>
        </div>
        <div className="flex-1 text-center truncate px-4 font-normal text-[#9d9d9d]">
          {snippet ? `${snippet.fileName} — CodeBattle Royale` : 'CodeBattle Royale'}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#61afef] font-bold">
            <span className={`w-2 h-2 rounded-full ${isStarted ? 'bg-[#e06c75] animate-pulse' : 'bg-[#98c379]'}`}></span>
            {isStarted ? `ALIVE: ${players.filter(p => p.isAlive).length}` : 'LOBBY'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-12 bg-[#333333] flex flex-col items-center py-4 gap-6 border-r border-[#2b2b2b] shrink-0">
          <div className="p-1 cursor-pointer text-[#61afef] border-l-2 border-[#61afef]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </div>
        </aside>

        <aside className="w-64 bg-[#252526] flex flex-col border-r border-[#2b2b2b] hidden md:flex shrink-0">
          <div className="px-4 py-3 flex items-center justify-between text-[10px] text-[#abb2bf] font-bold uppercase tracking-widest">
            <span>Environment</span>
          </div>
          <div className="px-4 py-2 space-y-4">
            <div className="bg-[#1e1e1e] rounded p-3 border border-[#3e4451] text-[10px] font-mono shadow-lg">
                <p className="text-[#98c379] mb-1 uppercase font-bold">SESSION STATS</p>
                <div className="space-y-1">
                   <div className="flex justify-between"><span>Speed</span> <span className="text-[#61afef]">{wpm} WPM</span></div>
                   <div className="flex justify-between"><span>Precision</span> <span className={`${accuracy < 90 ? 'text-[#e06c75]' : 'text-[#98c379]'}`}>{accuracy}%</span></div>
                </div>
             </div>
             {highScore && (
               <div className="bg-[#1e1e1e]/50 rounded p-3 border border-[#333] text-[10px] font-mono">
                  <p className="text-[#e5c07b] mb-1 uppercase font-bold">PERSONAL BEST</p>
                  <div className="space-y-1 opacity-80">
                    <div className="flex justify-between"><span>Top Speed</span> <span>{highScore.wpm} WPM</span></div>
                  </div>
               </div>
             )}
          </div>
          
          {gameState === GameState.GAMEOVER && (
            <div className="mt-auto p-4 border-t border-[#333]">
              <p className="text-[10px] font-bold text-[#61afef] mb-2">SPECTATOR CHAT</p>
              <div className="h-32 overflow-y-auto space-y-1 font-mono text-[9px] bg-[#1a1a1b] p-2 rounded">
                {spectatorChat.length === 0 && <p className="opacity-30 italic">Silence in the gallery...</p>}
                {spectatorChat.map((chat, i) => <p key={i} className="text-[#abb2bf]">{chat}</p>)}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
            <div className="flex-[0.5] relative bg-[#282c34] border-r border-[#2b2b2b] shadow-inner overflow-hidden">
              <ArenaCanvas players={players} guards={guards} safeZone={safeZone} localPlayerId={myPlayerId} />
              
              {!isStarted && gameState === GameState.LOBBY && (
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                   <div className="bg-[#1e1e1e]/95 backdrop-blur-md p-8 rounded-2xl border-2 border-[#61afef] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-center max-w-sm">
                      <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">DEPLOYMENT READY</h2>
                      <p className="text-[11px] text-[#abb2bf] font-mono opacity-80 uppercase leading-relaxed">
                         50 program instances detected. <br/>
                         Start typing to engage.
                      </p>
                   </div>
                </div>
              )}

              {gameState === GameState.GAMEOVER && stats && (
                <div className="absolute inset-0 bg-[#1e1e1e]/98 backdrop-blur-3xl flex items-center justify-center p-8 z-[100] animate-in fade-in duration-700">
                   <div className="w-full max-w-md text-center font-mono">
                      <h2 className="text-8xl font-black mb-2 text-[#e06c75] tracking-tighter italic">#{stats.rank}</h2>
                      <p className="text-xs text-[#61afef] font-bold mb-8 uppercase tracking-[0.6em] px-4 py-2 bg-[#61afef]/10 rounded-full inline-block">
                        Instance Terminated
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="bg-[#2d2d2d] p-6 rounded border border-[#3e4451]">
                            <p className="text-[#5c6370] text-[10px] uppercase mb-1 font-bold">WPM</p>
                            <p className="text-4xl font-black text-[#98c379]">{stats.wpm}</p>
                         </div>
                         <div className="bg-[#2d2d2d] p-6 rounded border border-[#3e4451]">
                            <p className="text-[#5c6370] text-[10px] uppercase mb-1 font-bold">Personal Best</p>
                            <p className="text-4xl font-black text-[#e5c07b]">{highScore?.wpm || stats.wpm}</p>
                         </div>
                      </div>

                      <button 
                        onClick={handleRestart}
                        className="w-full py-4 bg-[#61afef] text-[#1e1e1e] font-black rounded-lg hover:bg-[#528bff] transition-all uppercase text-sm shadow-[0_10px_30px_rgba(97,175,239,0.3)] active:scale-95 mb-4"
                      >
                        REBOOT INSTANCE
                      </button>
                      
                      <p className="text-[10px] text-[#5c6370] uppercase">You are now spectating. Exit anytime.</p>
                   </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
               <div className="h-9 bg-[#252526] flex items-center border-b border-[#2b2b2b] shrink-0">
                  <div className="flex items-center gap-2 px-4 h-full bg-[#1e1e1e] border-t border-t-[#61afef] border-r border-[#2b2b2b] text-[11px] text-[#cccccc] cursor-default">
                    <svg className="w-3.5 h-3.5 text-[#61afef]" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    <span>{snippet?.fileName || 'loading...'}</span>
                  </div>
               </div>

               <div className="flex-1 min-h-0 relative">
                  {snippet && !loadingSnippet ? (
                    <TypingEngine 
                      code={snippet.code}
                      language={snippet.language}
                      onProgress={handleProgress}
                      onComplete={handleComplete}
                      onErrorThresholdReached={handleErrorThreshold}
                      isGameOver={gameState === GameState.GAMEOVER}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] font-mono">
                      <div className="text-center">
                        <div className="animate-spin w-5 h-5 border-2 border-[#61afef] border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-[9px] text-[#5c6370] uppercase tracking-widest">Awaiting Artifacts...</p>
                      </div>
                    </div>
                  )}
               </div>

               <div className="h-40 bg-[#1e1e1e] border-t border-[#333333] flex flex-col overflow-hidden shrink-0">
                  <div className="flex items-center gap-6 px-4 py-1.5 bg-[#1e1e1e] border-b border-[#333333] text-[9px] font-bold uppercase tracking-wider text-[#9d9d9d]">
                     <span className="text-[#61afef] border-b border-[#61afef] pb-0.5">Terminal</span>
                     <span className="opacity-50">Output</span>
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] leading-snug space-y-0.5 bg-[#1e1e1e] custom-scrollbar">
                    {terminalLogs.map((log, i) => (
                      <p key={i} className={log.type === 'err' ? 'text-[#e06c75]' : log.type === 'sys' ? 'text-[#98c379]' : 'text-[#abb2bf]'}>
                        <span className="font-bold">[{log.type.toUpperCase()}]</span> {log.msg}
                      </p>
                    ))}
                    {isStarted && (
                      <p className="text-[#61afef] animate-pulse">
                        <span className="text-[#98c379] font-bold">[SYS]</span> Monitoring heartbeat... Safe zone: {Math.floor(safeZone.radius)}m
                      </p>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] font-medium overflow-hidden shrink-0 z-50">
        <div className="flex items-center gap-4 h-full">
          <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <span>master*</span>
          </div>
        </div>
        <div className="flex items-center gap-4 h-full">
          <span className="bg-[#1e1e1e] px-3 h-full flex items-center gap-1.5 font-bold text-[#61afef] border-l border-[#2b2b2b]">
            <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'bg-[#98c379] shadow-[0_0_8px_#98c379]' : 'bg-[#e5c07b]'}`}></span>
            KERNEL: {isStarted ? 'ENGAGED' : 'IDLE'}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
