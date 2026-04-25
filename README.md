# Biometric Microservice

Проект состоит из двух частей:
- Frontend: React + Vite
- Backend: FastAPI + PostgreSQL + GMM

## Локальный запуск

### 1) Frontend
1. Установите зависимости: `npm install`
2. Запустите dev-сервер: `npm run dev`

### 2) Backend
1. Создайте и активируйте виртуальное окружение Python
2. Установите зависимости: `pip install -r requirements.txt`
3. Скопируйте `.env.example` в `.env` и настройте значения
4. Запустите API: `uvicorn main:app --reload --port 8000`

## Конфигурация

- `DATABASE_URL` - строка подключения к PostgreSQL
- `ALLOWED_ORIGINS` - список origin для CORS (JSON-массив)
- `VERIFY_RATE_LIMIT_PER_MINUTE` - лимит попыток верификации в минуту
