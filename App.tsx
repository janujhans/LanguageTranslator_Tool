
import React, { useState, useEffect } from 'react';
import { TranslationMode, HistoryItem } from './types';
import { LANGUAGES, APP_CONFIG } from './constants';
import LanguageSelector from './components/LanguageSelector';
import TranslationBox from './components/TranslationBox';
import VoiceMode from './components/VoiceMode';
import VisionMode from './components/VisionMode';
import { translateTextStream, generateSpeech } from './services/geminiService';

enum Tab {
  HOME = 'home',
  SEARCH = 'search',
  FAVORITES = 'favorites'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [mode, setMode] = useState<TranslationMode | null>(null);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [sourceText, setSourceText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [favorites, setFavorites] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!mode || mode !== TranslationMode.TEXT || !sourceText.trim()) {
      if (!sourceText.trim()) {
        setTranslatedText('');
        setPronunciation('');
        setErrorMsg(null);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      setErrorMsg(null);
      let fullResponse = '';
      
      try {
        await translateTextStream(sourceText, sourceLang, targetLang, (chunk) => {
          fullResponse += chunk;
          if (fullResponse.includes('|||')) {
            const [translation, phonetic] = fullResponse.split('|||');
            setTranslatedText(translation.trim());
            if (phonetic) setPronunciation(phonetic.trim());
          } else {
            setTranslatedText(fullResponse.trim());
          }
        });
      } catch (err: any) {
        console.error('Translation failed', err);
        const errMsg = err?.message || '';
        if (!navigator.onLine) {
          setErrorMsg("Connect to translate new phrases");
        } else if (errMsg.includes('API key') || errMsg.includes('403') || errMsg.includes('401')) {
          setErrorMsg("API Config Error. Please check environment.");
        } else {
          setErrorMsg("Service unavailable. Try again.");
        }
      } finally {
        setIsTranslating(false);
      }
    }, APP_CONFIG.AUTO_TRANSLATE_DELAY);

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang, mode]);

  const addFavorite = (source: string, trans: string) => {
    if (!source || !trans) return;
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      sourceText: source,
      translatedText: trans,
      sourceLang,
      targetLang
    };
    const updated = [newItem, ...favorites];
    setFavorites(updated);
    localStorage.setItem('favorites', JSON.stringify(updated));
  };

  const removeFavorite = (id: string) => {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('favorites', JSON.stringify(updated));
  };

  const handleSearchTTS = () => {
    if (searchQuery.trim()) {
      generateSpeech(searchQuery, 'en');
    }
  };

  const renderHomeLanding = () => (
    <div className="flex flex-col items-center justify-center h-full animate-slide-up px-2">
      <div className="relative w-full max-w-sm h-64 flex items-center justify-center">
        <div className="absolute top-0 left-0 bg-white dark:bg-brand-dark px-4 py-2 rounded-2xl font-bold shadow-sm animate-bounce-subtle border dark:border-white/20">Hola</div>
        <div className="absolute top-10 right-0 bg-white dark:bg-brand-dark px-4 py-2 rounded-2xl font-bold shadow-sm animate-bounce-subtle border dark:border-white/20" style={{ animationDelay: '0.5s' }}>Hello</div>
        <div className="absolute top-0 right-1/4 bg-white dark:bg-brand-dark px-4 py-2 rounded-2xl font-bold shadow-sm animate-bounce-subtle border dark:border-white/20" style={{ animationDelay: '1s' }}>Ciao</div>
        <div className="flex gap-4 items-end mt-12">
           <div className="w-16 h-16 bg-brand-dark rounded-full border-4 border-white dark:border-white shadow-lg overflow-hidden flex items-center justify-center hover:scale-110 hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <span className="text-white text-3xl select-none" role="img" aria-label="user avatar 1">👨🏽‍🦱</span>
           </div>
           <div className="w-20 h-20 bg-brand-dark rounded-full border-4 border-white dark:border-white shadow-lg overflow-hidden flex items-center justify-center mb-4 hover:scale-110 hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <span className="text-white text-4xl select-none" role="img" aria-label="user avatar 2">👱🏻‍♀️</span>
           </div>
           <div className="w-16 h-16 bg-brand-dark rounded-full border-4 border-white dark:border-white shadow-lg overflow-hidden flex items-center justify-center hover:scale-110 hover:shadow-2xl transition-all duration-300 cursor-pointer">
              <span className="text-white text-3xl select-none" role="img" aria-label="user avatar 3">👨🏻‍🦳</span>
           </div>
        </div>
      </div>
    </div>
  );

  const renderTranslationMode = () => (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <button 
          onClick={() => { setMode(null); setSourceText(''); setTranslatedText(''); setPronunciation(''); setErrorMsg(null); }} 
          className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          aria-label="Return to home screen"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1"></div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="bg-brand-dark dark:bg-brand-screen dark:text-brand-dark text-brand-screen text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">Offline</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 flex-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="flex items-center gap-3 shrink-0">
           <LanguageSelector value={sourceLang} onChange={setSourceLang} label="Translate from language" />
           <button 
            onClick={() => {
              const s = sourceLang; setSourceLang(targetLang); setTargetLang(s);
              const st = sourceText; setSourceText(translatedText); setTranslatedText(st);
            }} 
            className="p-3 bg-white dark:bg-brand-dark rounded-full shadow-md text-brand-dark dark:text-white active:scale-90 transition-transform border dark:border-white/20"
            aria-label="Swap source and target languages"
            title="Swap Languages"
           >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
           </button>
           <LanguageSelector value={targetLang} onChange={setTargetLang} label="Translate to language" excludeAuto />
        </div>

        <div className="flex flex-col gap-4">
           {mode === TranslationMode.TEXT && (
             <>
               <TranslationBox value={sourceText} onChange={setSourceText} placeholder="Enter text here..." langCode={sourceLang} />
               <div className="relative">
                 {errorMsg && (
                   <div className="absolute -top-3 left-6 bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg z-10 animate-slide-up flex items-center gap-2" role="alert" aria-live="assertive">
                     <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                     {errorMsg}
                   </div>
                 )}
                 <TranslationBox 
                    value={translatedText} 
                    pronunciation={pronunciation}
                    readOnly 
                    isStreaming={isTranslating} 
                    placeholder={isOnline ? "Awaiting input..." : "Check your connection..."} 
                    langCode={targetLang} 
                    onFavorite={addFavorite} 
                    originalText={sourceText} 
                 />
               </div>
             </>
           )}
           {mode === TranslationMode.LIVE && <VoiceMode sourceLang={sourceLang} targetLang={targetLang} />}
           {mode === TranslationMode.VISION && <VisionMode targetLang={targetLang} />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative overflow-hidden bg-brand-screen dark:bg-brand-darkBg font-sans shadow-2xl pt-4 px-4 pb-1 transition-colors duration-300">
      <main className="flex-1 relative overflow-hidden flex flex-col px-6 bg-brand-container dark:bg-brand-darkContainer rounded-[3rem] shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-colors duration-300">
        
        {/* Refined Header */}
        <div className="h-20 shrink-0 flex items-center justify-between px-1 pt-4">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-[1.5rem] border border-white/80 dark:border-white/10 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-default group">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] bg-gradient-to-br from-brand-dark via-slate-600 to-brand-dark dark:from-white dark:via-brand-screen dark:to-white bg-clip-text text-transparent">
              LinguaAI
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" aria-hidden="true" />
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-md active:scale-90 transition-all overflow-hidden relative border border-white/80 dark:border-white/20 hover:shadow-lg"
          >
            <div className={`transition-transform duration-500 ${isDarkMode ? '-translate-y-12' : 'translate-y-0'}`}>
              <svg className="w-5 h-5 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z"/></svg>
            </div>
            <div className={`absolute transition-transform duration-500 ${isDarkMode ? 'translate-y-0' : 'translate-y-12'}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-hidden pt-4">
          {activeTab === Tab.HOME && (
            <div className="h-full">
              {!mode ? renderHomeLanding() : renderTranslationMode()}
            </div>
          )}
          
          {activeTab === Tab.SEARCH && (
            <div className="h-full animate-slide-up flex flex-col">
              <h2 className="text-3xl font-extrabold mb-8 shrink-0">Discovery</h2>
              <div className="bg-white dark:bg-brand-dark rounded-3xl p-5 shadow-sm flex items-center gap-3 shrink-0 border dark:border-white/10 group focus-within:ring-2 focus-within:ring-brand-screen/50 transition-all">
                 <svg className="w-5 h-5 text-slate-400 group-focus-within:text-brand-dark dark:group-focus-within:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                 <input 
                    className="bg-transparent border-none outline-none w-full font-bold text-brand-dark dark:text-white placeholder-slate-400/50" 
                    placeholder="Translate world phrases..." 
                    aria-label="Search translations"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
                 {searchQuery.trim() && (
                   <button 
                    onClick={handleSearchTTS}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-brand-dark dark:text-white"
                    aria-label="Hear pronunciation of search term"
                    title="Speak search term"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                   </button>
                 )}
              </div>
              <div className="flex-1 mt-6 text-brand-dark/30 dark:text-white/20 flex flex-col items-center justify-center font-bold text-center px-8">
                 <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                 <p>Dictionary history and suggested phrases will appear here.</p>
              </div>
            </div>
          )}

          {activeTab === Tab.FAVORITES && (
            <div className="h-full animate-slide-up flex flex-col">
              <h2 className="text-3xl font-extrabold mb-8 shrink-0">Saved Cards</h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center px-8">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                    <p className="font-bold">Your library is empty. Star your favorite translations to keep them here.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {favorites.map(item => (
                      <div key={item.id} className="bg-white dark:bg-brand-dark p-6 rounded-3xl shadow-sm relative group animate-slide-up border dark:border-white/5 transition-transform hover:scale-[1.02]">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{item.sourceLang} → {item.targetLang}</span>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 italic">"{item.sourceText}"</p>
                        <p className="text-lg font-bold text-brand-dark dark:text-white">{item.translatedText}</p>
                        <button 
                          onClick={() => removeFavorite(item.id)} 
                          aria-label={`Remove translation for "${item.sourceText}" from favorites`}
                          title="Remove Favorite"
                          className="absolute top-4 right-4 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!mode && activeTab === Tab.HOME && (
          <div className="shrink-0 py-8 flex gap-4 justify-center animate-slide-up">
             <button onClick={() => setMode(TranslationMode.TEXT)} aria-label="Open Text Translation Mode" className="flex flex-col items-center gap-2 flex-1 max-w-[100px] group">
                <div className="w-16 h-16 bg-brand-dark dark:bg-brand-screen text-brand-screen dark:text-brand-dark rounded-[1.75rem] flex items-center justify-center shadow-lg active:scale-95 group-hover:-translate-y-1 transition-all border-2 border-white dark:border-brand-dark">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-white opacity-80 group-hover:opacity-100">Write</span>
             </button>
             <button 
                onClick={() => setMode(TranslationMode.LIVE)} 
                aria-label="Open Voice Conversation Mode"
                className={`flex flex-col items-center gap-2 flex-1 max-w-[100px] group ${!isOnline ? 'opacity-30 cursor-not-allowed' : ''}`} 
                disabled={!isOnline}
             >
                <div className="w-16 h-16 bg-white dark:bg-brand-dark rounded-[1.75rem] flex items-center justify-center shadow-lg active:scale-95 group-hover:-translate-y-1 transition-all border-2 border-white dark:border-white">
                   <svg className="w-8 h-8 text-brand-dark dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-white opacity-80 group-hover:opacity-100">Talk</span>
             </button>
             <button 
                onClick={() => setMode(TranslationMode.VISION)} 
                aria-label="Open Visual Scan Mode"
                className={`flex flex-col items-center gap-2 flex-1 max-w-[100px] group ${!isOnline ? 'opacity-30 cursor-not-allowed' : ''}`} 
                disabled={!isOnline}
             >
                <div className="w-16 h-16 bg-white dark:bg-brand-dark rounded-[1.75rem] flex items-center justify-center shadow-lg active:scale-95 group-hover:-translate-y-1 transition-all border-2 border-white dark:border-white">
                   <svg className="w-8 h-8 text-brand-dark dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2zm16 0l-7 7-7-7"/></svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-dark dark:text-white opacity-80 group-hover:opacity-100">Scan</span>
             </button>
          </div>
        )}

        <div className="shrink-0 mb-6 flex justify-center w-full z-50">
          <nav className="bg-white/90 dark:bg-brand-dark/90 backdrop-blur-md rounded-[2.25rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] h-16 py-1.5 px-2 w-full flex items-center border border-white dark:border-white/10" role="tablist">
            <div className="flex justify-around items-center h-full w-full">
              <button 
                onClick={() => { setActiveTab(Tab.HOME); if(activeTab !== Tab.HOME) setMode(null); }} 
                role="tab"
                aria-selected={activeTab === Tab.HOME}
                aria-label="Home"
                title="Home View"
                className={`relative flex flex-col items-center justify-center w-1/3 h-full rounded-[1.75rem] transition-all duration-300 ${activeTab === Tab.HOME ? 'bg-brand-dark dark:bg-white text-white dark:text-brand-dark shadow-lg scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-white'}`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
                <span className={`text-[7px] font-black uppercase tracking-widest mt-0.5 transition-all duration-300 ${activeTab === Tab.HOME ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>Home</span>
              </button>

              <button 
                onClick={() => setActiveTab(Tab.SEARCH)} 
                role="tab"
                aria-selected={activeTab === Tab.SEARCH}
                aria-label="Explore"
                title="Search and Discover"
                className={`relative flex flex-col items-center justify-center w-1/3 h-full rounded-[1.75rem] transition-all duration-300 ${activeTab === Tab.SEARCH ? 'bg-brand-dark dark:bg-white text-white dark:text-brand-dark shadow-lg scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-white'}`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
                <span className={`text-[7px] font-black uppercase tracking-widest mt-0.5 transition-all duration-300 ${activeTab === Tab.SEARCH ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>Explore</span>
              </button>

              <button 
                onClick={() => setActiveTab(Tab.FAVORITES)} 
                role="tab"
                aria-selected={activeTab === Tab.FAVORITES}
                aria-label="Saved Items"
                title="Favorites and History"
                className={`relative flex flex-col items-center justify-center w-1/3 h-full rounded-[1.75rem] transition-all duration-300 ${activeTab === Tab.FAVORITES ? 'bg-brand-dark dark:bg-white text-white dark:text-brand-dark shadow-lg scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-brand-dark dark:hover:text-white'}`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/></svg>
                <span className={`text-[7px] font-black uppercase tracking-widest mt-0.5 transition-all duration-300 ${activeTab === Tab.FAVORITES ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>Library</span>
              </button>
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
};

export default App;
