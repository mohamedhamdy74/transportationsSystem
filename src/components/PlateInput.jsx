import React, { useRef, useState, useEffect } from 'react';

export default function PlateInput({ onChange, value = '' }) {
  // Parse initial value if present (e.g. "1234 أ ب ج")
  const parseInitial = () => {
    const parts = value.split(' ');
    const nums = parts[0] || '';
    const lets = parts.slice(1).join('') || '';
    return {
      digits: [nums[0] || '', nums[1] || '', nums[2] || '', nums[3] || ''],
      letters: [lets[0] || '', lets[1] || '', lets[2] || '']
    };
  };

  const initial = parseInitial();
  const [digits, setDigits] = useState(initial.digits);
  const [letters, setLetters] = useState(initial.letters);

  const digitRefs = [useRef(), useRef(), useRef(), useRef()];
  const letterRefs = [useRef(), useRef(), useRef()];

  // Sync state when external value changes (e.g. form resets)
  useEffect(() => {
    const parsed = parseInitial();
    setDigits(parsed.digits);
    setLetters(parsed.letters);
  }, [value]);

  const updateParent = (newDigits, newLetters) => {
    const numStr = newDigits.filter(Boolean).join('');
    const letStr = newLetters.filter(Boolean).join(' ');
    onChange(numStr && letStr ? `${numStr} ${letStr}` : `${numStr}${letStr}`);
  };

  const handleDigitChange = (index, val) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);
    updateParent(newDigits, letters);

    // Auto-focus next digit
    if (cleaned && index < 3) {
      digitRefs[index + 1].current.focus();
    }
  };

  const handleDigitKeyDown = (index, e) => {
    // Backspace to previous input
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs[index - 1].current.focus();
    }
  };

  const handleLetterChange = (index, val) => {
    // Keep only Arabic characters, no numbers or spaces
    const cleaned = val.replace(/[^\u0600-\u06FF]/g, '').replace(/[\u0660-\u0669]/g, '');
    const newLetters = [...letters];
    newLetters[index] = cleaned;
    setLetters(newLetters);
    updateParent(digits, newLetters);

    // Auto-focus next letter (right to left for Arabic typing)
    if (cleaned && index < 2) {
      letterRefs[index + 1].current.focus();
    }
  };

  const handleLetterKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !letters[index] && index > 0) {
      letterRefs[index - 1].current.focus();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 font-cairo" dir="rtl">
      {/* Plate Design */}
      <div className="w-full max-w-[280px] bg-gray-100 border-4 border-gray-700 rounded-xl overflow-hidden shadow-md select-none">
        {/* Blue Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white text-[10px] font-bold py-1 px-4 flex justify-between items-center border-b-2 border-gray-700">
          <span>مصر</span>
          <span>EGYPT</span>
        </div>
        
        {/* Input Slots */}
        <div className="p-3 bg-white flex justify-between gap-2 items-center">
          {/* Numbers Column (Left side) */}
          <div className="flex gap-1" dir="ltr">
            {digits.map((digit, i) => (
              <input
                key={`digit-${i}`}
                ref={digitRefs[i]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleDigitKeyDown(i, e)}
                placeholder="-"
                className="w-8 h-10 border border-slate-300 rounded-lg text-center text-slate-900 font-bold text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-slate-50"
              />
            ))}
          </div>

          <div className="h-8 w-[2px] bg-slate-300 shrink-0" />

          {/* Letters Column (Right side, RTL) */}
          <div className="flex gap-1" dir="rtl">
            {letters.map((letter, i) => (
              <input
                key={`letter-${i}`}
                ref={letterRefs[i]}
                type="text"
                maxLength={1}
                value={letter}
                onChange={e => handleLetterChange(i, e.target.value)}
                onKeyDown={e => handleLetterKeyDown(i, e)}
                placeholder="-"
                className="w-8 h-10 border border-slate-300 rounded-lg text-center text-slate-900 font-bold text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-slate-50"
              />
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-400">أدخل الأرقام في اليسار والحروف العربية في اليمين</p>
    </div>
  );
}
