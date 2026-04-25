import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { KeystrokeInput } from './components/KeystrokeInput';
import { BiometricVisualizer } from './components/BiometricVisualizer';
import { RawKeyEvent, KeystrokeFeatures, VerificationResponse, UserSummary, UserTemplate } from './types';
import { extractFeatures, validateFeatures, verifyContinuous } from './utils/biometrics';
import { ApiService } from './services/apiService';
import { ShieldCheck, ShieldAlert, UserPlus, Activity, Database, ServerCrash, RefreshCw, Sigma, Settings, Trash2, Target, UserX, Percent, BarChart, Lock, Unlock, Shield } from 'lucide-react';

interface TestLog {
  id: string;
  targetUser: string;
  isImpostor: boolean;
  score: number;
  isMatch: boolean;
  timestamp: number;
}

const TEST_PHRASE = "Съешь же ещё этих мягких французских булок, да выпей чаю.";

const CONTINUOUS_TEXTS = [
  "В современном мире информационная безопасность играет ключевую роль. Защита данных от несанкционированного доступа требует применения новых методов, таких как биометрическая аутентификация по клавиатурному почерку.",
  "Клавиатурный почерк является уникальной поведенческой характеристикой человека. Он зависит от физиологических особенностей строения рук и моторики пальцев, что делает его надежным фактором защиты.",
  "Непрерывная аутентификация позволяет системе постоянно проверять личность пользователя в фоновом режиме. Если за компьютер сядет злоумышленник, система мгновенно заблокирует доступ к конфиденциальной информации."
];
const SESSION_ANALYZE_WINDOW = 30;
const SESSION_ANALYZE_STEP = 10;
const SESSION_MIN_DWELL_COUNT = 10;
const SESSION_MIN_FLIGHT_COUNT = 6;
const SESSION_MAX_BUFFER = 220;
const SESSION_KEEP_BUFFER = 120;
const SESSION_POOR_WINDOW_LOCK_STREAK = 5;
const REPEAT_BURST_COUNT = 12;
const REPEAT_BURST_WINDOW_MS = 1200;

export default function App() {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'testing' | 'continuous'>('login');
  const [username, setUsername] = useState('');
  const [inputPhrase, setInputPhrase] = useState('');
  
  // App State
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [useLocalMode, setUseLocalMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [users, setUsers] = useState<UserSummary[]>([]);

  // Registration State
  const [regSamples, setRegSamples] = useState<KeystrokeFeatures[]>([]);
  const [regStep, setRegStep] = useState(0);
  const REQUIRED_SAMPLES = 10;

  // Verification/Vis State
  const [authResult, setAuthResult] = useState<VerificationResponse | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<UserTemplate | any>(null);
  const [lastFeatures, setLastFeatures] = useState<KeystrokeFeatures | undefined>(undefined);
  const [inputError, setInputError] = useState<string | null>(null);

  // Testing State
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [testTarget, setTestTarget] = useState<string>('');
  const [isImpostor, setIsImpostor] = useState<boolean>(false);

  // Continuous Auth State
  const [sessionUser, setSessionUser] = useState<string>('');
  const [sessionTemplate, setSessionTemplate] = useState<UserTemplate | null>(null);
  const [sessionText, setSessionText] = useState<string>('');
  const [targetSessionText, setTargetSessionText] = useState<string>('');
  const [sessionTrust, setSessionTrust] = useState<number>(100);
  const [sessionLocked, setSessionLocked] = useState<boolean>(false);
  const sessionBufferRef = React.useRef<RawKeyEvent[]>([]);
  const poorWindowStreakRef = React.useRef<number>(0);
  const repeatBurstRef = React.useRef<{ key: string; count: number; firstTs: number }>({
    key: '',
    count: 0,
    firstTs: 0,
  });
  const lastSessionBlockedToastAtRef = React.useRef<number>(0);

  const notifySessionBlockedInput = () => {
    const now = Date.now();
    if (now - lastSessionBlockedToastAtRef.current < 1500) return;
    lastSessionBlockedToastAtRef.current = now;
    toast.warning("Вставка отключена: для непрерывной проверки используйте только ручной ввод.");
  };

  useEffect(() => {
    if (sessionUser) {
      ApiService.getTemplate(sessionUser).then(tpl => {
        setSessionTemplate(tpl);
        setSessionTrust(100);
        setSessionLocked(false);
        setSessionText('');
        // Выбираем случайный текст для перепечатывания
        setTargetSessionText(CONTINUOUS_TEXTS[Math.floor(Math.random() * CONTINUOUS_TEXTS.length)]);
        sessionBufferRef.current = [];
        poorWindowStreakRef.current = 0;
        repeatBurstRef.current = { key: '', count: 0, firstTs: 0 };
      }).catch(err => console.error("Failed to load template for session", err));
    } else {
      setSessionTemplate(null);
      setTargetSessionText('');
    }
  }, [sessionUser]);

  const handleSessionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sessionLocked) { e.preventDefault(); return; }
    if (
      ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'x')) ||
      (e.shiftKey && e.key === 'Insert')
    ) {
      e.preventDefault();
      notifySessionBlockedInput();
      return;
    }
    if (e.repeat) {
      const now = performance.now();
      const prev = repeatBurstRef.current;
      if (prev.key === e.code && now - prev.firstTs <= REPEAT_BURST_WINDOW_MS) {
        repeatBurstRef.current = { ...prev, count: prev.count + 1 };
      } else {
        repeatBurstRef.current = { key: e.code, count: 1, firstTs: now };
      }

      if (repeatBurstRef.current.count >= REPEAT_BURST_COUNT) {
        setSessionTrust((trust) => {
          const next = Math.max(0, trust - 35);
          if (next <= 0) setSessionLocked(true);
          return next;
        });
      }
      return;
    }
    repeatBurstRef.current = { key: '', count: 0, firstTs: 0 };
    if (
      e.key === 'Tab' ||
      e.key === 'Shift' ||
      e.key === 'Control' ||
      e.key === 'Alt' ||
      e.key === 'Meta' ||
      e.key === 'CapsLock' ||
      e.key === 'Escape' ||
      e.key.startsWith('Arrow') ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) return;
    const event: RawKeyEvent = { type: 'keydown', key: e.key, code: e.code, timestamp: performance.now() };
    processSessionEvent(event);
  };
  const handleSessionBeforeInput = (e: React.FormEvent<HTMLTextAreaElement> & { nativeEvent: InputEvent }) => {
    const inputType = e.nativeEvent.inputType;
    if (
      inputType === 'insertFromPaste' ||
      inputType === 'insertFromDrop' ||
      inputType === 'insertReplacementText' ||
      inputType === 'historyUndo' ||
      inputType === 'historyRedo'
    ) {
      e.preventDefault();
      notifySessionBlockedInput();
    }
  };


  const handleSessionKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sessionLocked) { e.preventDefault(); return; }
    if (
      e.key === 'Tab' ||
      e.key === 'Shift' ||
      e.key === 'Enter' ||
      e.key === 'Control' ||
      e.key === 'Alt' ||
      e.key === 'Meta' ||
      e.key === 'CapsLock' ||
      e.key === 'Escape' ||
      e.key.startsWith('Arrow') ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) return;
    const event: RawKeyEvent = { type: 'keyup', key: e.key, code: e.code, timestamp: performance.now() };
    processSessionEvent(event);
  };

  const processSessionEvent = (event: RawKeyEvent) => {
    sessionBufferRef.current.push(event);

    // Анализируем чаще и меньшими окнами для более быстрого отклика.
    if (sessionBufferRef.current.length >= SESSION_ANALYZE_WINDOW && sessionTemplate) {
      if (sessionBufferRef.current.length % SESSION_ANALYZE_STEP === 0) {
        const bufferToAnalyze = sessionBufferRef.current.slice(-SESSION_ANALYZE_WINDOW);

        const features = extractFeatures(bufferToAnalyze);
        const dwellCount = Object.keys(features.dwellTimes).length;
        const flightCount = Object.keys(features.flightTimes).length;
        if (dwellCount < SESSION_MIN_DWELL_COUNT || flightCount < SESSION_MIN_FLIGHT_COUNT) {
          poorWindowStreakRef.current += 1;
          const streak = poorWindowStreakRef.current;
          const penalty = Math.min(20, 6 + streak * 2);
          setSessionTrust((prev) => {
            const next = Math.max(0, prev - penalty);
            if (next <= 0 || streak >= SESSION_POOR_WINDOW_LOCK_STREAK) {
              setSessionLocked(true);
              return 0;
            }
            return next;
          });
          return;
        }
        poorWindowStreakRef.current = 0;

        const result = verifyContinuous(features, sessionTemplate);

        // Обновляем доверие всегда, когда есть данные (даже если specificCount = 0, у нас есть globalAnomaly)
        setSessionTrust(prev => {
          // Динамическое изменение доверия на основе anomalyScore
          // Идеальное совпадение: anomalyScore < 0.8
          // Нормальное совпадение: anomalyScore ~ 1.0 - 1.5
          // Подозрительно: anomalyScore > 1.8
          // Аномалия: anomalyScore > 2.0
          
          const threshold = 1.8;
          const diff = threshold - result.anomalyScore;
          
          let newTrust = prev;
          if (diff >= 0) {
            // Если ритм совпадает, повышаем доверие
            // Чем лучше совпадение, тем быстрее растет (макс +5)
            const bonus = Math.min(5, Math.max(1, diff * 5));
            newTrust = Math.min(100, prev + bonus);
          } else {
            // Если ритм не совпадает, штрафуем
            // Чем выше аномалия, тем сильнее штраф
            const penalty = Math.min(100, Math.floor(Math.abs(diff) * 20));
            newTrust = Math.max(0, prev - penalty);
          }
          
          if (newTrust <= 0) {
            setSessionLocked(true);
          }
          return Math.round(newTrust);
        });
      }
      
      // Ограничиваем размер буфера, чтобы не рос бесконечно
      if (sessionBufferRef.current.length > SESSION_MAX_BUFFER) {
        sessionBufferRef.current = sessionBufferRef.current.slice(-SESSION_KEEP_BUFFER);
      }
    }
  };

  const validateUsername = (name: string) => {
    if (!name.trim()) return "Имя пользователя не может быть пустым.";
    if (name.length < 3 || name.length > 20) return "Имя должно содержать от 3 до 20 символов.";
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return "Разрешены только латинские буквы, цифры и подчеркивание.";
    return null;
  };

  const checkServer = async () => {
    // Если мы принудительно в локальном режиме, сервер не пингуем
    if (useLocalMode) {
        setServerOnline(true);
        fetchUsers();
        return;
    }

    const isOnline = await ApiService.healthCheck();
    setServerOnline(isOnline);
    if (isOnline) {
        fetchUsers();
    }
  };

  const fetchUsers = async () => {
    try {
      const list = await ApiService.getUsers();
      setUsers(list);
    } catch (e) {
      console.error(e);
      setUsers([]);
    }
  };

  useEffect(() => {
    // Инициализация: проверяем сервер
    ApiService.setLocalMode(useLocalMode);
    checkServer();

    // Миграция старых шаблонов актуальна только для Local DB (browser storage).
    // В серверном режиме структура шаблона может отличаться, и reload здесь приводит
    // к бесконечному циклу запросов/перезагрузок.
    if (useLocalMode) {
      ApiService.getUsers()
        .then((localUsers) => {
          if (localUsers.length === 0) return;
          return ApiService.getTemplate(localUsers[0].username).then((tpl) => {
            if (tpl && tpl.globalDwellMean === undefined) {
              console.warn("Обнаружены устаревшие шаблоны. Очистка базы данных...");
              ApiService.clearLocalDb();
              window.location.reload();
            }
          });
        })
        .catch(() => {});
    }

    const interval = setInterval(() => {
        if (!useLocalMode) checkServer();
    }, 5000); 
    return () => clearInterval(interval);
  }, [useLocalMode]);

  const toggleMode = () => {
    const newMode = !useLocalMode;
    setUseLocalMode(newMode);
    ApiService.setLocalMode(newMode);
    setUsers([]);
    setAuthResult(null);
    setCurrentTemplate(null);
    // Сразу запускаем проверку для нового режима
    setTimeout(() => checkServer(), 100);
  };

  const handleClearLocalDB = () => {
    if (window.confirm("Вы уверены? Все локальные пользователи будут удалены.")) {
        ApiService.clearLocalDb();
        fetchUsers();
        toast.success("Локальная база данных очищена.");
    }
  };

  // --- Handlers ---

  const handleRegisterInput = async (events: RawKeyEvent[]) => {
    setInputError(null);
    
    const nameError = validateUsername(username);
    if (nameError) {
      setInputError(nameError);
      return;
    }

    if (inputPhrase !== TEST_PHRASE) {
      setInputError(`Ошибка: Фраза должна быть строго: "${TEST_PHRASE}"`);
      setInputPhrase('');
      return;
    }

    const features = extractFeatures(events);
    const validationError = validateFeatures(features, TEST_PHRASE.length, 'registration');
    if (validationError) {
      setInputError(validationError);
      setInputPhrase('');
      return;
    }

    const newSamples = [...regSamples, features];
    setRegSamples(newSamples);
    setRegStep(prev => prev + 1);
    setInputPhrase('');

    if (newSamples.length >= REQUIRED_SAMPLES) {
      setLoading(true);
      try {
        await ApiService.registerUser(username, newSamples);
        const method = useLocalMode ? "GMM (Локально)" : "GMM (Сервер)";
        toast.success(`Профиль успешно создан! Метод: ${method}`);
        setRegSamples([]);
        setRegStep(0);
        setUsername('');
        setActiveTab('login');
        fetchUsers();
      } catch (e: any) {
        toast.error("Ошибка регистрации: " + e.message);
        setRegSamples([]);
        setRegStep(0);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLoginInput = async (events: RawKeyEvent[]) => {
    setInputError(null);
    
    if (!username.trim()) {
        setInputError("Введите имя пользователя");
        return;
    }
    
    if (inputPhrase !== TEST_PHRASE) {
      setInputError(`Ошибка: Фраза должна быть строго: "${TEST_PHRASE}"`);
      setInputPhrase('');
      return;
    }

    const features = extractFeatures(events);
    const validationError = validateFeatures(features, TEST_PHRASE.length, 'auth');
    if (validationError) {
      setInputError(validationError);
      setInputPhrase('');
      return;
    }

    setLoading(true);
    setAuthResult(null);
    
    setLastFeatures(features);

    try {
      const result = await ApiService.verifyUser(username, features);
      setAuthResult(result);

      const tpl = await ApiService.getTemplate(username);
      setCurrentTemplate(tpl);

    } catch (e: any) {
      setAuthResult({
          success: false,
          score: 0,
          threshold: 0,
          details: "Ошибка: " + e.message,
          username: username
      });
    } finally {
      setLoading(false);
    }
  };

  const resetAuth = () => {
    setAuthResult(null);
    setInputPhrase('');
    setLastFeatures(undefined);
    setCurrentTemplate(null);
    setInputError(null);
  };

  const handleTestInput = async (events: RawKeyEvent[]) => {
    setInputError(null);
    if (!testTarget) {
      setInputError("Выберите целевого пользователя для проверки");
      return;
    }
    if (inputPhrase !== TEST_PHRASE) {
      setInputError(`Ошибка: Фраза должна быть строго: "${TEST_PHRASE}"`);
      setInputPhrase('');
      return;
    }
    
    const features = extractFeatures(events);
    const validationError = validateFeatures(features, TEST_PHRASE.length, 'auth');
    if (validationError) {
      setInputError(validationError);
      setInputPhrase('');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.verifyUser(testTarget, features);
      const newLog: TestLog = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        targetUser: testTarget,
        isImpostor,
        score: result.score,
        isMatch: result.success,
        timestamp: Date.now()
      };
      setTestLogs(prev => [newLog, ...prev]);
      setInputPhrase('');
    } catch (e: any) {
      setInputError("Ошибка: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Metrics Calculation
  const genuineAttempts = testLogs.filter(log => !log.isImpostor);
  const impostorAttempts = testLogs.filter(log => log.isImpostor);
  
  const falseRejections = genuineAttempts.filter(log => !log.isMatch).length;
  const falseAcceptances = impostorAttempts.filter(log => log.isMatch).length;
  
  const frr = genuineAttempts.length > 0 ? (falseRejections / genuineAttempts.length) * 100 : 0;
  const far = impostorAttempts.length > 0 ? (falseAcceptances / impostorAttempts.length) * 100 : 0;
  const totalAttempts = testLogs.length;
  const accuracy = totalAttempts > 0 
    ? ((genuineAttempts.length - falseRejections + impostorAttempts.length - falseAcceptances) / totalAttempts) * 100 
    : 0;

  const tp = genuineAttempts.length - falseRejections;
  const fp = falseAcceptances;
  const fn = falseRejections;
  
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Экран "Сервер недоступен" показываем только если мы НЕ в локальном режиме и сервер лежит
  if (!serverOnline && !useLocalMode) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-parchment-50 text-slate-700 p-4">
              <ServerCrash size={64} className="text-burgundy-600 mb-4" />
              <h1 className="font-serif text-2xl font-bold text-slate-900 mb-2">Сервер недоступен</h1>
              <p className="text-center max-w-md mb-6">
                  Серверная часть (Python&nbsp;+ PostgreSQL) не&nbsp;отвечает.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <button onClick={checkServer} className="flex items-center gap-2 px-5 py-2 bg-academy-700 text-white rounded-sm hover:bg-academy-800 transition">
                    <RefreshCw size={18} /> Повторить попытку
                </button>
                <button onClick={toggleMode} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-300 text-slate-800 rounded-sm hover:bg-slate-50 transition">
                    <Database size={18} /> Переключить на локальный режим
                </button>
              </div>

              <div className="mt-8 bg-white p-4 rounded-sm border border-slate-300 shadow-sm text-xs font-mono text-left w-full max-w-lg">
                  <p className="text-slate-600">Для запуска сервера:</p>
                  <p className="bg-slate-100 p-1.5 rounded-sm mt-1 text-slate-900">uvicorn main:app --reload</p>
              </div>
          </div>
      );
  }

  const tabs: { id: typeof activeTab; numeral: string; label: string }[] = [
    { id: 'login',      numeral: 'I',   label: 'Верификация личности' },
    { id: 'register',   numeral: 'II',  label: 'Регистрация эталона' },
    { id: 'testing',    numeral: 'III', label: 'Оценка FAR / FRR' },
    { id: 'continuous', numeral: 'IV',  label: 'Непрерывная защита' },
  ];

  return (
    <div className="min-h-screen bg-parchment-50 text-slate-900 flex flex-col">
      <Toaster position="top-center" richColors />

      {/* Academic title block */}
      <header className="bg-white border-b-2 border-academy-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <div className="leading-relaxed">
              <div>Министерство науки и высшего образования</div>
              <div>Кафедра информационной безопасности</div>
            </div>
            <div className="text-right leading-relaxed hidden sm:block">
              <div>Выпускная квалификационная работа</div>
              <div>Прототип программного комплекса</div>
            </div>
          </div>

          <div className="vkr-rule my-4" />

          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-academy-700 font-semibold mb-2">
              Тема исследования
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 leading-snug max-w-3xl">
              Биометрическая аутентификация пользователя
              <br className="hidden sm:block" />
              на&nbsp;основе клавиатурного почерка
            </h1>
            <p className="font-serif italic text-slate-600 mt-3 text-sm sm:text-base">
              Разработка и&nbsp;экспериментальное исследование программного прототипа
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-xs text-slate-700">
            <div className="border border-slate-300 bg-white px-3 py-2 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Автор работы</div>
              <div className="font-serif text-sm text-slate-900">________________________</div>
            </div>
            <div className="border border-slate-300 bg-white px-3 py-2 rounded-sm">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Научный руководитель</div>
              <div className="font-serif text-sm text-slate-900">________________________</div>
            </div>
            <div className="border border-slate-300 bg-white px-3 py-2 rounded-sm flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Режим работы</div>
                <div className="font-serif text-sm text-slate-900">
                  {useLocalMode ? 'Локальный (браузер)' : 'Серверный (PostgreSQL + GMM)'}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => { if (useLocalMode) toggleMode(); }}
                  className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm border transition-colors ${
                    !useLocalMode ? 'bg-academy-700 text-white border-academy-700' : 'bg-white text-slate-500 border-slate-300 hover:border-academy-700'
                  }`}
                >
                  Сервер
                </button>
                <button
                  onClick={() => { if (!useLocalMode) toggleMode(); }}
                  className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm border transition-colors ${
                    useLocalMode ? 'bg-burgundy-600 text-white border-burgundy-600' : 'bg-white text-slate-500 border-slate-300 hover:border-burgundy-600'
                  }`}
                >
                  Локально
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section navigation */}
        <nav className="bg-academy-800 border-t border-academy-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap gap-x-1 gap-y-0 overflow-x-auto hide-scrollbar">
            {tabs.map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-parchment-100 text-white bg-academy-900/40'
                      : 'border-transparent text-academy-100 hover:text-white hover:border-academy-200'
                  }`}
                >
                  <span className="font-serif text-academy-200 mr-2">{t.numeral}.</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex-1">
        {(() => {
          const cur = tabs.find(t => t.id === activeTab);
          if (!cur) return null;
          return (
            <div className="mb-8">
              <div className="text-[11px] uppercase tracking-[0.22em] text-academy-700 font-semibold">
                Раздел {cur.numeral}
              </div>
              <h2 className="font-serif text-2xl sm:text-[26px] font-bold text-slate-900 mt-1">
                {cur.label}
              </h2>
              <div className="vkr-rule mt-3" />
            </div>
          );
        })()}

        {/* VIEW: LOGIN */}
        {activeTab === 'login' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 vkr-card">
                <h3 className="font-serif text-lg font-bold mb-6 text-slate-900">1.1.&nbsp;Контрольный ввод фразы</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Пользователь</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-academy-500 outline-none"
                      placeholder="Имя пользователя"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Контрольная фраза</label>
                    <KeystrokeInput 
                      value={inputPhrase}
                      onChange={setInputPhrase}
                      onComplete={handleLoginInput}
                      placeholder={TEST_PHRASE}
                      disabled={loading}
                      isPassword={false}
                    />
                  </div>
                </div>

                {inputError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{inputError}</span>
                  </div>
                )}

                {loading && <div className="mt-4 text-center text-sm text-gray-500 animate-pulse">Обработка данных...</div>}

                {authResult && !loading && (
                  <div className={`mt-6 p-4 rounded-xl border ${authResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      {authResult.success ? <ShieldCheck className="text-green-600" /> : <ShieldAlert className="text-red-600" />}
                      <div>
                        <h4 className={`font-bold ${authResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {authResult.success ? 'Доступ разрешен' : 'Отказ'}
                        </h4>
                        <p className={`text-xs mt-1 ${authResult.success ? 'text-green-700' : 'text-red-700'}`}>
                          {authResult.details}
                        </p>
                        <div className="mt-2 text-[10px] font-mono opacity-80 uppercase tracking-wide">
                            Метод: {authResult.method || (useLocalMode ? 'GMM (Local)' : 'GMM (Server)')}
                        </div>
                      </div>
                    </div>
                    <button onClick={resetAuth} className="w-full mt-4 py-1.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-white transition">
                        Сбросить
                    </button>
                  </div>
                )}
              </div>
              
              <div className={`p-6 rounded-md border ${useLocalMode ? 'bg-orange-50 border-orange-100' : 'bg-academy-50 border-academy-100'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className={`font-semibold text-sm flex items-center gap-2 ${useLocalMode ? 'text-orange-900' : 'text-academy-900'}`}>
                        <Database size={16} /> 
                        {useLocalMode ? 'Локальное хранилище (Браузер)' : 'PostgreSQL (Сервер)'}
                    </h4>
                    {useLocalMode && users.length > 0 && (
                        <button onClick={handleClearLocalDB} className="text-red-500 hover:text-red-700 p-1" title="Очистить БД">
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
                
                <div className="mb-3 text-xs font-medium text-gray-500">
                    Зарегистрировано пользователей: {users.length}
                </div>
                
                {users.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">База данных пуста.</p>
                ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {users.map(u => (
                            <li key={u.id} className="text-sm flex justify-between bg-white px-3 py-2 rounded-md shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => setUsername(u.username)}>
                                <span className="font-medium truncate max-w-[120px]">{u.username}</span>
                                <span className="text-gray-400 text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</span>
                            </li>
                        ))}
                    </ul>
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
               {currentTemplate ? (
                 <div className="space-y-6">
                   <BiometricVisualizer template={currentTemplate} currentAttempt={lastFeatures} />
                   {authResult && (
                     <div className="bg-white p-6 vkr-card">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="text-academy-500" size={20} />
                          <h3 className="text-lg font-bold text-gray-800">Метрики верификации (для ВКР)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                             <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Оценка (Log-Likelihood)</div>
                             <div className={`text-3xl font-black tracking-tighter ${authResult.score > authResult.threshold ? 'text-emerald-500' : 'text-rose-500'}`}>
                               {authResult.score.toFixed(2)}
                             </div>
                           </div>
                           <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                             <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Порог отсечения</div>
                             <div className="text-3xl font-black tracking-tighter text-gray-700">
                               {authResult.threshold.toFixed(2)}
                             </div>
                           </div>
                           <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                             <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Запас уверенности</div>
                             <div className="text-3xl font-black tracking-tighter text-blue-500">
                               {Math.abs(authResult.score - authResult.threshold).toFixed(2)}
                             </div>
                           </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-4 leading-relaxed">
                          * <strong>Оценка (Score)</strong> показывает логарифмическое правдоподобие (Log-Likelihood) того, что текущий ввод принадлежит владельцу шаблона. Чем значение выше (ближе к нулю), тем выше вероятность совпадения. Если оценка выше порога отсечения, доступ разрешается.
                        </p>
                     </div>
                   )}
                 </div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-md border border-dashed border-slate-300 p-8 text-center text-gray-400">
                    <Activity size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">Нет данных для визуализации</p>
                    <p className="text-sm mt-2 max-w-sm mx-auto">Введите имя пользователя и фразу, чтобы увидеть сравнение текущего почерка с эталоном.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: REGISTER */}
        {activeTab === 'register' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-md border border-slate-300 shadow-sm">
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${useLocalMode ? 'bg-orange-100 text-orange-600' : 'bg-academy-100 text-academy-700'}`}>
                  <UserPlus size={32} />
                </div>
                <h3 className="font-serif text-xl font-bold text-slate-900">
                    {useLocalMode ? '2.1. Создание локального профиля' : '2.1. Сбор эталонных образцов'}
                </h3>
                <p className="text-gray-500 mt-2 text-sm">
                    {useLocalMode 
                        ? 'Статистический метод. Данные останутся в этом браузере.' 
                        : 'Данные сохранятся в PostgreSQL.'}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-academy-500"
                    placeholder="ivan_petrov"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={regStep > 0}
                  />
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="flex justify-between text-sm font-medium text-gray-500 mb-2">
                    <span>Сбор образцов</span>
                    <div className="flex items-center gap-4">
                      {regStep > 0 && (
                        <button 
                          onClick={() => {
                            setRegStep(0);
                            setRegSamples([]);
                            setInputPhrase('');
                            setInputError(null);
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          Сбросить прогресс
                        </button>
                      )}
                      <span>{regStep} / {REQUIRED_SAMPLES}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${useLocalMode ? 'bg-orange-500' : 'bg-academy-700'}`} 
                      style={{ width: `${(regStep / REQUIRED_SAMPLES) * 100}%` }}
                    ></div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Контрольная фраза</label>
                    <KeystrokeInput 
                      value={inputPhrase}
                      onChange={setInputPhrase}
                      onComplete={handleRegisterInput}
                      placeholder={TEST_PHRASE}
                      isPassword={false}
                      disabled={!username || loading}
                    />
                  </div>
                  
                  {inputError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                      <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                      <span>{inputError}</span>
                    </div>
                  )}

                  {loading && <p className="text-center text-sm text-gray-500 mt-2">Сохранение профиля...</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: TESTING (FAR/FRR) */}
        {activeTab === 'testing' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 vkr-card">
                <h3 className="font-serif text-lg font-bold mb-6 flex items-center gap-2 text-slate-900">
                  <Target className="text-academy-700" size={20} />
                  3.1. Сценарий проведения испытаний
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Целевой профиль (Кого проверяем)</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-academy-500 outline-none bg-white"
                      value={testTarget}
                      onChange={(e) => setTestTarget(e.target.value)}
                    >
                      <option value="">-- Выберите пользователя --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.username}>{u.username}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Кто сейчас печатает?</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsImpostor(false)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${!isImpostor ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        Я владелец профиля
                      </button>
                      <button 
                        onClick={() => setIsImpostor(true)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${isImpostor ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        Я взломщик (Impostor)
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Контрольная фраза</label>
                    <KeystrokeInput 
                      value={inputPhrase}
                      onChange={setInputPhrase}
                      onComplete={handleTestInput}
                      placeholder={TEST_PHRASE}
                      disabled={loading || !testTarget}
                      isPassword={false}
                    />
                  </div>
                </div>

                {inputError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{inputError}</span>
                  </div>
                )}
                {loading && <div className="mt-4 text-center text-sm text-gray-500 animate-pulse">Обработка данных...</div>}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 vkr-card">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-gray-500">FAR (False Acceptance Rate)</h3>
                    <UserX className="text-red-400" size={20} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{far.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Пропущено взломщиков: {falseAcceptances} из {impostorAttempts.length}
                  </p>
                </div>

                <div className="bg-white p-5 vkr-card">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-gray-500">FRR (False Rejection Rate)</h3>
                    <ShieldAlert className="text-orange-400" size={20} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{frr.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Отклонено владельцев: {falseRejections} из {genuineAttempts.length}
                  </p>
                </div>

                <div className="bg-white p-5 vkr-card col-span-2">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Общая точность (Accuracy)</h3>
                    <Percent className="text-academy-400" size={20} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{accuracy.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Всего попыток: {totalAttempts}
                  </p>
                </div>

                <div className="bg-white p-5 vkr-card col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Дополнительные метрики качества (ML)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Precision (Точность)</div>
                      <div className="text-2xl font-bold text-gray-800">{precision.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Recall (Полнота)</div>
                      <div className="text-2xl font-bold text-gray-800">{recall.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">F1-Score (F1-мера)</div>
                      <div className="text-2xl font-bold text-blue-600">{f1Score.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 vkr-card">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart size={16} /> История попыток
                </h3>
                {testLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">Нет данных. Сделайте несколько попыток ввода.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                    {testLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 text-sm">
                        <div className="flex items-center gap-3">
                          {log.isMatch ? (
                            <ShieldCheck size={18} className="text-green-500" />
                          ) : (
                            <ShieldAlert size={18} className="text-red-500" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{log.targetUser}</p>
                            <p className="text-xs text-gray-500">
                              {log.isImpostor ? 'Атака (Impostor)' : 'Владелец (Genuine)'} • Score: {log.score.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.isMatch 
                              ? (log.isImpostor ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                              : (log.isImpostor ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')
                          }`}>
                            {log.isMatch ? 'Доступ открыт' : 'Отказ'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CONTINUOUS AUTH */}
        {activeTab === 'continuous' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-md border border-slate-300 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-slate-900">
                    <Shield className="text-academy-700" size={22} />
                    4.1. Сессионная проверка пользователя
                  </h3>
                  <p className="text-gray-500 mt-1 text-sm">
                    Анализ почерка в фоновом режиме при наборе свободного текста.
                  </p>
                </div>
                
                <div className="w-64">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Пользователь сессии</label>
                  <select 
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-academy-500 outline-none bg-white text-sm"
                    value={sessionUser}
                    onChange={(e) => setSessionUser(e.target.value)}
                  >
                    <option value="">-- Выберите --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.username}>{u.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!sessionUser ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Lock className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-gray-500 font-medium">Выберите пользователя для начала защищенной сессии</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Trust Level Indicator */}
                  <div className="bg-white p-6 rounded-md border border-slate-300 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-30"></div>
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Уровень доверия (Trust Score)</h3>
                        <p className="text-xs text-gray-400 mt-1">Анализ каждые ~20 символов</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-3xl font-black tracking-tighter ${sessionTrust > 50 ? 'text-emerald-500' : sessionTrust > 20 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {sessionTrust}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                      <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${
                          sessionTrust > 50 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 
                          sessionTrust > 20 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 
                          'bg-gradient-to-r from-rose-400 to-rose-500'
                        }`} 
                        style={{ width: `${sessionTrust}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Text Area */}
                  <div className="relative">
                    {targetSessionText && (
                      <div className="mb-4 p-4 bg-academy-50 rounded-xl border border-academy-100 text-academy-900 text-sm leading-relaxed shadow-inner">
                        <p className="font-bold mb-2 text-academy-800 flex items-center gap-2">
                          <Activity size={16} />
                          Перепечатайте следующий текст:
                        </p>
                        <p className="select-none">{targetSessionText}</p>
                      </div>
                    )}

                    {sessionLocked && (
                      <div className="absolute inset-0 z-10 bg-red-50/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border-2 border-red-500">
                        <ShieldAlert className="text-red-600 mb-3" size={48} />
                        <h3 className="text-xl font-bold text-red-800 mb-1">СЕССИЯ ЗАБЛОКИРОВАНА</h3>
                        <p className="text-red-600 text-sm font-medium mb-4">Обнаружен аномальный клавиатурный почерк.</p>
                        <button 
                          onClick={() => {
                            setSessionTrust(100);
                            setSessionLocked(false);
                            setSessionText('');
                            sessionBufferRef.current = [];
                            poorWindowStreakRef.current = 0;
                            repeatBurstRef.current = { key: '', count: 0, firstTs: 0 };
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm flex items-center gap-2"
                        >
                          <Unlock size={16} /> Разблокировать (Сброс)
                        </button>
                      </div>
                    )}
                    <textarea
                      className={`w-full h-64 p-4 border-2 rounded-xl outline-none resize-none transition-colors ${
                        sessionLocked ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-academy-500'
                      }`}
                      placeholder="Начните печатать любой текст здесь (например, перепишите абзац из книги или напишите письмо)..."
                      value={sessionText}
                      onChange={(e) => setSessionText(e.target.value)}
                      onKeyDown={handleSessionKeyDown}
                      onKeyUp={handleSessionKeyUp}
                      onPaste={(e) => {
                        e.preventDefault();
                        notifySessionBlockedInput();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        notifySessionBlockedInput();
                      }}
                      onBeforeInput={handleSessionBeforeInput}
                      disabled={sessionLocked}
                      spellCheck="false"
                    ></textarea>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t-2 border-academy-700 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <div className="font-serif font-bold text-slate-900 mb-1">О работе</div>
            <p className="leading-relaxed">
              Прототип системы непрерывной биометрической аутентификации
              на&nbsp;основе клавиатурного почерка (keystroke dynamics). Метод&nbsp;— смесь гауссовых распределений (GMM).
            </p>
          </div>
          <div>
            <div className="font-serif font-bold text-slate-900 mb-1">Программный стек</div>
            <ul className="leading-relaxed space-y-0.5">
              <li>Frontend: React&nbsp;19 + TypeScript&nbsp;+ Vite</li>
              <li>Backend: FastAPI + PostgreSQL</li>
              <li>Модель: scikit‑learn (GaussianMixture)</li>
            </ul>
          </div>
          <div className="sm:text-right">
            <div className="font-serif font-bold text-slate-900 mb-1">Год защиты</div>
            <div>{new Date().getFullYear()}</div>
            <div className="mt-2 italic">
              «Клавиатурный почерк&nbsp;— уникальная поведенческая характеристика пользователя»
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-3 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
          Выпускная квалификационная работа · Прототип программного комплекса
        </div>
      </footer>
    </div>
  );
}