// Profile loader - supports /profile (own) and /profile/:id (public)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const parts = location.pathname.split('/')
        const id = parts[parts.length - 1]

        let user = null
        let own = false

        // If visiting /profile or no id provided, load current user
        if (!id || id === 'profile') {
            const meRes = await fetch('/api/me')
            if (!meRes.ok) {
                setText('name', 'Пользователь не найден')
                return
            }
            user = await meRes.json()
            own = true
        } else {
            // try to load public profile by id
            const res = await fetch('/api/users/' + encodeURIComponent(id))
            if (res.ok) {
                user = await res.json()
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

        console.log('Loaded profile user:', user)

        // Hide logout form if viewing another user's public profile
        try {
            const logoutForm = document.getElementById('logoutForm')
            if (logoutForm && !own) logoutForm.style.display = 'none'
        } catch (e) {
            // ignore
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
        }
    } catch (err) {
        console.error(err)
        setText('name', 'Ошибка при загрузке профиля')
    }
})

function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
}
