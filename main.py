from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from datetime import datetime
import uuid
import numpy as np
from sklearn.mixture import GaussianMixture

# ==========================================
# Настройка подключения к PostgreSQL
# Замените 'postgres', 'password', 'localhost' и 'bioauth' на ваши данные
# ==========================================
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password@localhost:5432/bioauth"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==========================================
# Модели базы данных (SQLAlchemy)
# ==========================================
class UserDB(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True)
    template_data = Column(JSON) # Храним весь шаблон пользователя
    created_at = Column(DateTime, default=datetime.utcnow)

# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

# ==========================================
# Инициализация FastAPI
# ==========================================
app = FastAPI(title="BioAuth Keystroke API")

# Настройка CORS для работы с React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Зависимость для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# Pydantic схемы для API
# ==========================================
class KeystrokeFeatures(BaseModel):
    totalDuration: float
    dwellTimes: Dict[str, float]
    flightTimes: Dict[str, float]
    globalDwells: Optional[List[float]] = None
    globalFlights: Optional[List[float]] = None

class RegisterRequest(BaseModel):
    username: str
    samples: List[KeystrokeFeatures]

class VerifyRequest(BaseModel):
    username: str
    sample: KeystrokeFeatures

# ==========================================
# Вспомогательные функции (GMM)
# ==========================================
def extract_feature_vector(sample: KeystrokeFeatures, dwell_keys: List[str], flight_keys: List[str]) -> np.ndarray:
    """Преобразует образец в плоский numpy вектор"""
    vec = []
    for k in dwell_keys:
        vec.append(sample.dwellTimes.get(k, 0.0))
    for k in flight_keys:
        vec.append(sample.flightTimes.get(k, 0.0))
    return np.array(vec)

def create_template(samples: List[KeystrokeFeatures]) -> dict:
    """Создает биометрический шаблон на основе GMM"""
    # Собираем данные для визуализатора (как в старой версии, чтобы UI не ломался)
    dwells_map = {}
    flights_map = {}
    
    for sample in samples:
        for k, v in sample.dwellTimes.items():
            if k not in dwells_map: dwells_map[k] = []
            dwells_map[k].append(v)
            
        for k, v in sample.flightTimes.items():
            if k not in flights_map: flights_map[k] = []
            flights_map[k].append(v)
            
    means = {"dwell": {}, "flight": {}}
    deviations = {"dwell": {}, "flight": {}}
    
    for k, vals in dwells_map.items():
        means["dwell"][k] = float(np.mean(vals))
        deviations["dwell"][k] = float(np.std(vals)) if len(vals) > 1 else 0.001
        
    for k, vals in flights_map.items():
        means["flight"][k] = float(np.mean(vals))
        deviations["flight"][k] = float(np.std(vals)) if len(vals) > 1 else 0.001

    # Подготавливаем векторы для GMM
    dwell_keys = sorted(list(dwells_map.keys()))
    flight_keys = sorted(list(flights_map.keys()))
    
    X = []
    for s in samples:
        X.append(extract_feature_vector(s, dwell_keys, flight_keys))
    X = np.array(X)
    
    # Инициализация GMM. Если образцов много (>=10), выделяем 2 состояния (например, бодрый/уставший)
    n_components = 2 if len(X) >= 10 else 1
    
    # reg_covar используется для предотвращения сингулярности ковариационной матрицы на малых выборках
    gmm = GaussianMixture(n_components=n_components, covariance_type='diag', reg_covar=5.0, random_state=42)
    gmm.fit(X)
    
    # Вычисляем базовую оценку логарифмического правдоподобия (Log-Likelihood) на обучающих данных
    scores = gmm.score_samples(X)
    baseline_ll = float(np.mean(scores))
    std_ll = float(np.std(scores))
    
    # Порог отсечения: базовая оценка минус 3 отклонения, минус запас ( margin ) 10%
    threshold = baseline_ll - max(3.0 * std_ll, abs(baseline_ll) * 0.1)
    
    return {
        "phrase": "test_phrase",
        "sampleCount": len(samples),
        "method": "GMM",
        "means": means,
        "deviations": deviations,
        "variances": {
            "dwell": {k: v**2 for k, v in deviations["dwell"].items()},
            "flight": {k: v**2 for k, v in deviations["flight"].items()}
        },
        "dwell_keys": dwell_keys,
        "flight_keys": flight_keys,
        "threshold": threshold,
        "baseline_ll": baseline_ll,
        "std_ll": std_ll
    }

def calculate_score(sample: KeystrokeFeatures, template: dict, recent_samples: List[dict] = None) -> float:
    """Вычисляет оценку GMM (Log-Likelihood) для нового образца"""
    dwell_keys = template.get("dwell_keys", [])
    flight_keys = template.get("flight_keys", [])
    
    y = extract_feature_vector(sample, dwell_keys, flight_keys).reshape(1, -1)
    
    # Чтобы не сериализовать объекты GMM в БД (что опасно и неудобно для JSON), 
    # мы мгновенно переобучаем легковесную GMM на пуле recent_samples
    if not recent_samples:
        return -9999.0 # Если нет истории, отказ
        
    X = []
    for s_dict in recent_samples:
        vec = []
        for k in dwell_keys:
            vec.append(s_dict.get("dwellTimes", {}).get(k, 0.0))
        for k in flight_keys:
            vec.append(s_dict.get("flightTimes", {}).get(k, 0.0))
        X.append(vec)
    X = np.array(X)
    
    n_components = 2 if len(X) >= 10 else 1
    gmm = GaussianMixture(n_components=n_components, covariance_type='diag', reg_covar=5.0, random_state=42)
    gmm.fit(X)
    
    # Возвращаем Log-Likelihood
    return float(gmm.score_samples(y)[0])

# ==========================================
# API Эндпоинты
# ==========================================
@app.get("/health")
def health_check():
    return {"status": "ok", "database": "postgresql"}

@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(UserDB).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "created_at": u.created_at.isoformat()
        } for u in users
    ]

@app.post("/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(UserDB).filter(UserDB.username == req.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    
    if len(req.samples) < 3:
        raise HTTPException(status_code=400, detail="Недостаточно образцов для регистрации (минимум 3)")

    # Создаем шаблон
    template = create_template(req.samples)
    # Сохраняем исходные образцы для механизма адаптивного обновления
    template["recent_samples"] = [s.model_dump() for s in req.samples]
    
    # Сохраняем в БД
    new_user = UserDB(
        username=req.username,
        template_data=template
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "Пользователь успешно зарегистрирован",
        "user_id": new_user.id
    }

@app.post("/verify")
def verify_user(req: VerifyRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == req.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Сравниваем образец с шаблоном
    template = user.template_data
    recent_samples = template.get("recent_samples", [])
    
    score = calculate_score(req.sample, template, recent_samples)
    threshold = template.get("threshold", -9999.0)
    
    is_match = score >= threshold
    
    # ==========================================
    # Адаптивное обновление шаблона (Sliding Window)
    # ==========================================
    # Порог для адаптивного обновления - более уверенная оценка по LL
    # Для GMM мы берем логарифмическую оценку, так что уверенность - это значение ближе к baseline
    baseline_ll = template.get("baseline_ll", threshold)
    std_ll = template.get("std_ll", abs(baseline_ll)*0.1)
    
    # Если логарифмическое правдоподобие выше baseline - 1.5 * std (то есть очень похоже на хозяина)
    ADAPTIVE_THRESHOLD = baseline_ll - 1.5 * std_ll
    
    if is_match and score >= ADAPTIVE_THRESHOLD:
        recent_samples = template.get("recent_samples", [])
        recent_samples.append(req.sample.model_dump())
        
        # Ограничиваем окно последних успешных вводов (например, 20)
        MAX_WINDOW = 20
        if len(recent_samples) > MAX_WINDOW:
            recent_samples = recent_samples[-MAX_WINDOW:]
            
        # Пересчитываем шаблон на основе обновленного окна
        parsed_samples = [KeystrokeFeatures(**s) for s in recent_samples]
        new_template = create_template(parsed_samples)
        new_template["recent_samples"] = recent_samples
        new_template["threshold"] = threshold
        
        # Обновляем данные в БД
        user.template_data = new_template
        # В SQLAlchemy для JSON полей нужно явно указать изменение (flag_modified), 
        # либо переприсвоить объект, что мы и сделали
        db.commit()
    
    return {
        "success": is_match,
        "score": score,
        "threshold": threshold,
        "details": "Верификация успешна" if is_match else "Верификация не пройдена",
        "username": req.username,
        "method": "GMM (PostgreSQL)"
    }

@app.get("/users/{username}/template")
def get_user_template(username: str, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return user.template_data
