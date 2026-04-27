from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, JSON, String

from app.db import Base


class UserDB(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    template_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

