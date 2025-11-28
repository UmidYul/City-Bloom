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
const Defaultdata = { Users: [], Submissions: [], Products: [], PromoCodes: [] }
const db = new Low(adapter, Defaultdata)

const JWT_SECRET = 'UMIDSECRETKEY'

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(express.static(join(__dirname, 'public')))

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
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }) // 200MB

async function initDb() {
    await db.read()
    db.data ||= { Users: [], Submissions: [], Products: [], PromoCodes: [] }

    // ensure all users have required fields
    if (Array.isArray(db.data.Users)) {
        for (const u of db.data.Users) {
            if (typeof u.points !== 'number') u.points = 0
            if (typeof u.trustRating !== 'number') u.trustRating = 5 // Стартовый рейтинг для новичков, макс 10
            if (typeof u.declinedCount !== 'number') u.declinedCount = 0
            if (!u.city) u.city = 'Unknown'
            if (!u.lastTrustRecovery) u.lastTrustRecovery = new Date().toISOString()
        }
    }

    // ensure Products and PromoCodes arrays exist
    if (!Array.isArray(db.data.Products)) db.data.Products = []
    if (!Array.isArray(db.data.PromoCodes)) db.data.PromoCodes = []

    // ensure there's at least one admin for testing
    const hasAdmin = db.data.Users.some(u => u.role === 'admin')
    if (!hasAdmin) {
        const passwordHash = await bcrypt.hash('admin', 10)
        db.data.Users.push({ id: uuidv4(), name: 'Administrator', phone: 'admin', password: passwordHash, role: 'admin', points: 0, trustRating: 10, city: 'Admin', declinedCount: 0, lastTrustRecovery: new Date().toISOString() })
        await db.write()
        console.log('Created default admin: phone=admin password=admin')
    }
}

initDb().catch(err => console.error('DB init error', err))

// serve pages
app.get('/', (req, res) => res.sendFile(join(__dirname, 'views', 'main.html')))
app.get('/profile/:id', (req, res) => res.sendFile(join(__dirname, 'views', 'profile.html')))
app.get('/ranking', (req, res) => res.sendFile(join(__dirname, 'views', 'ranking.html')))
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

// Trust rating recovery function - recovers 1 point every 7 days
function recoverTrustRating(user) {
    if (!user) return
    if ((user.trustRating || 10) >= 10) return // Max is 10

    const lastRecovery = new Date(user.lastTrustRecovery || new Date())
    const now = new Date()
    const daysPassed = Math.floor((now - lastRecovery) / (1000 * 60 * 60 * 24))

    if (daysPassed >= 7) {
        const recoveredPoints = Math.floor(daysPassed / 7)
        user.trustRating = Math.min(10, (user.trustRating || 0) + recoveredPoints)
        user.lastTrustRecovery = new Date().toISOString()
        return true
    }
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
        name: name || '',
        phone,
        password: hash,
        role: 'user',
        points: 0,
        city: city || 'Unknown',
        trustRating: 5,
        declinedCount: 0,
        lastTrustRecovery: new Date().toISOString()
    }
    db.data.Users.push(user)
    await db.write()
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
        declinedCount: user.declinedCount || 0
    }
    res.json(out)
})

// mobile-friendly profile payload
app.get('/user/profile', requireAuth, async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // recover trust before calculating
    recoverTrustRating(user)

    const submissions = (db.data.Submissions || []).filter(s => s.userId === user.id)
    const approved = submissions.filter(s => s.status === 'approved')

    // derive simple stats
    const treesPlanted = approved.length
    const careActions = submissions.length
    const impactArea = Math.max(240, treesPlanted * 20)

    // assign a few lightweight badges
    const badges = [
        {
            id: 'guardian',
            title: 'Forest Guardian',
            description: 'Посадите 5 деревьев, чтобы заслужить этот знак',
            icon: '🌳',
            earned: treesPlanted >= 5,
            achievedAt: treesPlanted >= 5 ? new Date().toISOString() : null
        },
        {
            id: 'care',
            title: 'Care Keeper',
            description: 'Совершайте действия по уходу за зеленью',
            icon: '🪴',
            earned: careActions >= 10,
            achievedAt: careActions >= 10 ? new Date().toISOString() : null
        },
        {
            id: 'impact',
            title: 'Impact Starter',
            description: 'Создайте видимый вклад в площадь города',
            icon: '✨',
            earned: impactArea >= 300,
            achievedAt: impactArea >= 300 ? new Date().toISOString() : null
        }
    ]

    // map submissions to an activity feed
    const recentActivities = submissions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map(sub => ({
            id: sub.id,
            title: sub.title || 'Tree planted',
            type: sub.status || 'pending',
            timestamp: sub.createdAt,
            xp: sub.status === 'approved' ? 50 : 15,
            icon: sub.status === 'approved' ? '✅' : '🕓'
        }))

    res.json({
        id: user.id,
        name: user.name || 'Eco hero',
        role: user.role || 'user',
        avatar_url: user.avatarUrl || '',
        eco_points: user.points || 0,
        stats: {
            trees_planted: treesPlanted,
            care_actions: careActions,
            impact_area: impactArea
        },
        badges,
        recent_activities: recentActivities
    })
})

// get user public profile
app.get('/api/users/:id', async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'Not found' })
    console.log(user);

    const out = { id: user.id, name: user.name, phone: user.phone, role: user.role, city: user.city || 'Unknown', trustRating: user.trustRating || 10, points: user.points || 0 }
    res.json(out)
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
    await db.read()
    const { title, plantType, description, lat, lng, location } = req.body
    const files = req.files || {}
    const beforeFile = files.beforeVideo && files.beforeVideo[0] ? '/uploads/' + files.beforeVideo[0].filename : null
    const afterFile = files.afterVideo && files.afterVideo[0] ? '/uploads/' + files.afterVideo[0].filename : null
    const loc = (lat && lng) ? { lat: parseFloat(lat), lng: parseFloat(lng) } : (location || '')
    const submission = {
        id: uuidv4(), userId: req.user.id, title: title || '', plantType: plantType || '', location: loc, description: description || '', beforeVideo: beforeFile, afterVideo: afterFile, status: 'pending', createdAt: new Date().toISOString(), adminComment: null
    }
    db.data.Submissions.push(submission)
    await db.write()
    res.json({ ok: true, submission })
})

// get submissions (admin)
app.get('/api/submissions', requireAdmin, async (req, res) => {
    await db.read()
    res.json(db.data.Submissions)
})

// products - public listing (only with quantity > 0)
app.get('/api/products', async (req, res) => {
    await db.read()
    const products = (db.data.Products || []).filter(p => (p.quantity || 0) > 0)
    res.json(products)
})

// products - admin listing (with all products including 0 quantity)
app.get('/api/products/admin/list', requireAdmin, async (req, res) => {
    await db.read()
    res.json(db.data.Products || [])
})

// admin: create product (with icon upload)
app.post('/api/products', requireAdmin, upload.single('icon'), async (req, res) => {
    try {
        console.log('POST /api/products - User:', req.user)
        console.log('Body:', req.body)
        console.log('File:', req.file)

        await db.read()
        const { title, price, organization, validDays, quantity } = req.body
        if (!title || !price) return res.status(400).json({ error: 'title and price required' })
        const icon = req.file ? '/uploads/' + req.file.filename : null
        const p = { id: uuidv4(), title, price: parseInt(price, 10) || 0, organization: organization || '', validDays: parseInt(validDays, 10) || 30, quantity: parseInt(quantity, 10) || 0, icon, createdAt: new Date().toISOString() }
        db.data.Products.push(p)
        await db.write()
        console.log('Product created:', p)
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
        if (title) p.title = title
        if (typeof price !== 'undefined') p.price = parseInt(price, 10) || 0
        if (organization) p.organization = organization
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
        id: uuidv4(), code, userId: user.id, productId: prod.id, productTitle: prod.title, organization: prod.organization || '', createdAt: now.toISOString(), expiresAt: expires.toISOString()
    }
    db.data.PromoCodes = db.data.PromoCodes || []
    db.data.PromoCodes.push(promo)
    await db.write()
    res.json({ ok: true, promo })
})

// get my promo codes
app.get('/api/myPromos', requireAuth, async (req, res) => {
    await db.read()
    const list = (db.data.PromoCodes || []).filter(p => p.userId === req.user.id)
    res.json(list)
})

// get single submission (owner or admin)
app.get('/api/submissions/:id', requireAuth, async (req, res) => {
    await db.read()
    const sub = db.data.Submissions.find(s => s.id === req.params.id)
    if (!sub) return res.status(404).json({ error: 'Not found' })
    // allow owner or admin
    const requester = req.user
    if (requester.role !== 'admin' && requester.id !== sub.userId) return res.status(403).json({ error: 'Forbidden' })
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
        } else if (action === 'decline' && prevStatus !== 'declined') {
            // When transitioning to declined, reduce trust rating
            user.declinedCount = (user.declinedCount || 0) + 1
            // Reduce trust rating by 1 for each decline, min 0
            user.trustRating = Math.max(0, (user.trustRating || 10) - 1)
            user.lastTrustRecovery = new Date().toISOString()
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

app.listen(port, () => console.log('http://localhost:' + port))