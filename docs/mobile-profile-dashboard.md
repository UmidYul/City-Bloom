# Профиль / Дашборд пользователя (мобильный экран)

Цель: быстро показать состояние профиля, очки Eco-Points и недавние действия, мотивируя пользователя и давая доступ к наградам/настройкам.

## Структура (сверху вниз)
- **Header**: слева иконка настроек → Settings; центр — заголовок `Profile`; справа иконка уведомлений → Notifications.
- **Профильная карточка**: круглый аватар (fallback — инициалы); имя `Alex Green`; подзаголовок `Forest Guardian`; tap по аватару → Edit profile modal (имя, фото, био); long-press → quick actions (edit photo).
- **Eco-Points карточка** (кликабельна → Bonuses & Rewards): число `1,250`; подпись `Eco-Points`; подсказка `Plant. Care. Earn. Make Your City Bloom`.
- **Быстрая статистика**: 3 мини-карточки/пилюли (`Trees Planted — 12`, `Care Actions — 85`, `Impact Area (sq. ft.) — 240`); layout — горизонтальный скролл или grid 3-в-ряд; tap → подробный лог.
- **My Eco-Badges**: горизонтальный список; активные — цветные, заблокированные — серые с замком; tap → всплывающее окно (описание, условия, дата).
- **Recent Activity**: список карточек (иконка, заголовок, timestamp, +xp); swipe по записи → `View`, `Share`, `Delete` (delete с подтверждением); pull-to-refresh обновляет очки и активность.
- **Пустая активность**: текст `Нет активности. Стань первым, кто посадит дерево!`.
- **Нижняя навигация** (persistent): Home, Map, Profile (active), Community.

## Текстовые строки (i18n)
- Header: `Profile`
- Аватар: `Alex Green`; подзаголовок: `Forest Guardian`
- Eco-card: `1,250`, подпись `Eco-Points`, подсказка `Plant. Care. Earn. Make Your City Bloom`
- Stats labels: `Trees Planted`, `Care Actions`, `Impact Area (sq. ft.)`
- Badges header: `My Eco-Badges`
- Recent header: `Recent Activity`
- Empty state: `Нет активности. Стань первым, кто посадит дерево!`

## Поведение и состояния
- Taps: Eco-Points → Rewards; аватар → Edit modal; header icons → Settings/Notifications; stat pill → лог; badge → описание.
- Gestures: long-press аватара → quick actions; swipe по activity → View/Share/Delete; pull-to-refresh → рефреш.
- Анимации: рост очков — плавное инкрементирование + конфетти/зелёное свечение; tap-карточки — soft scale до 0.98 + тень.
- Загрузки: skeleton для карточек/иконок.
- Ошибка: `Не удалось загрузить профиль. Попробовать снова` + кнопка Retry.
- Offline: показывать кеш + баннер `Оффлайн — изменения сохранятся локально`.

## Валидации и данные
- Поля профиля: имя 1–50 символов; роль до 30 символов.
- API: `GET /user/profile` → `{ id, name, role, avatar_url, eco_points, stats { trees_planted, care_actions, impact_area }, badges[], recent_activities[] }`; ответы 200/4xx/5xx.

## Доступность
- Контраст текста ≥ 4.5:1 для мелкого текста.
- Alt-текст для аватара и бейджей; голосовая метка: «Профиль, Alex Green, Eco points 1250».
- Минимальные tap-зоны 44×44 pt; фокус/hover подсветка для интерактивных элементов.
