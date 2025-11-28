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
    db.data ||= { Users: [], Submissions: [] }

    // ensure all users have points field
    if (Array.isArray(db.data.Users)) {
        for (const u of db.data.Users) {
            if (typeof u.points !== 'number') u.points = 0
        }
    }

    // ensure there's at least one admin for testing
    const hasAdmin = db.data.Users.some(u => u.role === 'admin')
    if (!hasAdmin) {
        const passwordHash = await bcrypt.hash('admin', 10)
        db.data.Users.push({ id: uuidv4(), name: 'Administrator', phone: 'admin', password: passwordHash, role: 'admin' })
        await db.write()
        console.log('Created default admin: phone=admin password=admin')
    }
}

initDb().catch(err => console.error('DB init error', err))

// serve pages
app.get('/', (req, res) => res.sendFile(join(__dirname, 'views', 'main.html')))
app.get('/profile/:id', (req, res) => res.sendFile(join(__dirname, 'views', 'profile.html')))
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'views', 'admin.html')))
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

// API
app.post('/registration', async (req, res) => {
    await db.read()
    const { name, phone, password } = req.body
    if (!phone || !password) return res.status(400).json({ error: 'phone and password required' })
    const exists = db.data.Users.find(u => u.phone === phone)
    if (exists) return res.status(400).json({ error: 'User exists' })
    const hash = await bcrypt.hash(password, 10)
    const user = { id: uuidv4(), name: name || '', phone, password: hash, role: 'user', points: 0 }
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
    const out = { id: user.id, name: user.name, phone: user.phone, role: user.role, points: user.points || 0 }
    res.json(out)
})

// get user public profile
app.get('/api/users/:id', async (req, res) => {
    await db.read()
    const user = db.data.Users.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'Not found' })
    const out = { id: user.id, name: user.name, phone: user.phone, role: user.role }
    res.json(out)
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

// products - public listing
app.get('/api/products', async (req, res) => {
    await db.read()
    res.json(db.data.Products || [])
})

// admin: create product (with icon upload)
app.post('/api/products', requireAdmin, upload.single('icon'), async (req, res) => {
    await db.read()
    const { title, price, organization, validDays } = req.body
    if (!title || !price) return res.status(400).json({ error: 'title and price required' })
    const icon = req.file ? '/uploads/' + req.file.filename : null
    const p = { id: uuidv4(), title, price: parseInt(price, 10) || 0, organization: organization || '', validDays: parseInt(validDays, 10) || 30, icon, createdAt: new Date().toISOString() }
    db.data.Products.push(p)
    await db.write()
    res.json({ ok: true, product: p })
})

// admin: update product (optional icon upload)
app.put('/api/products/:id', requireAdmin, upload.single('icon'), async (req, res) => {
    await db.read()
    const p = db.data.Products.find(x => x.id === req.params.id)
    if (!p) return res.status(404).json({ error: 'Not found' })
    const { title, price, organization, validDays } = req.body
    if (title) p.title = title
    if (typeof price !== 'undefined') p.price = parseInt(price, 10) || 0
    if (organization) p.organization = organization
    if (typeof validDays !== 'undefined') p.validDays = parseInt(validDays, 10) || p.validDays
    if (req.file) p.icon = '/uploads/' + req.file.filename
    p.updatedAt = new Date().toISOString()
    await db.write()
    res.json({ ok: true, product: p })
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
    const user = db.data.Users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const price = prod.price || 0
    if ((user.points || 0) < price) return res.status(400).json({ error: 'Not enough points' })
    // deduct points
    user.points = (user.points || 0) - price

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

    // award points when transitioning to approved (only once)
    if (action === 'approve' && prevStatus !== 'approved') {
        // determine points to award (default 1000)
        let pts = 1000
        if (typeof points !== 'undefined') {
            const p = parseInt(points, 10)
            if (!isNaN(p) && p >= 0) pts = p
        }
        const user = db.data.Users.find(u => u.id === sub.userId)
        if (user) {
            user.points = (user.points || 0) + pts
            sub.pointsAwarded = pts
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

app.listen(port, () => console.log('http://localhost:' + port))