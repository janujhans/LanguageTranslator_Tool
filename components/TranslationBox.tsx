
import React, { useState, useEffect, useRef } from 'react';
import { generateSpeech } from '../services/geminiService';

interface TranslationBoxProps {
  value: string;
  pronunciation?: string;
  onChange?: (val: string) => void;
  placeholder: string;
  readOnly?: boolean;
  isStreaming?: boolean;
  langCode: string;
  onFavorite?: (text: string, translated: string) => void;
  originalText?: string;
}

const TranslationBox: React.FC<TranslationBoxProps> = ({ 
  value, 
  pronunciation,
  onChange, 
  placeholder, 
  readOnly,
  isStreaming,
  langCode,
  onFavorite,
  originalText
}) => {
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleTTS = () => {
    if (value) {
      // Use the provided langCode, or default to English if it's 'auto' for the source box
      const speechLang = langCode === 'auto' ? 'en' : langCode;
      generateSpeech(value, speechLang);
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langCode === 'auto' ? 'en-US' : langCode;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      onChange?.(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className={`bg-white dark:bg-brand-dark rounded-[2.5rem] shadow-lg p-6 flex flex-col min-h-[160px] relative transition-all duration-300 border-2 ${isRecording ? 'border-brand-screen animate-pulse' : 'border-transparent'}`}>
      <div className="flex-1 w-full flex flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={isRecording ? "Listening..." : placeholder}
          readOnly={readOnly}
          aria-label={readOnly ? "Translation result" : "Input text to translate"}
          className="w-full bg-transparent border-none outline-none resize-none text-xl font-extrabold text-brand-dark dark:text-white placeholder-slate-300 dark:placeholder-white/10 py-2 custom-scrollbar"
          rows={3}
        />
        
        {readOnly && pronunciation && (
          <div className="animate-slide-up">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Spell-out</p>
            <p className="text-sm font-bold text-brand-dark dark:text-white opacity-60 dark:opacity-80 bg-brand-gray/50 dark:bg-white/5 px-3 py-1.5 rounded-xl inline-block" aria-label={`Pronunciation: ${pronunciation}`}>
              {pronunciation}
            </p>
          </div>
        )}
      </div>
      
      <div className="absolute right-6 top-6 bottom-6 flex flex-col justify-start gap-4 z-10">
        {!readOnly && (
          <button 
            onClick={toggleRecording} 
            aria-label={isRecording ? "Stop recording voice" : "Start voice input"}
            title="Voice Input"
            className={`transition-all p-1.5 rounded-full ${isRecording ? 'bg-rose-500 text-white shadow-lg scale-110' : 'text-slate-300 dark:text-slate-600 hover:text-brand-dark dark:hover:text-white'}`}
          >
            {isRecording ? (
              <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            )}
          </button>
        )}

        {value && (
          <>
            <button 
              onClick={handleTTS} 
              aria-label="Listen to text"
              title="Speak Text"
              className="text-slate-300 dark:text-slate-600 hover:text-brand-dark dark:hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            </button>
            
            <button 
              onClick={handleCopy} 
              aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
              title="Copy"
              className={`transition-colors p-1 ${copied ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 hover:text-brand-dark dark:hover:text-white'}`}
            >
              {copied ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              )}
            </button>

            {readOnly && onFavorite && (
              <button 
                onClick={() => onFavorite(originalText || '', value)} 
                aria-label="Add to favorites"
                title="Save to Library"
                className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/></svg>
              </button>
            )}
            
            {!readOnly && (
               <button 
                onClick={() => onChange?.('')} 
                aria-label="Clear input text"
                title="Clear"
                className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors p-1"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
               </button>
            )}
          </>
        )}
      </div>

      {isStreaming && (
        <div className="flex gap-1 absolute bottom-4 left-6" aria-label="Translating...">
           <div className="w-1.5 h-1.5 bg-brand-screen rounded-full animate-bounce" />
           <div className="w-1.5 h-1.5 bg-brand-screen rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
           <div className="w-1.5 h-1.5 bg-brand-screen rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      )}
    </div>
  );
};

export default TranslationBox;
