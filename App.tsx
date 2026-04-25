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
      }).catch(err => console.error("Failed to load template for session", err));
    } else {
      setSessionTemplate(null);
      setTargetSessionText('');
    }
  }, [sessionUser]);

  const handleSessionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sessionLocked) { e.preventDefault(); return; }
    if (e.repeat) return; // Игнорируем автоповтор
    if (e.key === 'Tab' || e.key === 'Shift') return; // Игнорируем системные клавиши
    const event: RawKeyEvent = { type: 'keydown', key: e.key, code: e.code, timestamp: performance.now() };
    processSessionEvent(event);
  };

  const handleSessionKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sessionLocked) { e.preventDefault(); return; }
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Enter') return;
    const event: RawKeyEvent = { type: 'keyup', key: e.key, code: e.code, timestamp: performance.now() };
    processSessionEvent(event);
  };

  const processSessionEvent = (event: RawKeyEvent) => {
    sessionBufferRef.current.push(event);

    // Анализируем каждые 20 событий (около 10 нажатий клавиш), используя скользящее окно из последних 40 событий
    if (sessionBufferRef.current.length >= 40 && sessionTemplate) {
      if (sessionBufferRef.current.length % 20 === 0) {
        // Берем последние 40 событий для анализа
        const bufferToAnalyze = sessionBufferRef.current.slice(-40);

        const features = extractFeatures(bufferToAnalyze);
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
      if (sessionBufferRef.current.length > 200) {
        sessionBufferRef.current = sessionBufferRef.current.slice(-100);
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

    // Очистка старых шаблонов, если они не содержат глобальных признаков
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
    const validationError = validateFeatures(features, TEST_PHRASE.length);
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
        const method = useLocalMode ? "GMM (Локально)" : "GMM AI (Сервер)";
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
    const validationError = validateFeatures(features, TEST_PHRASE.length);
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
    const validationError = validateFeatures(features, TEST_PHRASE.length);
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
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-600 p-4">
              <ServerCrash size={64} className="text-red-400 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Сервер недоступен</h1>
              <p className="text-center max-w-md mb-6">
                  Бэкенд (Python + PostgreSQL) не отвечает.
              </p>
              
              <div className="flex gap-4">
                <button onClick={checkServer} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    <RefreshCw size={18} /> Повторить попытку
                </button>
                <button onClick={toggleMode} className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
                    <Database size={18} /> Переключить на Local DB
                </button>
              </div>
              
              <div className="mt-8 bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-xs font-mono text-left w-full max-w-lg opacity-70">
                  <p>Для запуска сервера:</p>
                  <p className="bg-gray-100 p-1 rounded mt-1">uvicorn main:app --reload</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      <Toaster position="top-center" richColors />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${useLocalMode ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                <Sigma size={20} />
              </div>
              <h1 className="text-xl font-bold flex items-center flex-wrap sm:flex-nowrap gap-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">BioAuth</span>
                <span className={`text-[10px] sm:text-xs font-medium text-white px-2 py-0.5 rounded-full whitespace-nowrap ${useLocalMode ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                  {useLocalMode ? 'ЛОКАЛЬНЫЙ РЕЖИМ' : 'СЕРВЕРНЫЙ РЕЖИМ'}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-start md:justify-end overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
             {/* Toggle Mode */}
             <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
                <button 
                    onClick={() => { if(useLocalMode) toggleMode(); }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!useLocalMode ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}
                >
                    Сервер (AI)
                </button>
                <button 
                    onClick={() => { if(!useLocalMode) toggleMode(); }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${useLocalMode ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500'}`}
                >
                    Локально (GMM)
                </button>
             </div>

            <nav className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
                <button
                onClick={() => setActiveTab('login')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                >
                Вход
                </button>
                <button
                onClick={() => setActiveTab('register')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                >
                Регистрация
                </button>
                <button
                onClick={() => setActiveTab('testing')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'testing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                >
                Тестирование (FAR/FRR)
                </button>
                <button
                onClick={() => setActiveTab('continuous')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'continuous' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                >
                Непрерывная защита
                </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* VIEW: LOGIN */}
        {activeTab === 'login' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6">Вход в систему</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Пользователь</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="username"
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
              
              <div className={`p-6 rounded-2xl border ${useLocalMode ? 'bg-orange-50 border-orange-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className={`font-semibold text-sm flex items-center gap-2 ${useLocalMode ? 'text-orange-900' : 'text-indigo-900'}`}>
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
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="text-indigo-500" size={20} />
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
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
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
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${useLocalMode ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <UserPlus size={32} />
                </div>
                <h2 className="text-2xl font-bold">
                    {useLocalMode ? 'Создание локального профиля' : 'Обучение нейросети (GMM)'}
                </h2>
                <p className="text-gray-500 mt-2 text-sm">
                    {useLocalMode 
                        ? 'Статистический метод. Данные останутся в этом браузере.' 
                        : 'Продвинутый AI метод. Данные сохранятся в PostgreSQL.'}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
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
                      className={`h-2 rounded-full transition-all duration-500 ${useLocalMode ? 'bg-orange-500' : 'bg-indigo-600'}`} 
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
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Target className="text-indigo-600" />
                  Симуляция атак
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Целевой профиль (Кого проверяем)</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
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
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
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

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
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

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 col-span-2">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-gray-500">Общая точность (Accuracy)</h3>
                    <Percent className="text-indigo-400" size={20} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{accuracy.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Всего попыток: {totalAttempts}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 col-span-2">
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

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="text-indigo-600" />
                    Непрерывная аутентификация
                  </h2>
                  <p className="text-gray-500 mt-1 text-sm">
                    Анализ почерка в фоновом режиме при наборе свободного текста.
                  </p>
                </div>
                
                <div className="w-64">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Пользователь сессии</label>
                  <select 
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
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
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
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
                      <div className="mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-900 text-sm leading-relaxed shadow-inner">
                        <p className="font-bold mb-2 text-indigo-800 flex items-center gap-2">
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
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm flex items-center gap-2"
                        >
                          <Unlock size={16} /> Разблокировать (Сброс)
                        </button>
                      </div>
                    )}
                    <textarea
                      className={`w-full h-64 p-4 border-2 rounded-xl outline-none resize-none transition-colors ${
                        sessionLocked ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-500'
                      }`}
                      placeholder="Начните печатать любой текст здесь (например, перепишите абзац из книги или напишите письмо)..."
                      value={sessionText}
                      onChange={(e) => setSessionText(e.target.value)}
                      onKeyDown={handleSessionKeyDown}
                      onKeyUp={handleSessionKeyUp}
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
    </div>
  );
}