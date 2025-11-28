document.addEventListener('DOMContentLoaded', async () => {
    const cityTab = document.getElementById('cityTab')
    const globalTab = document.getElementById('globalTab')
    const tabCity = document.getElementById('tabCity')
    const tabGlobal = document.getElementById('tabGlobal')
    const cityRanking = document.getElementById('cityRanking')
    const globalRanking = document.getElementById('globalRanking')
    const cityName = document.getElementById('cityName')
    const userStats = document.getElementById('userStats')

    let currentCity = 'Unknown'

    // Load user navigation
    try {
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
            const me = await meRes.json()
            document.getElementById('navLinks').innerHTML = `<a href="/">Главная</a> • <a href="/exchange">Магазин</a> • <a href="/profile/${me.id}">Профиль</a> • <form style="display:inline" action="/logout" method="post"><button style="background:none;border:none;color:#06c;cursor:pointer;padding:0">Выйти</button></form>`
        }
    } catch (err) {
        console.error('Failed to load user:', err)
    }

    // Tab switching
    tabCity.onclick = () => {
        cityTab.style.display = ''
        globalTab.style.display = 'none'
        tabCity.style.background = '#4CAF50'
        tabCity.style.color = 'white'
        tabGlobal.style.background = ''
        tabGlobal.style.color = ''
    }

    tabGlobal.onclick = () => {
        cityTab.style.display = 'none'
        globalTab.style.display = ''
        tabCity.style.background = ''
        tabCity.style.color = ''
        tabGlobal.style.background = '#4CAF50'
        tabGlobal.style.color = 'white'
    }

    // Load user stats
    async function loadUserStats() {
        try {
            const res = await fetch('/api/my-rank')
            if (!res.ok) {
                // User not authenticated, hide stats
                userStats.style.display = 'none'
                return
            }
            const data = await res.json()
            currentCity = data.city
            cityName.textContent = `Рейтинг города: ${data.city}`

            document.getElementById('userPoints').textContent = data.points.toLocaleString()
            document.getElementById('userTrust').textContent = `${data.trustRating}/10`
            document.getElementById('userCityRank').textContent = `${data.cityRank}/${data.cityUsersCount}`
            document.getElementById('userGlobalRank').textContent = `${data.globalRank}/${data.globalUsersCount}`

            userStats.style.display = ''
        } catch (err) {
            console.error('Error loading user stats:', err)
            userStats.style.display = 'none'
        }
    }

    // Load city ranking
    async function loadCityRanking() {
        cityRanking.innerHTML = 'Загрузка...'
        try {
            const res = await fetch(`/api/ranking/city/${encodeURIComponent(currentCity)}`)
            if (!res.ok) throw new Error('Failed to load ranking')
            const ranking = await res.json()
            renderRanking(ranking, cityRanking)
        } catch (err) {
            cityRanking.innerHTML = '<p style="color:red">Ошибка загрузки рейтинга: ' + err.message + '</p>'
        }
    }

    // Load global ranking
    async function loadGlobalRanking() {
        globalRanking.innerHTML = 'Загрузка...'
        try {
            const res = await fetch('/api/ranking/global')
            if (!res.ok) throw new Error('Failed to load ranking')
            const ranking = await res.json()
            renderRanking(ranking, globalRanking)
        } catch (err) {
            globalRanking.innerHTML = '<p style="color:red">Ошибка загрузки рейтинга: ' + err.message + '</p>'
        }
    }

    // Render ranking
    function renderRanking(ranking, container) {
        container.innerHTML = ''
        if (!ranking || ranking.length === 0) {
            container.innerHTML = '<div class="muted">Пока нет пользователей в этом рейтинге</div>'
            return
        }

        for (const user of ranking) {
            const card = document.createElement('div')
            card.style.cssText = `padding:14px;border:1px solid #e6e9ef;border-radius:8px;display:grid;grid-template-columns:50px 1fr auto;gap:12px;align-items:center`

            // Rank badge
            const rankBadge = document.createElement('div')
            let badgeColor = '#ccc'
            let badgeText = '🥉'

            if (user.rank === 1) {
                badgeColor = '#FFD700'
                badgeText = '🥇'
            } else if (user.rank === 2) {
                badgeColor = '#C0C0C0'
                badgeText = '🥈'
            }

            rankBadge.style.cssText = `
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:1.5rem;
                font-weight:700;
                color:${badgeColor};
                text-align:center;
            `
            rankBadge.textContent = user.rank <= 3 ? badgeText : `#${user.rank}`

            // Info
            const info = document.createElement('div')
            info.innerHTML = `
                <div style="font-weight:700">${user.name}</div>
                <div class="muted" style="font-size:0.9rem">${user.city}</div>
                <div style="margin-top:4px;font-size:0.85rem">
                    <span style="color:#4CAF50">💚 ${user.points}</span>
                    <span style="margin-left:12px;color:#2196F3">⭐ ${user.trustRating}/10</span>
                </div>
            `

            // Score
            const score = document.createElement('div')
            score.style.cssText = `
                text-align:right;
                padding:8px 12px;
                background:#f1f5f9;
                border-radius:6px;
            `
            score.innerHTML = `
                <div style="font-weight:700;font-size:1.2rem;color:#4CAF50">${Math.round(user.rankScore)}</div>
                <div class="muted" style="font-size:0.8rem">Рейтинг</div>
            `

            card.appendChild(rankBadge)
            card.appendChild(info)
            card.appendChild(score)
            container.appendChild(card)
        }
    }

    // Initial load
    await loadUserStats()
    await loadCityRanking()
    await loadGlobalRanking()
})
