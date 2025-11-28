document.addEventListener('DOMContentLoaded', async () => {
    const welcomeSection = document.getElementById('welcomeSection')
    const pointsCount = document.getElementById('pointsCount')
    const treesCount = document.getElementById('treesCount')
    const rankPosition = document.getElementById('rankPosition')
    const trustRating = document.getElementById('trustRating')
    const recentTrees = document.getElementById('recentTrees')
    const topUsers = document.getElementById('topUsers')
    const profileNavLink = document.getElementById('profileNavLink')

    let currentUser = null

    // Load user data
    try {
        const meRes = await fetch('/api/me')
        if (!meRes.ok) {
            window.location.href = '/login'
            return
        }
        currentUser = await meRes.json()

        // Update profile link
        if (profileNavLink) {
            profileNavLink.href = `/profile/${currentUser.id}`
        }

        // Render welcome section
        renderWelcome(currentUser)

        // Update stats
        pointsCount.textContent = (currentUser.points || 0).toLocaleString()
        trustRating.textContent = currentUser.trustRating || 10

        // Load user's trees
        loadRecentTrees()

        // Load rank position
        loadRankPosition()

        // Load top users
        loadTopUsers()

    } catch (err) {
        console.error('Error loading user:', err)
        welcomeSection.innerHTML = '<div style="text-align:center;color:#b00020;padding:20px">Ошибка загрузки данных</div>'
    }

    function renderWelcome(user) {
        const hour = new Date().getHours()
        let greeting = '👋 Доброе утро'
        if (hour >= 12 && hour < 18) greeting = '☀️ Добрый день'
        else if (hour >= 18) greeting = '🌙 Добрый вечер'

        welcomeSection.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px">
                <div class="avatar-lg">
                    ${user.role === 'admin' ? '👑' : '👤'}
                </div>
                <div style="flex:1">
                    <div class="text-small muted">${greeting}</div>
                    <h2 style="margin:4px 0 6px">${user.name || 'Пользователь'}</h2>
                    <div class="badge" style="display:inline-block">${user.role === 'admin' ? '👑 Администратор' : '🌱 Участник'}</div>
                    ${user.city ? `<div class="text-small muted" style="margin-top:4px">📍 ${user.city}</div>` : ''}
                </div>
            </div>
        `
    }

    async function loadRecentTrees() {
        try {
            const res = await fetch('/api/mySubmissions')
            if (!res.ok) throw new Error('Failed to load trees')

            const submissions = await res.json()
            treesCount.textContent = submissions.length

            if (!submissions || submissions.length === 0) {
                recentTrees.innerHTML = `
                    <div style="text-align:center;padding:32px 16px">
                        <div style="font-size:48px;margin-bottom:12px">🌱</div>
                        <div class="muted">Пока нет посадок</div>
                        <a href="/register-tree" class="btn" style="margin-top:16px;display:inline-block;text-decoration:none">
                            Зарегистрировать первую посадку
                        </a>
                    </div>
                `
                return
            }

            // Show last 3 trees
            const recent = submissions.slice(0, 3)
            recentTrees.innerHTML = ''

            for (const tree of recent) {
                const statusColor = tree.status === 'approved' ? 'var(--accent)' :
                    tree.status === 'rejected' ? '#b00020' :
                        'var(--text-muted)'
                const statusIcon = tree.status === 'approved' ? '✓' :
                    tree.status === 'rejected' ? '✗' :
                        '⏳'
                const statusText = tree.status === 'approved' ? 'Одобрено' :
                    tree.status === 'rejected' ? 'Отклонено' :
                        'На проверке'

                const card = document.createElement('div')
                card.className = 'card'
                card.style.marginBottom = '12px'
                card.style.cursor = 'pointer'
                card.onclick = () => window.location.href = `/submission/${tree.id}`

                const plantIcon = tree.plantType === 'tree' ? '🌳' :
                    tree.plantType === 'flower' ? '🌸' :
                        tree.plantType === 'grass' ? '🌿' : '🌱'

                card.innerHTML = `
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="font-size:32px">${plantIcon}</div>
                        <div style="flex:1">
                            <div style="font-weight:600;margin-bottom:4px">${tree.title || 'Посадка'}</div>
                            <div class="text-small muted">${new Date(tree.createdAt).toLocaleDateString('ru-RU')}</div>
                        </div>
                        <div style="text-align:right">
                            <div style="font-weight:600;color:${statusColor}">${statusIcon} ${statusText}</div>
                        </div>
                    </div>
                `
                recentTrees.appendChild(card)
            }

            if (submissions.length > 3) {
                const moreBtn = document.createElement('a')
                moreBtn.href = '/register-tree'
                moreBtn.className = 'text-small'
                moreBtn.style.cssText = 'display:block;text-align:center;margin-top:12px;color:var(--accent);text-decoration:none;font-weight:600'
                moreBtn.textContent = `Показать все (${submissions.length}) →`
                recentTrees.appendChild(moreBtn)
            }

        } catch (err) {
            console.error('Error loading trees:', err)
            recentTrees.innerHTML = '<div class="muted text-center">Ошибка загрузки посадок</div>'
        }
    }

    async function loadRankPosition() {
        try {
            if (!currentUser || !currentUser.city) {
                rankPosition.textContent = '-'
                return
            }

            const res = await fetch(`/api/ranking/city/${encodeURIComponent(currentUser.city)}`)
            if (!res.ok) throw new Error('Failed to load ranking')

            const ranking = await res.json()
            const userRank = ranking.find(u => u.id === currentUser.id)

            if (userRank) {
                rankPosition.textContent = `#${userRank.rank}`
            } else {
                rankPosition.textContent = '-'
            }

        } catch (err) {
            console.error('Error loading rank:', err)
            rankPosition.textContent = '-'
        }
    }

    async function loadTopUsers() {
        try {
            const res = await fetch('/api/ranking/global')
            if (!res.ok) throw new Error('Failed to load ranking')

            const ranking = await res.json()

            if (!ranking || ranking.length === 0) {
                topUsers.innerHTML = '<div class="muted text-center">Нет данных</div>'
                return
            }

            const top3 = ranking.slice(0, 3)
            topUsers.innerHTML = ''

            top3.forEach((user, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'

                const item = document.createElement('div')
                item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;background:var(--input-bg);margin-bottom:8px'

                item.innerHTML = `
                    <div style="font-size:24px">${medal}</div>
                    <div class="avatar-sm">👤</div>
                    <div style="flex:1">
                        <div style="font-weight:600">${user.name || 'Пользователь'}</div>
                        <div class="text-small muted">${user.city || 'Неизвестно'}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-weight:700;color:var(--accent)">${user.points || 0}</div>
                        <div class="text-small muted">баллов</div>
                    </div>
                `

                topUsers.appendChild(item)
            })

        } catch (err) {
            console.error('Error loading top users:', err)
            topUsers.innerHTML = '<div class="muted text-center">Ошибка загрузки</div>'
        }
    }
})
