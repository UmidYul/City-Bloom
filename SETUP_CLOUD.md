# City Bloom - MongoDB Atlas + Vercel Blob Migration Guide

## 📋 Шаги для настройки

### 1️⃣ MongoDB Atlas Setup

1. Зайди на https://www.mongodb.com/cloud/atlas/register
2. Создай бесплатный аккаунт
3. Создай кластер (выбери **FREE tier M0**)
4. Выбери регион ближайший (например Frankfurt или Singapore)
5. После создания кластера:
   - Нажми **Connect** → **Drivers**
   - Скопируй connection string
   - Замени `<password>` на свой пароль
   - Замени `<dbname>` на `citybloom`
6. Добавь IP адрес:
   - Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)

**Пример connection string:**
```
mongodb+srv://umid:mypassword123@cluster0.xxxxx.mongodb.net/citybloom?retryWrites=true&w=majority
```
mongodb+srv://yumid254_db_user:8RCHtHeELMaGKL6D@cluster0.od4ivzj.mongodb.net/?appName=Cluster0
---

### 2️⃣ Vercel Blob Setup

1. Зайди в Vercel Dashboard: https://vercel.com
2. Открой свой проект
3. Перейди в **Storage** → **Create Database** → **Blob**
4. Скопируй токен `BLOB_READ_WRITE_TOKEN`

---

### 3️⃣ Настройка локально

Создай файл `.env` (скопируй из `.env.example`):

```bash
JWT_SECRET='000f74e87949b59e1497c0c245488391'
MONGODB_URI=mongodb+srv://your-connection-string-here
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxx
PORT=3000
```

---

### 4️⃣ Установка зависимостей

```bash
npm install mongoose @vercel/blob dotenv
```

---

### 5️⃣ Настройка переменных на Vercel

1. Зайди в Vercel → Твой проект → **Settings** → **Environment Variables**
2. Добавь переменные:
   - `JWT_SECRET` = `000f74e87949b59e1497c0c245488391`
   - `MONGODB_URI` = твой connection string
   - `BLOB_READ_WRITE_TOKEN` = токен из Blob Storage

---

### 6️⃣ Миграция данных (после запуска)

После того как настроишь MongoDB и обновишь код, запустишь скрипт миграции:

```bash
node scripts/migrate.js
```

Это перенесёт все данные из `db.json` в MongoDB.

---

## ✅ Готово!

После этого:
- Локально: `npm start`
- Vercel: `git push` → автоматический деплой

---

## 🔍 Проверка

- MongoDB: зайди в Atlas → Browse Collections → увидишь данные
- Blob: зайди в Vercel → Storage → увидишь загруженные файлы
