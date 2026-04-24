import React, { useRef, useState, useEffect } from 'react';
import { RawKeyEvent } from '../types';
import { Eye, EyeOff, Keyboard } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onComplete: (events: RawKeyEvent[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isPassword?: boolean;
}

export const KeystrokeInput: React.FC<Props> = ({ 
  value, 
  onChange, 
  onComplete, 
  placeholder = "Введите текст...", 
  disabled = false,
  isPassword = true
}) => {
  const [showPassword, setShowPassword] = useState(!isPassword);
  const eventsRef = useRef<RawKeyEvent[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value === '') {
      eventsRef.current = [];
      if (textareaRef.current) {
        textareaRef.current.scrollTop = 0;
      }
    }
  }, [value]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Игнорируем автоповтор клавиш (когда пользователь зажимает клавишу)
    if (e.repeat) return;
    
    // Игнорируем системные клавиши, которые не влияют на ритм текста напрямую (Shift, Tab и т.д. можно учитывать, но для простоты опустим)
    if (e.key === 'Tab' || e.key === 'Shift') return;

    // Сброс при Backspace для чистоты эксперимента (в ВКР можно обрабатывать и исправления, но это сложнее)
    if (e.key === 'Backspace') {
      // Allow backspace to delete a single character
      eventsRef.current.push({
        code: e.code,
        key: e.key,
        type: 'keydown',
        timestamp: performance.now()
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onComplete(eventsRef.current);
      // Очистка событий после отправки не делается здесь, чтобы родитель мог их забрать
      return;
    }

    eventsRef.current.push({
      code: e.code,
      key: e.key,
      type: 'keydown',
      timestamp: performance.now()
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Enter') return;

    eventsRef.current.push({
      code: e.code,
      key: e.key,
      type: 'keyup',
      timestamp: performance.now()
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (e.target.value === '') {
        eventsRef.current = [];
    }
  };

  return (
    <div className="relative w-full bg-white rounded-lg">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 z-20">
        <Keyboard size={18} />
      </div>

      {/* Ghost Text Overlay */}
      {!isPassword && placeholder && value.length > 0 && placeholder.startsWith(value) && (
        <div className="absolute inset-0 pointer-events-none z-10 flex pl-10 pr-10 pt-3 pb-3">
          <div className="w-full text-base whitespace-pre-wrap break-words">
            <span className="text-transparent">{value}</span>
            <span className="text-gray-300">{placeholder.slice(value.length)}</span>
          </div>
        </div>
      )}

      {isPassword ? (
        <input
          type={showPassword ? "text" : "password"}
          className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none relative z-20 bg-transparent ${
            disabled ? 'bg-gray-100 text-gray-400' : 'text-gray-900 border-gray-300'
          }`}
          placeholder={value ? "" : placeholder}
          value={value}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onChange={handleChange}
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
        />
      ) : (
        <textarea
          ref={textareaRef}
          className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none relative z-20 bg-transparent resize-none min-h-[100px] ${
            disabled ? 'bg-gray-100 text-gray-400' : 'text-gray-900 border-gray-300'
          }`}
          placeholder={value ? "" : placeholder}
          value={value}
          onKeyDown={(e) => handleKeyDown(e as any)}
          onKeyUp={(e) => handleKeyUp(e as any)}
          onChange={(e) => handleChange(e as any)}
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
        />
      )}
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer z-30"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
};
