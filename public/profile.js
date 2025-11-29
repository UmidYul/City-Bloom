// Profile loader - supports /profile (own) and /profile/:id (public)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const parts = location.pathname.split('/').filter(p => p) // remove empty parts
        const lastPart = parts[parts.length - 1]

        console.log('Path parts:', parts, 'Last part:', lastPart)

        let user = null
        let own = false

        // If visiting /profile or no specific id, load current user
        if (!lastPart || lastPart === 'profile') {
            console.log('Loading own profile...')
            const meRes = await fetch('/api/me')
            if (!meRes.ok) {
                setText('name', 'Пользователь не найден')
                return
            }
            user = await meRes.json()
            own = true
        } else {
            // try to load public profile by id
            console.log('Loading public profile:', lastPart)
            const res = await fetch('/api/users/' + encodeURIComponent(lastPart))
            if (res.ok) {
                user = await res.json()
                // Check if it's actually our own profile
                const meRes = await fetch('/api/me')
                if (meRes.ok) {
                    const me = await meRes.json()
                    if (me.id === user.id) {
                        own = true
                    }
                }
            } else {
                // fallback: if user is authenticated, load own profile
                const meRes = await fetch('/api/me')
                if (meRes.ok) {
                    user = await meRes.json()
                    own = true
                } else {
                    setText('name', 'Пользователь не найден')
                    return
                }
            }
        }

        console.log('Loaded profile user:', user, 'Own profile:', own)

        // Setup action buttons based on profile type
        const actionButtons = document.getElementById('actionButtons')
        if (actionButtons) {
            if (own) {
                // Own profile - show statistics, logout and shop buttons
                actionButtons.innerHTML = `
                    <a href="/statistics" style="text-decoration:none;margin-bottom:12px;display:block">
                        <button type="button" class="secondary" style="width:100%">📊 Моя статистика</button>
                    </a>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <a href="/exchange" style="text-decoration:none">
                            <button type="button" class="secondary" style="width:100%">🛍️ Магазин</button>
                        </a>
                        <button type="button" id="logoutBtn" style="width:100%">🚪 Выйти</button>
                    </div>
                `
                // Setup logout handler
                setTimeout(() => {
                    const logoutBtn = document.getElementById('logoutBtn')
                    if (logoutBtn) {
                        logoutBtn.onclick = async () => {
                            const res = await fetch('/logout', { method: 'POST' })
                            if (res.ok) location.href = '/login'
                        }
                    }
                }, 100)
            } else {
                // Public profile - show back button
                actionButtons.innerHTML = `
                    <a href="/" style="text-decoration:none">
                        <button type="button" style="width:100%">← Вернуться</button>
                    </a>
                `
            }
        }

        // Populate profile header
        setText('name', user.name || '(no name)')

        // Role badge
        const roleBadge = document.getElementById('roleBadge')
        if (roleBadge && user.role) {
            roleBadge.className = 'badge'
            roleBadge.textContent = user.role === 'admin' ? 'Администратор' : 'Пользователь'
        }

        // City
        if (user.city) {
            setText('city', `📍 ${user.city}`)
        }

        // Points
        if (typeof user.points !== 'undefined') {
            setText('points', (user.points || 0).toLocaleString())
        }

        // Trust rating with progress bar
        if (typeof user.trustRating !== 'undefined') {
            const rating = user.trustRating || 0
            setText('trustRating', `${rating}/10`)
            const trustBar = document.getElementById('trustBar')
            if (trustBar) {
                trustBar.style.width = `${(rating / 10) * 100}%`
            }
        }

        // Level and Experience
        if (typeof user.level !== 'undefined') {
            const level = user.level || 1
            const experience = user.experience || 0

            setText('levelNumber', level)
            setText('levelName', getLevelName(level))

            // Set level icon
            const levelIcon = document.getElementById('levelIcon')
            if (levelIcon) {
                levelIcon.textContent = getLevelIcon(level)
            }

            // Calculate XP progress
            const currentLevelXP = getXPForLevel(level)
            const nextLevelXP = getXPForLevel(level + 1)
            const xpInCurrentLevel = experience - currentLevelXP
            const xpNeededForNextLevel = nextLevelXP - currentLevelXP
            const xpProgress = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNextLevel) * 100))

            const xpBar = document.getElementById('xpBar')
            if (xpBar) {
                xpBar.style.width = `${xpProgress}%`
            }

            setText('xpText', `${xpInCurrentLevel} / ${xpNeededForNextLevel} XP`)
        }

        // Display streak information
        if (typeof user.currentStreak !== 'undefined') {
            setText('currentStreak', `${user.currentStreak} days`)
        }
        if (typeof user.longestStreak !== 'undefined') {
            setText('longestStreak', `${user.longestStreak} days`)
        }

        // Load ranking info (use authenticated endpoint for own profile)
        try {
            let rankData = null
            if (own) {
                const myRankRes = await fetch('/api/my-rank')
                if (myRankRes.ok) rankData = await myRankRes.json()
            } else {
                const rankRes = await fetch('/api/users/' + encodeURIComponent(user.id) + '/rank')
                if (rankRes.ok) rankData = await rankRes.json()
            }
            if (rankData) {
                setText('cityRank', `#${rankData.cityRank}/${rankData.cityUsersCount}`)
                setText('globalRank', `#${rankData.globalRank}/${rankData.globalUsersCount}`)
            }
        } catch (err) {
            console.error('Failed to load rank info:', err)
        }

        // show counts instead of full list (only for own profile)
        if (own) {
            try {
                const myRes = await fetch('/api/mySubmissions')
                if (myRes.ok) {
                    const subs = await myRes.json()
                    const approved = subs.filter(s => s.status === 'approved')
                    setText('approvedCount', approved.length)
                    setText('totalCount', subs.length)
                }
            } catch (err) {
                console.error('Failed to load submissions', err)
            }

            // Load achievement preview
            try {
                const achRes = await fetch('/api/my-achievements')
                if (achRes.ok) {
                    const achievements = await achRes.json()
                    renderAchievementPreview(achievements)
                }
            } catch (err) {
                console.error('Failed to load achievements', err)
            }
        }
    } catch (err) {
        console.error(err)
        setText('name', 'Ошибка при загрузке профиля')
    }

    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn')
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Вы уверены что хотите выйти?')) return

            try {
                const res = await fetch('/logout', { method: 'POST' })
                if (res.ok) {
                    window.location.href = '/login'
                } else {
                    alert('Ошибка выхода')
                }
            } catch (err) {
                console.error('Logout error:', err)
                alert('Ошибка выхода')
            }
        })
    }
})

function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
}

function renderAchievementPreview(achievements) {
    const container = document.getElementById('achievementPreview')
    if (!container || !achievements || achievements.length === 0) return

    // Take first 4 achievements (or all if less than 4)
    const preview = achievements.slice(0, 4)

    let html = ''
    preview.forEach(ach => {
        const badgeClass = ach.earned ? 'achievement-badge' : 'achievement-badge locked'
        html += `
        <div class="${badgeClass}" title="${ach.title}: ${ach.description}">
            <span>${ach.icon}</span>
        </div>
        `
    })

    container.innerHTML = html
}

// Level system helper functions
const LEVEL_XP_REQUIREMENTS = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
    5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000
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

const LEVEL_ICONS = {
    1: '🌱', 2: '🪴', 3: '🌿', 4: '🌳', 5: '🌲',
    6: '🏞️', 7: '⭐', 8: '👑', 9: '🏆', 10: '💎'
}

function getXPForLevel(level) {
    if (level <= 0) return 0
    if (level <= LEVEL_XP_REQUIREMENTS.length) return LEVEL_XP_REQUIREMENTS[level - 1]
    const baseXP = LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1]
    const additionalLevels = level - LEVEL_XP_REQUIREMENTS.length
    return baseXP + (additionalLevels * 2000)
}

function getLevelName(level) {
    if (level <= 10) return LEVEL_NAMES[level] || 'Мастер'
    return `Мастер ${level}`
}

function getLevelIcon(level) {
    if (level <= 10) return LEVEL_ICONS[level] || '🌱'
    return '💫'
}
