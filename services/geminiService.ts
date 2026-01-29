import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { LANGUAGES } from "../constants";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
console.log("ENV KEY:", import.meta.env.VITE_GEMINI_API_KEY);

if (!API_KEY) {
  throw new Error("API Config Error. Please check environment.");
}

const TEXT_MODEL = "gemini-3-flash-preview";
const VISION_MODEL = "gemini-3-flash-preview";
const TTS_MODEL = "gemini-3-flash-preview";
const getLanguageName = (code: string) => {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
};

const OFFLINE_DICT: Record<string, Record<string, string>> = {
  "hello": {
    "es": "Hola|||Oh-lah",
    "fr": "Bonjour|||Bon-zhoor",
    "de": "Guten Tag|||Goo-ten Tahg",
    "it": "Ciao|||Chow",
    "ja": "こんにちは|||Kon-nee-chee-wah",
    "zh": "你好|||Nee how",
    "hi": "नमस्ते|||Namaste"
  },
  "thank you": {
    "es": "Gracias|||Grah-see-ahs",
    "fr": "Merci|||Mair-see",
    "de": "Danke|||Dahn-keh",
    "it": "Grazie|||Graht-zee-eh"
  }
};

const getCachedTranslation = (text: string, target: string): string | null => {
  const cacheKey = `trans_${target}_${text.toLowerCase().trim()}`;
  return localStorage.getItem(cacheKey);
};

const setCachedTranslation = (text: string, target: string, result: string) => {
  const cacheKey = `trans_${target}_${text.toLowerCase().trim()}`;
  localStorage.setItem(cacheKey, result);
};

export const translateTextStream = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  onChunk: (chunk: string) => void
) => {
  const normalizedText = text.toLowerCase().trim();

  const cached =
    getCachedTranslation(normalizedText, targetLang) ||
    OFFLINE_DICT[normalizedText]?.[targetLang];

  if (cached) {
    onChunk(cached);
    return;
  }

  if (!navigator.onLine) {
    throw new Error("Offline: Phrase not in cache");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  const prompt = `Translate precisely from ${sourceName} to ${targetName}.
After the translation, add exactly the delimiter '|||' and then provide a clear English phonetic pronunciation.

Format: [Translated Text]|||[Phonetic Guide]

Text: ${text}`;

  try {
    const response = await ai.models.generateContentStream({
      model: TEXT_MODEL,
      contents: prompt,
      config: { temperature: 0.1 }
    });

    let fullResult = "";
    for await (const chunk of response) {
      const textChunk = chunk.text;
      if (textChunk) {
        fullResult += textChunk;
        onChunk(textChunk);
      }
    }

    if (fullResult) {
      setCachedTranslation(normalizedText, targetLang, fullResult);
    }
  } catch (error: any) {
    console.error("Streaming translation error:", error);
    if (error?.status === 503) {
      throw new Error("AI service is temporarily unavailable. Try again later.");
    }
    throw error;
  }
};

export const generateSpeech = async (text: string, langCode: string) => {
  if (!navigator.onLine) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode === "auto" ? "en" : langCode;
    window.speechSynthesis.speak(utterance);
    return;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [
        { parts: [{ text: `Speak clearly in ${getLanguageName(langCode)}: ${text}` }] }
      ],
      config: {
        responseModalities: [Modality.AUDIO]
      }
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) throw new Error("No audio generated");

    const audioCtx = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ sampleRate: 24000 });

    const bytes = decodeBase64Audio(base64Audio);
    const buffer = await decodeAudioToBuffer(bytes, audioCtx);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (error) {
    console.error("TTS failed:", error);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode === "auto" ? "en" : langCode;
    window.speechSynthesis.speak(utterance);
  }
};

export const translateImage = async (
  base64Image: string,
  targetLang: string
): Promise<string> => {
  if (!navigator.onLine) {
    throw new Error("Vision translation requires internet connection");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const contents = {
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: base64Image } },
      {
        text: `Translate all visible text in this image into ${getLanguageName(
          targetLang
        )}. Only return translation.`
      }
    ]
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: VISION_MODEL,
      contents
    });

    return response.text || "No text detected.";
  } catch (error: any) {
    if (error?.status === 503) {
      throw new Error("Vision AI service unavailable. Try again later.");
    }
    throw error;
  }
};

export const decodeBase64Audio = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeAudioChunk = (data: Float32Array): string => {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export async function decodeAudioToBuffer(
  data: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}
