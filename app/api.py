from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine, get_db
from app.ml import calculate_score, create_template
from app.models import UserDB
from app.schemas import KeystrokeFeatures, RegisterRequest, VerifyRequest
from app.security import SimpleRateLimiter

app = FastAPI(title="BioAuth Keystroke API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verify_rate_limiter = SimpleRateLimiter(
    max_requests=settings.verify_rate_limit_per_minute,
    window_seconds=60,
)


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check():
    return {"status": "ok", "database": "postgresql"}


@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(UserDB).all()
    return [
        {"id": u.id, "username": u.username, "created_at": u.created_at.isoformat()}
        for u in users
    ]


@app.post("/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(UserDB).filter(UserDB.username == req.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    template = create_template(req.samples)
    template["recent_samples"] = [s.model_dump() for s in req.samples]

    new_user = UserDB(username=req.username, template_data=template)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Пользователь успешно зарегистрирован", "user_id": new_user.id}


@app.post("/verify")
def verify_user(req: VerifyRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{req.username}"
    if not verify_rate_limiter.is_allowed(rate_limit_key):
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже")

    user = db.query(UserDB).filter(UserDB.username == req.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    template = user.template_data
    recent_samples = template.get("recent_samples", [])

    score = calculate_score(req.sample, template, recent_samples)
    threshold = template.get("threshold", -9999.0)
    is_match = score >= threshold

    baseline_ll = template.get("baseline_ll", threshold)
    std_ll = template.get("std_ll", abs(baseline_ll) * 0.1)
    adaptive_threshold = baseline_ll - 1.5 * std_ll

    if is_match and score >= adaptive_threshold:
        recent_samples = template.get("recent_samples", [])
        recent_samples.append(req.sample.model_dump())
        max_window = 20
        if len(recent_samples) > max_window:
            recent_samples = recent_samples[-max_window:]

        parsed_samples = [KeystrokeFeatures(**s) for s in recent_samples]
        new_template = create_template(parsed_samples)
        new_template["recent_samples"] = recent_samples
        new_template["threshold"] = threshold

        user.template_data = new_template
        db.commit()

    return {
        "success": is_match,
        "score": score,
        "threshold": threshold,
        "details": "Верификация успешна" if is_match else "Верификация не пройдена",
        "username": req.username,
        "method": "GMM (PostgreSQL)",
    }


@app.get("/users/{username}/template")
def get_user_template(username: str, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user.template_data


_dist = Path(__file__).resolve().parent.parent / "dist"
if _dist.is_dir() and (_dist / "index.html").is_file():
    @app.get("/")
    def spa_index():
        return FileResponse(_dist / "index.html")

    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="spa_assets")

