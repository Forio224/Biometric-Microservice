# Biometric Microservice

Проект состоит из двух частей:
- Frontend: React + Vite
- Backend: FastAPI + PostgreSQL + GMM

## Локальный запуск

### 1) База данных (PostgreSQL)

Самый простой способ — Docker:
```bash
docker run --name bioauth-pg \
  -e POSTGRES_PASSWORD=123 -e POSTGRES_DB=dna \
  -p 5432:5432 -d postgres:16
```

Альтернативно — установить нативно (https://www.postgresql.org/download/) и создать БД:
```sql
CREATE DATABASE dna;
```

Для быстрой разработки без Postgres можно временно использовать SQLite — см. `.env.example`.

### 2) Backend
1. Создайте и активируйте виртуальное окружение Python (`python -m venv .venv && .venv\Scripts\activate` на Windows).
2. Установите зависимости: `pip install -r requirements.txt`.
3. Скопируйте `.env.example` в `.env` и настройте значения (как минимум `DATABASE_URL`).
4. Запустите API: `uvicorn main:app --reload --port 8000`.
5. Проверка: `GET http://localhost:8000/health` должен вернуть `{"status":"ok",...}`.

### 3) Frontend
1. Установите зависимости: `npm install`.
2. (Опционально) создайте `.env.local` с `VITE_API_URL=http://localhost:8000`. Если переменная не задана, фронт сам пойдёт на `http://localhost:8000` при запуске на локалхосте.
3. Запустите dev-сервер: `npm run dev` → http://localhost:3000.

При недоступности backend-а фронт автоматически переключается в **mock-режим** (жёлтый баннер сверху) — это работает для демонстрации без поднятого сервера.

## Конфигурация (backend)

- `DATABASE_URL` — строка подключения к PostgreSQL (или `sqlite:///./bioauth.db` для локальной разработки).
- `ALLOWED_ORIGINS` — список origin для CORS (JSON-массив).
- `VERIFY_RATE_LIMIT_PER_MINUTE` — лимит попыток верификации в минуту с одного IP+username.

## Конфигурация (frontend)

- `VITE_API_URL` — URL FastAPI-бэкенда. На single-container деплое можно оставить пустым (same-origin).
