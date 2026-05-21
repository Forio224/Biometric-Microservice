# Локальный запуск KeystrokeID (Frontend + Backend + PostgreSQL)

## Предварительные требования

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+
- [Docker](https://www.docker.com/) и Docker Compose

---

## 1. Поднять PostgreSQL через Docker

```bash
# Создать и запустить контейнер PostgreSQL
docker run -d \
  --name bioauth-postgres \
  -e POSTGRES_USER=bioauth \
  -e POSTGRES_PASSWORD=bioauth123 \
  -e POSTGRES_DB=bioauth \
  -p 5432:5432 \
  postgres:16-alpine

# Проверить что контейнер запущен
docker ps
```

Для остановки и повторного запуска:

```bash
docker stop bioauth-postgres    # остановить
docker start bioauth-postgres   # запустить снова
docker rm bioauth-postgres      # удалить контейнер полностью
```

---

## 2. Настроить переменные окружения

Создать файл `.env` в корне проекта:

```env
DATABASE_URL=postgresql://bioauth:bioauth123@localhost:5432/bioauth
SECRET_KEY=your-secret-key-here
VITE_API_URL=http://localhost:8000
```

---

## 3. Запустить Backend (FastAPI)

```bash
# Установить зависимости Python
pip install -r requirements.txt

# Запустить сервер
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

Backend будет доступен на `http://localhost:8000`.
Swagger-документация: `http://localhost:8000/docs`.

---

## 4. Запустить Frontend (React + Vite)

В отдельном терминале:

```bash
# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

Frontend будет доступен на `http://localhost:5173`.

---

## 5. Проверить работу

1. Открыть `http://localhost:5173` в браузере
2. В правом верхнем углу должен отобразиться статус `API · online`
3. Перейти в раздел «Регистрация» и зарегистрировать пользователя (ввести контрольную фразу 10 раз)
4. Перейти в раздел «Верификация» и проверить вход

---

## Полезные команды

| Действие | Команда |
|---|---|
| Логи PostgreSQL | `docker logs bioauth-postgres` |
| Подключиться к БД | `docker exec -it bioauth-postgres psql -U bioauth -d bioauth` |
| Пересоздать БД | `docker exec -it bioauth-postgres psql -U bioauth -c "DROP DATABASE bioauth; CREATE DATABASE bioauth;"` |
| Остановить всё | `docker stop bioauth-postgres` + `Ctrl+C` в терминалах с backend/frontend |

---

## Структура проекта

```
Biometric-Microservice/
├── app/              # Backend (FastAPI)
│   ├── api.py        # Эндпоинты: /register, /verify, /users, /health
│   ├── db.py         # Подключение к БД
│   ├── ml.py         # GMM-модель для верификации
│   ├── models.py     # ORM-модели (SQLAlchemy)
│   └── schemas.py    # Pydantic-схемы
├── src/              # Frontend (React + TypeScript)
│   ├── App.tsx       # Главный компонент
│   ├── pages/        # Страницы: AuthPage, AnalysisPage, DashboardPage
│   ├── components/   # Компоненты: TopBar, BiometricCapture и др.
│   └── ui/           # UI-библиотека: GlassCard, Input, Button и др.
├── index.html        # HTML + Tailwind + стили
├── main.py           # Точка входа backend
├── requirements.txt  # Python-зависимости
└── package.json      # Node.js-зависимости
```
