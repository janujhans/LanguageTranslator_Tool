
import React from 'react';
import { LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  label: string;
  excludeAuto?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange, label, excludeAuto }) => {
  const filteredLanguages = excludeAuto 
    ? LANGUAGES.filter(l => l.code !== 'auto') 
    : LANGUAGES;

  return (
    <div className="relative inline-block w-full group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full bg-brand-dark dark:bg-brand-darkBg text-white rounded-2xl px-5 py-3.5 text-sm font-bold appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-white/20 dark:focus:ring-brand-screen/20 transition-all shadow-lg"
      >
        {filteredLanguages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-brand-dark text-white">
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white opacity-50 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
      </div>
    </div>
  );
};

export default LanguageSelector;
