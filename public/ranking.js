document.addEventListener('DOMContentLoaded', async () => {
    let currentScope = 'city'
    let currentPeriod = 'all'
    let currentUser = null
    let currentCity = 'Unknown'

    // Load current user
    try {
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
            currentUser = await meRes.json()
            currentCity = currentUser.city || 'Unknown'
        }
    } catch (err) {
        console.error('Failed to load user:', err)
    }

    // Period pill buttons
    const periodPills = document.querySelectorAll('.pill[data-period]')
    periodPills.forEach(pill => {
        pill.addEventListener('click', () => {
            periodPills.forEach(p => p.classList.remove('active'))
            pill.classList.add('active')
            currentPeriod = pill.dataset.period
            loadRanking()
        })
    })

    // Scope segment control
    const scopeButtons = document.querySelectorAll('.segment-control button[data-scope]')
    scopeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            scopeButtons.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            currentScope = btn.dataset.scope
            updateLocationLabel()
            loadRanking()
        })
    })

    // Update location label
    function updateLocationLabel() {
        const locationLabel = document.getElementById('locationLabel')
        if (!locationLabel) return

        if (currentScope === 'city') {
            locationLabel.textContent = `🏙️ ${currentCity}`
        } else {
            locationLabel.textContent = '🌍 Узбекистан'
        }
    }

    // Load ranking data
    async function loadRanking() {
        const top3Container = document.getElementById('top3')
        const restList = document.getElementById('restList')

        // Show loading
        top3Container.innerHTML = '<div class="muted text-center">Loading...</div>'
        restList.innerHTML = ''

        try {
            let url = currentScope === 'city'
                ? `/api/ranking/city/${encodeURIComponent(currentCity)}`
                : '/api/ranking/global'

            const res = await fetch(url)
            if (!res.ok) throw new Error('Failed to load ranking')

            const ranking = await res.json()

            if (!ranking || ranking.length === 0) {
                top3Container.innerHTML = '<div class="muted text-center">No data yet</div>'
                restList.innerHTML = '<div class="muted text-center" style="padding:20px">No users in this ranking</div>'
                return
            }

            // Render top 3
            renderTop3(ranking.slice(0, 3), top3Container)

            // Render rest
            renderRestList(ranking.slice(3), restList)

            // Show user card if authenticated
            if (currentUser) {
                const userRankData = ranking.find(u => u.id === currentUser.id)
                if (userRankData) {
                    showYouCard(userRankData)
                }
            }
        } catch (err) {
            console.error('Error loading ranking:', err)
            top3Container.innerHTML = '<div style="color:#b00020;text-center">Error loading data</div>'
        }
    }

    function renderTop3(top3, container) {
        if (!top3 || top3.length === 0) {
            container.innerHTML = '<div class="muted">Пока нет пользователей</div>'
            return
        }

        // Reorder for podium: 2nd, 1st, 3rd (only if we have at least 2 users)
        let podium
        if (top3.length === 1) {
            // Just show the single user in first place
            podium = [top3[0]]
        } else {
            // Reorder for visual podium
            podium = [top3[1], top3[0], top3[2]].filter(Boolean)
        }

        container.innerHTML = ''
        podium.forEach((user, idx) => {
            // If only 1 user, always position 1. Otherwise use reordered positions
            const position = podium.length === 1 ? 1 : (idx === 0 ? 2 : (idx === 1 ? 1 : 3))
            const div = document.createElement('div')
            div.style.cssText = 'flex:1;text-align:center'

            const avatarSize = position === 1 ? 'avatar-lg' : 'avatar'
            const badgeClass = position === 1 ? 'top-1' : (position === 2 ? 'top-2' : 'top-3')

            div.innerHTML = `
                <div style="position:relative;display:inline-block;margin-bottom:8px">
                    <div class="avatar ${avatarSize}" style="margin:0 auto">👤</div>
                    <div class="rank-badge ${badgeClass}" style="position:absolute;top:-6px;right:-6px">${position}</div>
                </div>
                <div style="font-weight:700;font-size:${position === 1 ? '16px' : '14px'};margin-bottom:4px">${user.name || 'Пользователь'}</div>
                <div style="font-size:${position === 1 ? '20px' : '16px'};font-weight:700;color:var(--accent)">${user.points || 0}</div>
                <div class="text-small muted">Баллов</div>
            `
            container.appendChild(div)
        })
    }

    function renderRestList(rest, container) {
        const restListCard = document.getElementById('restListCard')
        container.innerHTML = ''

        if (!rest || rest.length === 0) {
            // Hide the card if list is empty (top 3 already shown)
            if (restListCard) restListCard.style.display = 'none'
            return
        }

        // Show the card if there are users to display
        if (restListCard) restListCard.style.display = ''

        rest.forEach(user => {
            const div = document.createElement('div')
            div.className = 'leaderboard-item'

            div.innerHTML = `
                <div class="rank-badge">${user.rank}</div>
                <div class="avatar avatar-sm">👤</div>
                <div style="flex:1">
                    <div style="font-weight:600">${user.name || 'Пользователь'}</div>
                    <div class="text-small muted">${user.city || 'Неизвестно'}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-weight:700;color:var(--accent)">${user.points || 0}</div>
                    <div class="text-small muted">балл.</div>
                </div>
            `
            container.appendChild(div)
        })
    }

    function showYouCard(userData) {
        const youCard = document.getElementById('youCard')
        if (!youCard) return

        // Always show the card at the top with user's rank
        document.getElementById('yourRank').textContent = `#${userData.rank}`
        document.getElementById('yourName').textContent = userData.name || 'Вы'
        document.getElementById('yourPoints').textContent = userData.points || 0

        // Calculate delta (mock for now, would need historical data)
        const delta = '+0'
        document.getElementById('yourDelta').textContent = delta

        youCard.style.display = 'block'
    }

    // Initial load
    updateLocationLabel()
    loadRanking()
})
