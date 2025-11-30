import express from "express"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import bodyParser from "body-parser"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"
import multer from 'multer'
import { Low } from "lowdb"
import { JSONFile } from "lowdb/node"
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const app = express()
const port = 3000

const DB_FILE = join(__dirname, 'db.json')

const adapter = new JSONFile(DB_FILE)
const Defaultdata = { Users: [], Submissions: [], Products: [], PromoCodes: [], Notifications: [], Achievements: [], UserAchievements: [] }
const db = new Low(adapter, Defaultdata)

const JWT_SECRET = process.env.JWT_SECRET || 'UMIDSECRETKEY'
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!')
}
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cookieParser())

// Minimal request logger for observability
app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
        const ms = Date.now() - start
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`)
    })
    next()
})

app.use(express.static(join(__dirname, 'public')))
app.use('/locales', express.static(join(__dirname, 'locales')))

// multer for file uploads
const uploadDir = join(__dirname, 'public', 'uploads')
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir) },
    filename: function (req, file, cb) {
        const ext = (file.originalname || '').split('.').pop()
        const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        cb(null, name + (ext ? ('.' + ext) : ''))
    }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB

// Simple input sanitizer to reduce XSS risk
function sanitize(str) {
    if (typeof str !== 'string') return str
    return str.replace(/[<>]/g, '') // remove angle brackets
}

// Basic in-memory rate limiter (per IP: max 120 requests / 10 min)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 120
const rateBuckets = new Map()
setInterval(() => rateBuckets.clear(), RATE_LIMIT_WINDOW_MS)
function rateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    const bucket = rateBuckets.get(ip) || { count: 0 }
    bucket.count++
    rateBuckets.set(ip, bucket)
    if (bucket.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests' })
    }
    next()
}

app.use(rateLimit)

// Check and award achievements for a user
async function checkAchievements(userId) {
    await db.read()

    const user = db.data.Users.find(u => u.id === userId)
    if (!user) return []

    const userSubmissions = db.data.Submissions.filter(s => s.userId === userId && s.status === 'approved')
    const userPromos = (db.data.PromoCodes || []).filter(p => p.userId === userId)
    const totalSpent = userPromos.reduce((sum, p) => {
        const product = db.data.Products.find(pr => pr.id === p.productId)
        return sum + (product?.price || 0)
    }, 0)

    const plantTypes = new Set(userSubmissions.map(s => s.plantType).filter(Boolean))

    const newAchievements = []

    for (const achievement of db.data.Achievements) {
        // Check if user already has this achievement
        const hasAchievement = db.data.UserAchievements.some(
            ua => ua.userId === userId && ua.achievementId === achievement.id
        )

        if (hasAchievement) continue

        let earned = false

        // Check conditions
        switch (achievement.condition.type) {
            case 'plantings':
                earned = userSubmissions.length >= achievement.condition.value
                break
            case 'trust':
                earned = (user.trustRating || 0) >= achievement.condition.value
                break
            case 'spent':
                earned = totalSpent >= achievement.condition.value
                break
            case 'plant-types':
                earned = plantTypes.size >= achievement.condition.value
                break
        }

        if (earned) {
            const userAchievement = {
                id: uuidv4(),
                userId,
                achievementId: achievement.id,
                earnedAt: new Date().toISOString()
            }
            db.data.UserAchievements.push(userAchievement)

            // Award bonus points
            user.points = (user.points || 0) + (achievement.points || 0)

            newAchievements.push(achievement)
        }
    }

    if (newAchievements.length > 0) {
        await db.write()
    }

    return newAchievements
}

// Level system constants and functions
const LEVEL_XP_REQUIREMENTS = [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3
    600,    // Level 4
    1000,   // Level 5
    1500,   // Level 6
    2100,   // Level 7
    2800,   // Level 8
    3600,   // Level 9
    4500,   // Level 10
    5500,   // Level 11
    6600,   // Level 12
    7800,   // Level 13
    9100,   // Level 14
    10500,  // Level 15
    12000,  // Level 16
    13600,  // Level 17
    15300,  // Level 18
    17100,  // Level 19
    19000   // Level 20
]

const LEVEL_NAMES = {
    1: 'Новичок',
    2: 'Садовник',
    3: 'Активист',
    4: 'Эксперт',
    5: 'Мастер',
    6: 'Гуру',
    7: 'Чемпион',
    8: 'Легенда',
    9: 'Герой',
    10: 'Бог'
}

function getXPForLevel(level) {
    if (level <= 0) return 0
    if (level <= LEVEL_XP_REQUIREMENTS.length) return LEVEL_XP_REQUIREMENTS[level - 1]
    // For levels beyond the table, use exponential growth
    const baseXP = LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1]
    const additionalLevels = level - LEVEL_XP_REQUIREMENTS.length
    return baseXP + (additionalLevels * 2000)
}

function getLevelName(level) {
    if (level <= 10) return LEVEL_NAMES[level] || 'Мастер'
    return `Мастер ${level}`
}

// Add experience and handle level ups
async function addExperience(userId, amount, reason = 'unknown') {
    await db.read()

    const user = db.data.Users.find(u => u.id === userId)
    if (!user) return { leveledUp: false, newLevel: 1 }

    const oldLevel = user.level || 1
    const oldXP = user.experience || 0

    user.experience = oldXP + amount

    // Check for level up
    let newLevel = oldLevel
    let leveledUp = false

    while (newLevel < 100) { // Max level 100
        const requiredXP = getXPForLevel(newLevel + 1)
        if (user.experience >= requiredXP) {
            newLevel++
            leveledUp = true
        } else {
            break
        }
    }

    if (leveledUp) {
        user.level = newLevel
        // Bonus points for leveling up
        const bonusPoints = newLevel * 100
        user.points = (user.points || 0) + bonusPoints

        console.log(`User ${user.name} leveled up! ${oldLevel} -> ${newLevel} (+${bonusPoints} bonus points)`)
    }

    await db.write()

    return {
        leveledUp,
        oldLevel,
        newLevel,
        oldXP,
        newXP: user.experience,
        addedXP: amount,
        reason,
        bonusPoints: leveledUp ? newLevel * 100 : 0
    }
}

// Update user streak
async function updateStreak(userId) {
    await db.read()

    const user = db.data.Users.find(u => u.id === userId)
    if (!user) return { streakUpdated: false, currentStreak: 0, bonusAwarded: 0 }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let lastActivity = null
    if (user.lastActivityDate) {
        const lastDate = new Date(user.lastActivityDate)
        lastActivity = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
    }

    let streakContinued = false
    let streakBroken = false
    let bonusAwarded = 0
    const oldStreak = user.currentStreak || 0

    if (!lastActivity) {
        // First activity ever
        user.currentStreak = 1
        user.longestStreak = 1
        user.lastActivityDate = now.toISOString()
        streakContinued = true
    } else {
        const daysDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24))

        if (daysDiff === 0) {
            // Same day - no change to streak
            return { streakUpdated: false, currentStreak: user.currentStreak, bonusAwarded: 0, sameDay: true }
        } else if (daysDiff === 1) {
            // Consecutive day - increase streak
            user.currentStreak = (user.currentStreak || 0) + 1
            user.lastActivityDate = now.toISOString()
            streakContinued = true

            // Update longest streak if necessary
            if (user.currentStreak > (user.longestStreak || 0)) {
                user.longestStreak = user.currentStreak
            }

            // Award bonuses for milestones
            if (user.currentStreak === 7) {
                bonusAwarded = 100
                user.points = (user.points || 0) + bonusAwarded
                console.log(`User ${user.name} reached 7-day streak! +${bonusAwarded} bonus points`)
            } else if (user.currentStreak === 14) {
                bonusAwarded = 250
                user.points = (user.points || 0) + bonusAwarded
                console.log(`User ${user.name} reached 14-day streak! +${bonusAwarded} bonus points`)
            } else if (user.currentStreak === 30) {
                bonusAwarded = 500
                user.points = (user.points || 0) + bonusAwarded
                console.log(`User ${user.name} reached 30-day streak! +${bonusAwarded} bonus points`)
            }
        } else {
            // Streak broken
            user.currentStreak = 1
            user.lastActivityDate = now.toISOString()
            streakBroken = true
            console.log(`User ${user.name} streak broken. Was ${oldStreak}, now reset to 1`)
        }
    }

    await db.write()

    return {
        streakUpdated: true,
        streakContinued,
        streakBroken,
        oldStreak,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        bonusAwarded
    }
}

async function initDb() {
    await db.read()
    db.data ||= { Users: [], Submissions: [], Products: [], PromoCodes: [], Achievements: [], UserAchievements: [], Notifications: [] }

    // ensure all users have required fields
    if (Array.isArray(db.data.Users)) {
        for (const u of db.data.Users) {
            if (typeof u.points !== 'number') u.points = 0
            if (typeof u.trustRating !== 'number') u.trustRating = 5 // Стартовый рейтинг для новичков, макс 10
            if (typeof u.declinedCount !== 'number') u.declinedCount = 0
            if (!u.city) u.city = 'Unknown'
            if (!u.lastTrustRecovery) u.lastTrustRecovery = new Date().toISOString()
            if (typeof u.level !== 'number') u.level = 1
            if (typeof u.experience !== 'number') u.experience = 0
            if (typeof u.currentStreak !== 'number') u.currentStreak = 0
            if (typeof u.longestStreak !== 'number') u.longestStreak = 0
            if (!u.lastActivityDate) u.lastActivityDate = null
        }
    }

    // ensure Products and PromoCodes arrays exist
    if (!Array.isArray(db.data.Products)) db.data.Products = []
    if (!Array.isArray(db.data.PromoCodes)) db.data.PromoCodes = []
    if (!Array.isArray(db.data.Achievements)) db.data.Achievements = []
    if (!Array.isArray(db.data.UserAchievements)) db.data.UserAchievements = []
    if (!Array.isArray(db.data.Notifications)) db.data.Notifications = []

    // Initialize achievements if empty
    if (db.data.Achievements.length === 0) {
        db.data.Achievements = [
            {
                id: 'first-plant',
                icon: '🌱',
                title: 'Первая посадка',
                description: 'Посадите первое растение',
                condition: { type: 'plantings', value: 1 },
                points: 100
            },
            {
                id: 'gardener',
                icon: '🪴',
                title: 'Садовник',
                description: 'Посадите 5 растений',
                condition: { type: 'plantings', value: 5 },
                points: 250
            },
            {
                id: 'eco-activist',
                icon: '🌳',
                title: 'Эко-активист',
                description: 'Посадите 10 растений',
                condition: { type: 'plantings', value: 10 },
                points: 500
            },
            {
                id: 'nature-defender',
                icon: '🌲',
                title: 'Защитник природы',
                description: 'Посадите 25 растений',
                condition: { type: 'plantings', value: 25 },
                points: 1000
            },
            {
                id: 'eco-hero',
                icon: '🏞️',
                title: 'Эко-герой',
                description: 'Посадите 50 растений',
                condition: { type: 'plantings', value: 50 },
                points: 2500
            },
            {
                id: 'legend',
                icon: '👑',
                title: 'Легенда',
                description: 'Посадите 100 растений',
                condition: { type: 'plantings', value: 100 },
                points: 5000
            },
            {
                id: 'trusted',
                icon: '⭐',
                title: 'Доверенный',
                description: 'Достигните максимального рейтинга доверия',
                condition: { type: 'trust', value: 10 },
                points: 500
            },
            {
                id: 'generous',
                icon: '💝',
                title: 'Щедрый',
                description: 'Обменяйте 5000 баллов на награды',
                condition: { type: 'spent', value: 5000 },
                points: 1000
            },
            {
                id: 'diversity',
                icon: '🌈',
                title: 'Разнообразие',
                description: 'Посадите все типы растений',
                condition: { type: 'plant-types', value: 5 },
                points: 750
            }
        ]
        await db.write()
        console.log('Initialized achievements database')
    }

    // ensure there's at least one admin for testing
    const hasAdmin = db.data.Users.some(u => u.role === 'admin')
    if (!hasAdmin) {
        const passwordHash = await bcrypt.hash('admin', 10)
        db.data.Users.push({ id: uuidv4(), name: 'Administrator', phone: 'admin', password: passwordHash, role: 'admin', points: 0, trustRating: 10, city: 'Admin', declinedCount: 0, lastTrustRecovery: new Date().toISOString() })
        await db.write()
        console.log('Created default admin: phone=admin password=admin')
    }

    // Migration: Check achievements for existing users
    if (db.data.Users.length > 0 && db.data.Achievements.length > 0) {
        let migratedUsers = 0
        for (const user of db.data.Users) {
            if (user.role === 'user') {
                const newAchievements = await checkAchievements(user.id)
                if (newAchievements.length > 0) {
                    migratedUsers++
                    console.log(`Migrated achievements for user ${user.name}: ${newAchievements.length} new achievement(s)`)
                }
            }
        }
        if (migratedUsers > 0) {
            console.log(`Achievement migration completed for ${migratedUsers} user(s)`)
        }
    }
}

initDb().catch(err => console.error('DB init error', err))

// serve pages
app.get('/', (req, res) => res.sendFile(join(__dirname, 'views', 'main.html')))
app.get('/profile/:id', (req, res) => res.sendFile(join(__dirname, 'views', 'profile.html')))
app.get('/ranking', (req, res) => res.sendFile(join(__dirname, 'views', 'ranking.html')))
app.get('/notifications', (req, res) => res.sendFile(join(__dirname, 'views', 'notifications.html')))
app.get('/statistics', (req, res) => res.sendFile(join(__dirname, 'views', 'statistics.html')))
app.get('/achievements', (req, res) => res.sendFile(join(__dirname, 'views', 'achievements.html')))
app.get('/admin', (req, res) => {
    const data = verifyTokenFromReq(req)
    if (!data || data.role !== 'admin') return res.status(403).sendFile(join(__dirname, 'views', 'login.html'))
    res.sendFile(join(__dirname, 'views', 'admin.html'))
})
app.get('/login', (req, res) => res.sendFile(join(__dirname, 'views', 'login.html')))
app.get('/registration', (req, res) => res.sendFile(join(__dirname, 'views', 'reg.html')))
app.get('/register-tree', (req, res) => res.sendFile(join(__dirname, 'views', 'register_tree.html')))
app.get('/submission/:id', (req, res) => res.sendFile(join(__dirname, 'views', 'submission.html')))
app.get('/exchange', (req, res) => res.sendFile(join(__dirname, 'views', 'exchange.html')))
app.get('/map', (req, res) => res.sendFile(join(__dirname, 'views', 'map.html')))
app.get('/settings', (req, res) => res.sendFile(join(__dirname, 'views', 'settings.html')))

// auth helpers
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function verifyTokenFromReq(req) {
    const token = req.cookies?.token
    if (!token) return null
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch (err) {
        return null
    }
}

function requireAuth(req, res, next) {
    const data = verifyTokenFromReq(req)
    if (!data) return res.status(401).json({ error: 'Unauthorized' })
    req.user = data
    next()
}

function requireAdmin(req, res, next) {
    const data = verifyTokenFromReq(req)
    if (!data || data.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    req.user = data
    next()
}

// Trust rating recovery function - disabled
function recoverTrustRating(user) {
    // Recovery disabled - trust rating no longer auto-recovers
    return false
}

// Calculate user rank score: (points * 0.6 + trustRating * 4 * 0.4)
// This gives more weight to trustRating while accounting for points
function calculateRankScore(user) {
    const pointsScore = (user.points || 0) * 0.6
    const trustScore = ((user.trustRating || 10) / 10) * 100 * 0.4
    return pointsScore + trustScore
}

// API
app.post('/registration', async (req, res) => {
    await db.read()
    const { name, phone, password, city } = req.body
    if (!phone || !password) return res.status(400).json({ error: 'phone and password required' })
    const exists = db.data.Users.find(u => u.phone === phone)
    if (exists) return res.status(400).json({ error: 'User exists' })
    const hash = await bcrypt.hash(password, 10)
    const user = {
        id: uuidv4(),
        name: sanitize(name || ''),
        phone,
        password: hash,
        role: 'user',
        points: 0,
        city: sanitize(city || 'Unknown'),
        trustRating: 5,
        declinedCount: 0,
        lastTrustRecovery: new Date().toISOString(),
        level: 1,
        experience: 10
    }
    db.data.Users.push(user)
    await db.write()

    // Award welcome XP
    await addExperience(user.id, 10, 'registration')

    const token = signToken({ id: user.id, role: user.role })
    res.cookie('token', token, { httpOnly: true })
    const accept = (req.headers && req.headers.accept) || ''
    if (accept.includes('text/html')) {
        // browser form submission: redirect based on role
        if (user.role === 'admin') return res.redirect('/admin')
        return res.redirect('/')
    }
    res.json({ ok: true, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } })
})

app.post('/login', async (req, res) => {
    await db.read()
    const { phone, password } = req.body
    const user = db.data.Users.find(u => u.phone === phone)
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' })
    const token = signToken({ id: user.id, role: user.role })
    res.cookie('token', token, { httpOnly: true })
    const accept = (req.headers && req.headers.accept) || ''
    if (accept.includes('text/html')) {
        // browser form submission: redirect based on role
        if (user.role === 'admin') return res.redirect('/admin')
        return res.redirect('/')
    }
    res.json({ ok: true, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } })
})

app.post('/logout', (req, res) => {
    res.clearCookie('token')
    // If the logout was triggered by a normal browser form/navigation, redirect to home.
    const accept = (req.headers && req.headers.accept) || ''
    if (accept.includes('text/html')) {
        return res.redirect('/')
    }
    // otherwise return JSON for API clients
    res.json({ ok: true })
})

// get current authenticated user
app.get('/api/me', requireAuth, async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Try to recover trust rating
    recoverTrustRating(user)

    const out = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        points: user.points || 0,
        trustRating: user.trustRating || 10,
        city: user.city || 'Unknown',
        declinedCount: user.declinedCount || 0,
        level: user.level || 1,
        experience: user.experience || 0,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0
    }
    res.json(out)
})

// get user public profile
app.get('/api/users/:id', async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'Not found' })
    const out = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        city: user.city || 'Unknown',
        trustRating: user.trustRating || 10,
        points: user.points || 0,
        level: user.level || 1,
        experience: user.experience || 0,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0
    }
    res.json(out)
})

// get user statistics
app.get('/api/my-stats', requireAuth, async (req, res) => {
    await db.read()

    const userId = req.user.id
    const userSubmissions = db.data.Submissions.filter(s => s.userId === userId)
    const approvedSubmissions = userSubmissions.filter(s => s.status === 'approved')
    const userPromos = (db.data.PromoCodes || []).filter(p => p.userId === userId)

    // Summary stats
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthSubmissions = approvedSubmissions.filter(s => {
        const subDate = new Date(s.createdAt)
        return subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear
    })

    const totalEarned = approvedSubmissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0)
    const totalSpent = userPromos.reduce((sum, p) => {
        const product = db.data.Products.find(pr => pr.id === p.productId)
        return sum + (product?.price || 0)
    }, 0)

    // Monthly plantings (last 6 months)
    const monthlyPlantings = []
    for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(currentYear, currentMonth - i, 1)
        const targetMonth = targetDate.getMonth()
        const targetYear = targetDate.getFullYear()

        const count = approvedSubmissions.filter(s => {
            const subDate = new Date(s.createdAt)
            return subDate.getMonth() === targetMonth && subDate.getFullYear() === targetYear
        }).length

        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        monthlyPlantings.push({
            month: monthNames[targetMonth],
            count
        })
    }

    // Plant types distribution
    const typesCounts = {}
    approvedSubmissions.forEach(s => {
        const type = s.plantType || 'Не указано'
        typesCounts[type] = (typesCounts[type] || 0) + 1
    })

    const plantTypes = Object.entries(typesCounts).map(([type, count]) => ({ type, count }))

    // Activity calendar (last 84 days / 12 weeks)
    const activityCalendar = []
    for (let i = 83; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]

        const count = approvedSubmissions.filter(s => {
            const subDateStr = new Date(s.createdAt).toISOString().split('T')[0]
            return subDateStr === dateStr
        }).length

        activityCalendar.push({ date: dateStr, count })
    }

    // Activity timeline
    const activities = []

    // Add planting activities
    userSubmissions.forEach(s => {
        if (s.status === 'approved') {
            activities.push({
                type: 'approval',
                date: s.updatedAt || s.createdAt,
                title: 'Посадка одобрена',
                description: `Ваше растение "${s.plantType || 'растение'}" было одобрено. +${s.pointsAwarded || 0} баллов`
            })
        } else if (s.status === 'declined') {
            activities.push({
                type: 'decline',
                date: s.updatedAt || s.createdAt,
                title: 'Посадка отклонена',
                description: `Посадка "${s.plantType || 'растение'}" была отклонена${s.adminComment ? ': ' + s.adminComment : ''}`
            })
        } else {
            activities.push({
                type: 'planting',
                date: s.createdAt,
                title: 'Новая посадка',
                description: `Вы посадили "${s.plantType || 'растение'}" в ${s.address || 'указанном месте'}`
            })
        }
    })

    // Add reward redemption activities
    userPromos.forEach(p => {
        const product = db.data.Products.find(pr => pr.id === p.productId)
        activities.push({
            type: 'purchase',
            date: p.createdAt,
            title: 'Обмен на награду',
            description: `Вы обменяли ${product?.price || 0} баллов на "${p.productTitle}"`
        })
    })

    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json({
        summary: {
            totalPlantings: approvedSubmissions.length,
            thisMonth: thisMonthSubmissions.length,
            totalEarned,
            totalSpent
        },
        monthlyPlantings,
        plantTypes,
        activityCalendar,
        activities: activities.slice(0, 50) // Limit to 50 recent activities
    })
})

// Get user achievements
app.get('/api/my-achievements', requireAuth, async (req, res) => {
    await db.read()

    const userId = req.user.id
    const userAchievements = db.data.UserAchievements.filter(ua => ua.userId === userId)
    const earnedIds = new Set(userAchievements.map(ua => ua.achievementId))

    // Get user stats for progress calculation
    const userSubmissions = db.data.Submissions.filter(s => s.userId === userId && s.status === 'approved')
    const user = db.data.Users.find(u => u.id === userId)
    const userPromos = (db.data.PromoCodes || []).filter(p => p.userId === userId)
    const totalSpent = userPromos.reduce((sum, p) => {
        const product = db.data.Products.find(pr => pr.id === p.productId)
        return sum + (product?.price || 0)
    }, 0)
    const plantTypes = new Set(userSubmissions.map(s => s.plantType).filter(Boolean))

    const achievements = db.data.Achievements.map(achievement => {
        const earned = earnedIds.has(achievement.id)
        const userAchievement = userAchievements.find(ua => ua.achievementId === achievement.id)

        // Calculate progress
        let progress = 0
        let current = 0
        let target = achievement.condition.value

        switch (achievement.condition.type) {
            case 'plantings':
                current = userSubmissions.length
                break
            case 'trust':
                current = user?.trustRating || 0
                break
            case 'spent':
                current = totalSpent
                break
            case 'plant-types':
                current = plantTypes.size
                break
        }

        progress = Math.min(100, Math.floor((current / target) * 100))

        return {
            ...achievement,
            earned,
            earnedAt: userAchievement?.earnedAt || null,
            progress,
            current,
            target
        }
    })

    res.json(achievements)
})

// get all users (admin only)
app.get('/api/users', async (req, res) => {
    const data = verifyTokenFromReq(req)
    if (!data || data.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

    await db.read()

    // Calculate rankings
    const sortedUsers = [...db.data.Users].sort((a, b) => (b.points || 0) - (a.points || 0))

    const usersWithRank = sortedUsers.map((user, index) => {
        const submissions = db.data.Submissions.filter(s => s.userId === user.id)
        const approvedSubmissions = submissions.filter(s => s.status === 'approved')

        return {
            id: user.id,
            name: user.name,
            email: user.email || user.phone,
            role: user.role || 'user',
            city: user.city || 'Unknown',
            points: user.points || 0,
            trustRating: user.trustRating || 10,
            treesPlanted: approvedSubmissions.length,
            rank: index + 1
        }
    })

    res.json(usersWithRank)
})

// Get rank info for a specific user (public endpoint)
app.get('/api/users/:id/rank', async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Recover trust rating
    recoverTrustRating(user)

    // Get city rank
    let cityUsers = db.data.Users.filter(u => (u.city || 'Unknown') === (user.city || 'Unknown') && u.role === 'user')
    cityUsers = cityUsers.map(u => ({ ...u, rankScore: calculateRankScore(u) }))
    cityUsers.sort((a, b) => b.rankScore - a.rankScore)
    const cityRank = cityUsers.findIndex(u => u.id === user.id) + 1

    // Get global rank
    let globalUsers = db.data.Users.filter(u => u.role === 'user')
    globalUsers = globalUsers.map(u => ({ ...u, rankScore: calculateRankScore(u) }))
    globalUsers.sort((a, b) => b.rankScore - a.rankScore)
    const globalRank = globalUsers.findIndex(u => u.id === user.id) + 1

    res.json({
        cityRank,
        globalRank,
        cityUsersCount: cityUsers.length,
        globalUsersCount: globalUsers.length
    })
})

// submit plant registration
// accept multipart form with optional before/after video files and lat/lng
app.post('/api/submitPlant', requireAuth, upload.fields([{ name: 'beforeVideo', maxCount: 1 }, { name: 'afterVideo', maxCount: 1 }]), async (req, res) => {
    try {
        console.log('POST /api/submitPlant - User:', req.user)
        console.log('Body:', req.body)
        console.log('Files object:', req.files)
        console.log('Content-Type:', req.headers['content-type'])

        await db.read()
        const { title, plantType, description, lat, lng, location } = req.body

        // Handle case where req.files might be null or undefined
        const files = req.files || {}
        console.log('Files after fallback:', files)

        const beforeFile = files.beforeVideo && files.beforeVideo[0] ? '/uploads/' + files.beforeVideo[0].filename : null
        const afterFile = files.afterVideo && files.afterVideo[0] ? '/uploads/' + files.afterVideo[0].filename : null

        console.log('beforeFile:', beforeFile)
        console.log('afterFile:', afterFile)

        if (!beforeFile || !afterFile) {
            console.log('Missing videos - beforeFile:', beforeFile, 'afterFile:', afterFile)
            return res.status(400).json({ error: 'Both videos are required. Please upload both "before" and "after" videos.' })
        }

        const loc = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : (location || '')
        const submission = {
            id: uuidv4(),
            userId: req.user.id,
            title: sanitize(title || ''),
            plantType: sanitize(plantType || 'Tree'),
            location: loc,
            description: sanitize(description || ''),
            beforeVideo: beforeFile,
            afterVideo: afterFile,
            status: 'pending',
            createdAt: new Date().toISOString(),
            adminComment: null
        }

        db.data.Submissions.push(submission)
        await db.write()

        console.log('Submission created successfully:', submission.id)
        res.json({ ok: true, submission })
    } catch (err) {
        console.error('Error in /api/submitPlant:', err)
        console.error('Error stack:', err.stack)
        res.status(500).json({ error: 'Server error: ' + err.message })
    }
})

// get submissions (admin)
app.get('/api/submissions', requireAdmin, async (req, res) => {
    await db.read()
    res.json(db.data.Submissions)
})

// products - public listing (only with quantity > 0)
app.get('/api/products', async (req, res) => {
    await db.read()
    let products = (db.data.Products || []).filter(p => (p.quantity || 0) > 0)

    // Optional pagination via query params
    const limit = parseInt(req.query.limit, 10)
    const offset = parseInt(req.query.offset, 10) || 0

    const total = products.length
    if (limit && limit > 0) {
        products = products.slice(offset, offset + limit)
    }

    res.json({ products, total, limit: limit || null, offset })
})

// products - admin listing (with all products including 0 quantity)
app.get('/api/products/admin/list', requireAdmin, async (req, res) => {
    await db.read()
    let products = db.data.Products || []

    // Filter by category if provided
    const { category } = req.query
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category)
    }

    res.json(products)
})

// admin: create product (with icon upload)
app.post('/api/products', requireAdmin, upload.single('icon'), async (req, res) => {
    try {
        console.log('POST /api/products - User:', req.user)
        console.log('Body:', req.body)
        console.log('File:', req.file)

        await db.read()
        const { title, price, organization, validDays, quantity, category } = req.body
        if (!title || !price) return res.status(400).json({ error: 'title and price required' })
        const icon = req.file ? '/uploads/' + req.file.filename : null
        const p = {
            id: uuidv4(),
            title: sanitize(title),
            price: parseInt(price, 10) || 0,
            organization: sanitize(organization || ''),
            validDays: parseInt(validDays, 10) || 30,
            quantity: parseInt(quantity, 10) || 0,
            category: sanitize(category || 'other'),
            icon,
            createdAt: new Date().toISOString()
        }
        db.data.Products.push(p)
        await db.write()
        console.log('Product created:', p)

        // Notify all users about new product
        const users = db.data.Users.filter(u => u.role === 'user')
        for (const user of users) {
            await createNotification(
                user.id,
                'new_product',
                '🎁 Новый товар в магазине!',
                `Доступен новый товар: ${p.title} - ${p.price} баллов`
            )
        }

        res.json({ ok: true, product: p })
    } catch (err) {
        console.error('Error creating product:', err)
        res.status(500).json({ error: 'Server error: ' + err.message })
    }
})

// admin: update product (optional icon upload)
app.put('/api/products/:id', requireAdmin, upload.single('icon'), async (req, res) => {
    try {
        await db.read()
        const p = db.data.Products.find(x => x.id === req.params.id)
        if (!p) return res.status(404).json({ error: 'Not found' })
        const { title, price, organization, validDays, quantity } = req.body
        if (title) p.title = sanitize(title)
        if (typeof price !== 'undefined') p.price = parseInt(price, 10) || 0
        if (organization) p.organization = sanitize(organization)
        if (typeof validDays !== 'undefined') p.validDays = parseInt(validDays, 10) || p.validDays
        if (typeof quantity !== 'undefined') p.quantity = parseInt(quantity, 10) || 0
        if (req.file) p.icon = '/uploads/' + req.file.filename
        p.updatedAt = new Date().toISOString()
        await db.write()
        res.json({ ok: true, product: p })
    } catch (err) {
        console.error('Error updating product:', err)
        res.status(500).json({ error: 'Server error: ' + err.message })
    }
})

// admin: delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    await db.read()
    const idx = db.data.Products.findIndex(x => x.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    db.data.Products.splice(idx, 1)
    await db.write()
    res.json({ ok: true })
})

// redeem product -> generate promo code
function generatePromoCode(len = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let out = ''
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length))
    return out
}

app.post('/api/redeem/:id', requireAuth, async (req, res) => {
    await db.read()
    const prod = db.data.Products.find(p => p.id === req.params.id)
    if (!prod) return res.status(404).json({ error: 'Product not found' })
    if ((prod.quantity || 0) <= 0) return res.status(400).json({ error: 'Product is out of stock' })

    const user = db.data.Users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const price = prod.price || 0
    if ((user.points || 0) < price) return res.status(400).json({ error: 'Not enough points' })

    // deduct points and quantity
    user.points = (user.points || 0) - price
    prod.quantity = (prod.quantity || 0) - 1

    // create promo
    const code = generatePromoCode(12)
    const now = new Date()
    const expires = new Date(now.getTime() + ((prod.validDays || 30) * 24 * 60 * 60 * 1000))
    const promo = {
        id: uuidv4(),
        code,
        userId: user.id,
        productId: prod.id,
        productTitle: prod.title,
        organization: prod.organization || '',
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        canReview: true
    }
    db.data.PromoCodes = db.data.PromoCodes || []
    db.data.PromoCodes.push(promo)
    await db.write()

    // Check for new achievements (spent points)
    const newAchievements = await checkAchievements(user.id)
    if (newAchievements.length > 0) {
        console.log(`User ${user.name} earned ${newAchievements.length} new achievement(s) from spending points`)
    }

    res.json({ ok: true, promo })
})

// get my promo codes
app.get('/api/myPromos', requireAuth, async (req, res) => {
    await db.read()
    const list = (db.data.PromoCodes || []).filter(p => p.userId === req.user.id)
    res.json(list)
})

// Product Reviews API
// Get reviews for a product
app.get('/api/products/:id/reviews', async (req, res) => {
    await db.read()
    const reviews = (db.data.ProductReviews || []).filter(r => r.productId === req.params.id)

    // Enrich with user names
    const enrichedReviews = reviews.map(r => {
        const user = db.data.Users.find(u => u.id === r.userId)
        return {
            ...r,
            userName: user ? user.name : 'Пользователь'
        }
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json(enrichedReviews)
})

// Add a review
app.post('/api/products/:id/review', requireAuth, async (req, res) => {
    await db.read()
    const productId = req.params.id
    const userId = req.user.id
    const { rating, comment, promoCodeId } = req.body

    // Validate
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' })
    }

    if (!promoCodeId) {
        return res.status(400).json({ error: 'Promo code ID is required' })
    }

    // Check if product exists
    const product = db.data.Products.find(p => p.id === productId)
    if (!product) {
        return res.status(404).json({ error: 'Product not found' })
    }

    // Check if this specific promo code belongs to user
    const promoCode = db.data.PromoCodes.find(p => p.id === promoCodeId && p.userId === userId && p.productId === productId)
    if (!promoCode) {
        return res.status(403).json({ error: 'Invalid promo code or not owned by user' })
    }

    // Initialize reviews array if needed
    if (!Array.isArray(db.data.ProductReviews)) {
        db.data.ProductReviews = []
    }

    // Check if this promo code already has a review
    const existingReview = db.data.ProductReviews.find(r => r.promoCodeId === promoCodeId)
    if (existingReview) {
        return res.status(400).json({ error: 'Вы уже оставили отзыв на этот промокод' })
    }

    // Create review
    const review = {
        id: uuidv4(),
        userId,
        productId,
        promoCodeId,
        rating: parseInt(rating, 10),
        comment: comment || '',
        createdAt: new Date().toISOString()
    }

    db.data.ProductReviews.push(review)
    await db.write()

    res.json({ ok: true, review })
})

// Get average rating for products
app.get('/api/products/ratings', async (req, res) => {
    await db.read()
    const reviews = db.data.ProductReviews || []

    const ratings = {}
    reviews.forEach(r => {
        if (!ratings[r.productId]) {
            ratings[r.productId] = { total: 0, count: 0, average: 0 }
        }
        ratings[r.productId].total += r.rating
        ratings[r.productId].count += 1
    })

    // Calculate averages
    Object.keys(ratings).forEach(productId => {
        ratings[productId].average = parseFloat((ratings[productId].total / ratings[productId].count).toFixed(1))
    })

    res.json(ratings)
})

// Get user's own reviews
app.get('/api/my-reviews', requireAuth, async (req, res) => {
    await db.read()
    const userId = req.user.id
    const reviews = (db.data.ProductReviews || []).filter(r => r.userId === userId)
    res.json(reviews)
})

// Helper function to create notification
async function createNotification(userId, type, title, message) {
    await db.read()

    const notification = {
        id: uuidv4(),
        userId,
        type, // submission_approved, submission_declined, achievement_unlocked, level_up, new_product, promo_expiring
        title,
        message,
        read: false,
        createdAt: new Date().toISOString()
    }

    if (!Array.isArray(db.data.Notifications)) {
        db.data.Notifications = []
    }

    db.data.Notifications.push(notification)
    await db.write()

    return notification
}

// Helper function to determine city by coordinates
function getCityByCoordinates(lat, lng) {
    // Define approximate city centers and radiuses for Uzbekistan cities
    const cities = [
        { name: 'Ташкент', lat: 41.2995, lng: 69.2401, radius: 0.5 },
        { name: 'Самарканд', lat: 39.6270, lng: 66.9750, radius: 0.3 },
        { name: 'Бухара', lat: 39.7747, lng: 64.4286, radius: 0.3 },
        { name: 'Андижан', lat: 40.7821, lng: 72.3442, radius: 0.3 },
        { name: 'Фергана', lat: 40.3864, lng: 71.7864, radius: 0.3 },
        { name: 'Наманган', lat: 40.9983, lng: 71.6726, radius: 0.3 },
        { name: 'Нукус', lat: 42.4531, lng: 59.6103, radius: 0.3 },
        { name: 'Карши', lat: 38.8606, lng: 65.7975, radius: 0.25 },
        { name: 'Термез', lat: 37.2242, lng: 67.2783, radius: 0.25 },
        { name: 'Хива', lat: 41.3775, lng: 60.3642, radius: 0.2 },
        { name: 'Коканд', lat: 40.5283, lng: 70.9428, radius: 0.25 },
        { name: 'Маргилан', lat: 40.4717, lng: 71.7247, radius: 0.2 },
        { name: 'Гулистан', lat: 40.4897, lng: 68.7842, radius: 0.2 },
        { name: 'Навои', lat: 40.0844, lng: 65.3792, radius: 0.25 }
    ]

    // Find closest city
    let closestCity = null
    let minDistance = Infinity

    for (const city of cities) {
        const distance = Math.sqrt(
            Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
        )

        if (distance < city.radius && distance < minDistance) {
            minDistance = distance
            closestCity = city.name
        }
    }

    return closestCity || 'Узбекистан'
}

// Map API - Get all approved plantings with geolocation data
app.get('/api/map/plantings', async (req, res) => {
    await db.read()

    const approvedSubmissions = db.data.Submissions.filter(s => s.status === 'approved')

    const plantings = approvedSubmissions.map(submission => {
        const user = db.data.Users.find(u => u.id === submission.userId)

        // Handle different coordinate formats
        let latitude, longitude
        if (submission.location && typeof submission.location === 'object') {
            latitude = submission.location.lat
            longitude = submission.location.lng
        } else {
            latitude = submission.latitude
            longitude = submission.longitude
        }

        // Determine city by actual coordinates, not user profile
        const city = latitude && longitude
            ? getCityByCoordinates(latitude, longitude)
            : (submission.city || user?.city || 'Неизвестно')

        return {
            id: submission.id,
            latitude: latitude,
            longitude: longitude,
            plantType: submission.plantType?.toLowerCase() || 'tree',
            locationName: submission.title || 'Посадка',
            city: city,
            media: submission.beforeVideo || submission.afterVideo || submission.media,
            mediaType: 'video',
            createdAt: submission.createdAt,
            userName: user ? user.name : 'Аноним',
            userId: submission.userId
        }
    })

    res.json(plantings)
})

// Notifications API
// Get user notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
    await db.read()
    const userId = req.user.id

    const notifications = (db.data.Notifications || [])
        .filter(n => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json(notifications)
})

// Mark notification as read
app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    await db.read()
    const notificationId = req.params.id
    const userId = req.user.id

    if (!Array.isArray(db.data.Notifications)) {
        db.data.Notifications = []
    }

    const notification = db.data.Notifications.find(n => n.id === notificationId && n.userId === userId)
    if (!notification) {
        return res.status(404).json({ error: 'Notification not found' })
    }

    notification.read = true
    await db.write()

    res.json({ ok: true, notification })
})

// Delete notification
app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
    await db.read()
    const notificationId = req.params.id
    const userId = req.user.id

    if (!Array.isArray(db.data.Notifications)) {
        db.data.Notifications = []
    }

    const idx = db.data.Notifications.findIndex(n => n.id === notificationId && n.userId === userId)
    if (idx === -1) {
        return res.status(404).json({ error: 'Notification not found' })
    }

    db.data.Notifications.splice(idx, 1)
    await db.write()

    res.json({ ok: true })
})

// Mark all notifications as read
app.patch('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
    await db.read()
    const userId = req.user.id

    if (!Array.isArray(db.data.Notifications)) {
        db.data.Notifications = []
    }

    const userNotifications = db.data.Notifications.filter(n => n.userId === userId)
    userNotifications.forEach(n => n.read = true)

    await db.write()
    res.json({ ok: true, count: userNotifications.length })
})


// get single submission (owner or admin)
app.get('/api/submissions/:id', async (req, res) => {
    await db.read()
    const sub = db.data.Submissions.find(s => s.id === req.params.id)
    if (!sub) return res.status(404).json({ error: 'Not found' })

    // For approved submissions, allow public access
    if (sub.status === 'approved') {
        return res.json(sub)
    }

    // For pending/declined, require auth (reuse cookie-based verifier)
    const data = verifyTokenFromReq(req)
    if (!data) return res.status(403).json({ error: 'Forbidden' })

    // Allow owner or admin
    if (data.role !== 'admin' && data.id !== sub.userId) {
        return res.status(403).json({ error: 'Forbidden' })
    }

    res.json(sub)
})

// admin action approve/decline
app.post('/api/submissions/:id/action', requireAdmin, async (req, res) => {
    await db.read()
    const { action, comment, points } = req.body
    const sub = db.data.Submissions.find(s => s.id === req.params.id)
    if (!sub) return res.status(404).json({ error: 'Not found' })
    if (!['approve', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' })
    const prevStatus = sub.status
    sub.status = action === 'approve' ? 'approved' : 'declined'
    // only set adminComment if provided
    if (comment && comment.trim()) sub.adminComment = comment
    sub.adminId = req.user.id
    sub.updatedAt = new Date().toISOString()

    const user = db.data.Users.find(u => u.id === sub.userId)
    if (user) {
        // award points when transitioning to approved (only once)
        if (action === 'approve' && prevStatus !== 'approved') {
            // determine points to award (default 1000)
            let pts = 1000
            if (typeof points !== 'undefined') {
                const p = parseInt(points, 10)
                if (!isNaN(p) && p >= 0) pts = p
            }
            user.points = (user.points || 0) + pts
            sub.pointsAwarded = pts

            // Add experience for approved planting
            await db.write()
            const xpResult = await addExperience(user.id, 50, 'approved_planting')

            // Update streak
            const streakResult = await updateStreak(user.id)
            if (streakResult.streakContinued && streakResult.currentStreak > 1) {
                console.log(`User ${user.name} streak: ${streakResult.currentStreak} days`)
            }
            if (streakResult.bonusAwarded > 0) {
                console.log(`User ${user.name} earned streak bonus: +${streakResult.bonusAwarded} points`)
            }

            // Check for new achievements
            const newAchievements = await checkAchievements(user.id)
            if (newAchievements.length > 0) {
                console.log(`User ${user.name} earned ${newAchievements.length} new achievement(s)`)
                // Create notification for each achievement
                for (const achievement of newAchievements) {
                    const ach = db.data.Achievements.find(a => a.id === achievement.achievementId)
                    if (ach) {
                        await createNotification(
                            user.id,
                            'achievement_unlocked',
                            '🏆 Новое достижение!',
                            `Вы получили достижение "${ach.title}"! +${ach.points} баллов`
                        )
                    }
                }
            }

            if (xpResult.leveledUp) {
                console.log(`User ${user.name} leveled up to level ${xpResult.newLevel}!`)
                // Create level up notification
                await createNotification(
                    user.id,
                    'level_up',
                    '⭐ Повышение уровня!',
                    `Поздравляем! Вы достигли ${xpResult.newLevel} уровня! +${xpResult.bonusPoints} баллов`
                )
            }

            // Create approval notification
            await createNotification(
                user.id,
                'submission_approved',
                '✅ Посадка одобрена!',
                `Ваша посадка "${sub.title}" была одобрена. +${pts} баллов`
            )
        } else if (action === 'decline' && prevStatus !== 'declined') {
            // When transitioning to declined, reduce trust rating
            user.declinedCount = (user.declinedCount || 0) + 1
            // Reduce trust rating by 1 for each decline, min 0
            user.trustRating = Math.max(0, (user.trustRating || 10) - 1)
            user.lastTrustRecovery = new Date().toISOString()

            // Create decline notification
            await createNotification(
                user.id,
                'submission_declined',
                '❌ Посадка отклонена',
                `Ваша посадка "${sub.title}" была отклонена${sub.adminComment ? ': ' + sub.adminComment : ''}`
            )
        }
    }

    await db.write()
    res.json({ ok: true, submission: sub })
})

// get my submissions
app.get('/api/mySubmissions', requireAuth, async (req, res) => {
    await db.read()
    const subs = db.data.Submissions.filter(s => s.userId === req.user.id)
    res.json(subs)
})

// Get ranking by city
app.get('/api/ranking/city/:city', async (req, res) => {
    await db.read()
    const city = req.params.city

    let users = db.data.Users.filter(u => (u.city || 'Unknown') === city && u.role === 'user')

    // Recover trust ratings and calculate scores
    users = users.map(u => {
        recoverTrustRating(u)
        return {
            id: u.id,
            name: u.name,
            city: u.city || 'Unknown',
            points: u.points || 0,
            trustRating: u.trustRating || 10,
            rankScore: calculateRankScore(u)
        }
    })

    // Sort by rank score
    users.sort((a, b) => b.rankScore - a.rankScore)

    // Add rank position
    const ranked = users.map((u, idx) => ({ ...u, rank: idx + 1 }))

    res.json(ranked)
})

// Get global ranking
app.get('/api/ranking/global', async (req, res) => {
    await db.read()

    let users = db.data.Users.filter(u => u.role === 'user')

    // Recover trust ratings and calculate scores
    users = users.map(u => {
        recoverTrustRating(u)
        return {
            id: u.id,
            name: u.name,
            city: u.city || 'Unknown',
            points: u.points || 0,
            trustRating: u.trustRating || 10,
            rankScore: calculateRankScore(u)
        }
    })

    // Sort by rank score
    users.sort((a, b) => b.rankScore - a.rankScore)

    // Add rank position
    const ranked = users.map((u, idx) => ({ ...u, rank: idx + 1 }))

    res.json(ranked)
})

// Get user rank info (needs auth)
app.get('/api/my-rank', requireAuth, async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Recover trust rating
    recoverTrustRating(user)

    // Get city rank
    let cityUsers = db.data.Users.filter(u => (u.city || 'Unknown') === (user.city || 'Unknown') && u.role === 'user')
    cityUsers = cityUsers.map(u => ({ ...u, rankScore: calculateRankScore(u) }))
    cityUsers.sort((a, b) => b.rankScore - a.rankScore)
    const cityRank = cityUsers.findIndex(u => u.id === user.id) + 1

    // Get global rank
    let globalUsers = db.data.Users.filter(u => u.role === 'user')
    globalUsers = globalUsers.map(u => ({ ...u, rankScore: calculateRankScore(u) }))
    globalUsers.sort((a, b) => b.rankScore - a.rankScore)
    const globalRank = globalUsers.findIndex(u => u.id === user.id) + 1

    res.json({
        city: user.city || 'Unknown',
        points: user.points || 0,
        trustRating: user.trustRating || 10,
        declinedCount: user.declinedCount || 0,
        cityRank,
        globalRank,
        cityUsersCount: cityUsers.length,
        globalUsersCount: globalUsers.length,
        rankScore: calculateRankScore(user)
    })
})

// Multer error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err)
        return res.status(400).json({ error: 'File upload error: ' + err.message })
    } else if (err) {
        console.error('Unexpected error:', err)
        return res.status(500).json({ error: 'Server error: ' + err.message })
    }
    next()
})

app.listen(port, '0.0.0.0', () => console.log('http://localhost:' + port))