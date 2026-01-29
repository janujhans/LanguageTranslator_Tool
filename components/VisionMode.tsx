
import React, { useState, useRef, useEffect } from 'react';
import { translateImage } from '../services/geminiService';

interface VisionModeProps {
  targetLang: string;
}

const VisionMode: React.FC<VisionModeProps> = ({ targetLang }) => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setImage(null);
        setResult('');
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      const base64 = dataUrl.split(',')[1];
      stopCamera();
      processImage(base64);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setIsLoading(true);
    setResult('');
    try {
      const translated = await translateImage(base64, targetLang);
      setResult(translated);
    } catch (err) {
      setResult('Could not detect or translate text. Try a clearer angle.');
    } finally {
      setIsLoading(false);
    }
  };

  // Ensure camera is turned off if component unmounts
  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-10">
      <div className="relative aspect-[4/3] bg-brand-dark rounded-[2.5rem] flex flex-col items-center justify-center overflow-hidden shadow-2xl border-4 border-white/10 group">
        
        {isCameraActive ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Viewfinder Guide Overlay */}
            <div className="absolute inset-0 border-[2px] border-dashed border-white/40 m-12 rounded-3xl pointer-events-none flex items-center justify-center">
               <div className="w-full h-[1px] bg-white/10" />
               <div className="h-full w-[1px] bg-white/10 absolute" />
            </div>
            
            <div className="absolute bottom-8 flex items-center gap-6">
               <button 
                onClick={captureImage}
                aria-label="Capture photo"
                className="w-20 h-20 bg-brand-screen rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(240,206,55,0.4)] active:scale-90 transition-transform border-4 border-white"
               >
                 <div className="w-14 h-14 rounded-full border-2 border-brand-dark flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-brand-dark animate-pulse" />
                 </div>
               </button>
               <button 
                onClick={stopCamera}
                aria-label="Cancel camera"
                className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-black/60 transition-colors"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
          </>
        ) : image ? (
          <>
            <img src={image} className="w-full h-full object-cover animate-in fade-in duration-500" alt="Captured document" />
            <div className="absolute top-4 left-4 right-4 flex justify-between">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="text-[8px] font-black text-white uppercase tracking-widest">Snapshot</span>
              </div>
              <button 
                onClick={() => { setImage(null); setResult(''); }}
                aria-label="Clear image"
                className="p-2 bg-rose-500/80 backdrop-blur-md rounded-full text-white shadow-lg active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-8">
            <button 
              onClick={startCamera}
              className="flex flex-col items-center gap-3 group/btn"
              aria-label="Use camera to scan"
            >
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center group-hover/btn:bg-white/10 group-hover/btn:scale-105 transition-all border border-white/10 shadow-xl">
                 <svg className="w-10 h-10 text-brand-screen" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <span className="font-black text-[10px] text-white/60 group-hover/btn:text-white uppercase tracking-[0.2em] transition-colors">Live Lens</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 group/btn"
              aria-label="Upload from library"
            >
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center group-hover/btn:bg-white/10 group-hover/btn:scale-105 transition-all border border-white/10 shadow-xl">
                 <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <span className="font-black text-[10px] text-white/60 group-hover/btn:text-white uppercase tracking-[0.2em] transition-colors">Library</span>
            </button>
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="bg-white dark:bg-brand-dark rounded-[2.5rem] p-8 shadow-xl min-h-[180px] border-2 border-transparent dark:border-white/5 transition-all relative">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-500 tracking-[0.3em]">Translation Output</h4>
          {result && (
            <button 
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-brand-screen text-[9px] font-black uppercase tracking-widest hover:underline"
            >
              Copy Text
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-4 gap-4">
            <div className="w-10 h-10 border-4 border-brand-screen border-t-brand-dark rounded-full animate-spin shadow-lg shadow-brand-screen/20" />
            <p className="text-[10px] font-black text-brand-dark/40 dark:text-white/40 uppercase tracking-widest animate-pulse">Analyzing document...</p>
          </div>
        ) : result ? (
          <p className="text-xl font-extrabold text-brand-dark dark:text-white leading-tight animate-slide-up bg-brand-gray/30 dark:bg-white/5 p-4 rounded-2xl">
            {result}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center text-center opacity-30 py-4 gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <p className="text-xs font-bold italic">Waiting for scan...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionMode;
