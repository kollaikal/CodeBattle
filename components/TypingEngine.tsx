
import React, { useState, useEffect, useRef } from 'react';
import { gameAudio } from '../services/audioService';

interface TypingEngineProps {
  code: string;
  language: string;
  onProgress: (correctChars: number, totalChars: number, errors: number) => void;
  onComplete: () => void;
  onErrorThresholdReached: () => void;
  isGameOver: boolean;
}

const TypingEngine: React.FC<TypingEngineProps> = ({ 
  code, 
  language, 
  onProgress, 
  onComplete, 
  onErrorThresholdReached,
  isGameOver 
}) => {
  const [input, setInput] = useState("");
  const [currentErrors, setCurrentErrors] = useState(0);
  const [isStriking, setIsStriking] = useState(false);
  const [shake, setShake] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInput("");
    setCurrentErrors(0);
    setIsStriking(false);
    
    const timeout = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [code]);

  const calculateStats = (val: string) => {
    let errors = 0;
    let correct = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === code[i]) {
        correct++;
      } else {
        errors++;
      }
    }

    if (errors > currentErrors) {
      gameAudio.playError();
      setShake(true);
      setTimeout(() => setShake(false), 200);
    } else if (val.length > input.length) {
      gameAudio.playType();
    }

    setCurrentErrors(errors);
    onProgress(correct, code.length, errors);

    if (errors >= 3 && !isStriking) {
      setIsStriking(true);
      gameAudio.playAlert();
      onErrorThresholdReached();
    }

    if (val === code && errors === 0) {
      onComplete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isGameOver || isStriking) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const remainingCode = code.substring(input.length);
      const match = remainingCode.match(/^ +/);
      const spacesToInsert = match ? match[0] : "  ";
      const newInput = input + spacesToInsert;
      setInput(newInput);
      calculateStats(newInput);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isGameOver || isStriking) return;
    const val = e.target.value;
    if (val.length < input.length - 12) {
       setInput(val);
       calculateStats(val);
       return;
    }
    setInput(val);
    calculateStats(val);
  };

  const renderCode = () => {
    return code.split("").map((char, i) => {
      let colorClass = "text-[#4b5263]"; 
      let decoration = "";

      if (i < input.length) {
        if (input[i] === char) {
          if (/[0-9]/.test(char)) colorClass = "text-[#d19a66]";
          else if (/[{}()\[\]]/.test(char)) colorClass = "text-[#abb2bf]";
          else if (/['"`]/.test(char)) colorClass = "text-[#98c379]";
          else {
            const surrounding = code.substring(Math.max(0, i - 10), Math.min(code.length, i + 10));
            if (/\b(function|def|const|let|var|class|export|import|pub|fn|return|if|else|for|while|await|async)\b/.test(surrounding)) {
               colorClass = "text-[#c678dd]";
            } else {
               colorClass = "text-[#61afef]";
            }
          }
        } else {
          colorClass = "text-[#e06c75] bg-[#e06c75]/30"; 
          decoration = "underline decoration-[#e06c75] decoration-2";
        }
      }

      if (i === input.length && !isGameOver && !isStriking) {
        decoration += " border-l-2 border-[#528bff] animate-pulse";
      }

      return (
        <span key={i} className={`${colorClass} ${decoration} transition-all duration-75`}>
          {char === "\n" ? "↵\n" : char}
        </span>
      );
    });
  };

  return (
    <div className={`w-full h-full relative font-mono text-lg overflow-hidden bg-[#1e1e1e] ${shake ? 'animate-shake' : ''}`}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.15s ease-in-out infinite; }
      `}</style>
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#1e1e1e] flex flex-col items-center py-6 text-[12px] text-[#4b5263] border-r border-[#333333] select-none z-0">
        {code.split('\n').map((_, i) => (
          <div key={i} className="h-[1.75rem] flex items-center leading-relaxed">{i + 1}</div>
        ))}
      </div>

      <div className="relative flex-1 h-full pl-16 p-6 overflow-y-auto whitespace-pre-wrap leading-relaxed select-none custom-scrollbar">
        <textarea
          ref={textareaRef}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text resize-none z-10"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isGameOver || isStriking}
          spellCheck={false}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div className="relative pointer-events-none z-0">
          {renderCode()}
        </div>
      </div>
      
      <div className="absolute top-4 right-6 flex gap-2.5 z-20 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <div 
            key={i} 
            className={`w-3 h-3 rounded-full transition-all duration-500 ${i < currentErrors ? 'bg-[#e06c75] shadow-[0_0_12px_#e06c75] scale-125' : 'bg-[#3e4451]'}`}
          ></div>
        ))}
      </div>

      {isStriking && !isGameOver && (
        <div className="absolute inset-0 bg-[#1e1e1e]/85 backdrop-blur-md flex items-center justify-center z-30 animate-in fade-in zoom-in duration-300">
           <div className="text-center font-mono border-2 border-[#e06c75] p-8 bg-[#2d2d2d] rounded-xl shadow-[0_0_50px_rgba(224,108,117,0.3)]">
             <h3 className="text-[#e06c75] text-2xl font-black italic tracking-tighter mb-2">STRIKE OUT: SEGFAULT</h3>
             <p className="text-[11px] text-[#858585] uppercase tracking-[0.4em] animate-pulse">Reloading kernel artifacts...</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default TypingEngine;
