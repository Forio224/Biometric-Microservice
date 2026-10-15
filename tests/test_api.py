import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import ml
from app.api import app
from app.db import Base, get_db
from app.models import UserDB
from app.schemas import KeystrokeFeatures
from tests.helpers import make_samples, typical_sample


@pytest.fixture
def db_session():
    # SQLite в памяти вместо PostgreSQL: одно соединение на весь тест
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield Session
    app.dependency_overrides.clear()


@pytest.fixture
def client(db_session):
    return TestClient(app)


def register(client, username, samples):
    resp = client.post(
        "/register",
        json={"username": username, "samples": [s.model_dump() for s in samples]},
    )
    assert resp.status_code == 200, resp.text


def load_template(Session, username) -> dict:
    with Session() as db:
        return db.query(UserDB).filter_by(username=username).one().template_data


def save_template(Session, username, template: dict):
    with Session() as db:
        user = db.query(UserDB).filter_by(username=username).one()
        user.template_data = template
        db.commit()


def test_verify_score_ignores_recent_samples_window(client, db_session):
    register(client, "owner_window", make_samples(12))
    template = load_template(db_session, "owner_window")
    expected = ml.calculate_score(typical_sample(), template)

    # Окно попыток целиком заменено чужими образцами — на скор это влиять не должно
    template["recent_samples"] = [s.model_dump() for s in make_samples(20, seed=7, shift=80.0)]
    save_template(db_session, "owner_window", template)

    resp = client.post(
        "/verify", json={"username": "owner_window", "sample": typical_sample().model_dump()}
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["score"] == pytest.approx(expected)


def test_threshold_belongs_to_model_after_window_update(client, db_session):
    register(client, "owner_update", make_samples(12))

    resp = client.post(
        "/verify", json={"username": "owner_update", "sample": typical_sample().model_dump()}
    )
    assert resp.json()["success"] is True

    template = load_template(db_session, "owner_update")
    assert len(template["recent_samples"]) == 13, "попытка должна была попасть в окно"
    window = [KeystrokeFeatures(**s) for s in template["recent_samples"]]
    assert template["threshold"] == pytest.approx(ml.create_template(window)["threshold"])


def test_verify_with_outdated_template_asks_to_reregister(client, db_session):
    samples = make_samples(12)
    old_template = ml.create_template(samples)
    old_template.pop("model", None)  # шаблон, сохранённый до ML-01
    old_template["recent_samples"] = [s.model_dump() for s in samples]
    with db_session() as db:
        db.add(UserDB(username="old_user", template_data=old_template))
        db.commit()

    resp = client.post(
        "/verify", json={"username": "old_user", "sample": typical_sample().model_dump()}
    )

    assert resp.status_code == 409
    assert "регистрац" in resp.json()["detail"]
