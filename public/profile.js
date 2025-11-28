const avatarEl = document.getElementById('avatar')
const nameEl = document.getElementById('name')
const roleEl = document.getElementById('role')
const ecoPointsEl = document.getElementById('ecoPoints')
const ecoCard = document.getElementById('ecoCard')
const treesValueEl = document.getElementById('treesValue')
const careValueEl = document.getElementById('careValue')
const impactValueEl = document.getElementById('impactValue')
const settingsButton = document.getElementById('settingsButton')
const notificationsButton = document.getElementById('notificationsButton')
const badgeList = document.getElementById('badgeList')
const badgeSkeleton = document.getElementById('badgeSkeleton')
const activityList = document.getElementById('activityList')
const activitySkeleton = document.getElementById('activitySkeleton')
const emptyActivity = document.getElementById('emptyActivity')
const offlineBanner = document.getElementById('offlineBanner')
const errorBanner = document.getElementById('errorBanner')
const retryButton = document.getElementById('retryButton')
const notificationDot = document.getElementById('notificationDot')
const editModal = document.getElementById('editModal')
const badgeModal = document.getElementById('badgeModal')
const editProfileButton = document.getElementById('editProfileButton')
const editForm = document.getElementById('editForm')
const voiceLabel = document.getElementById('voiceLabel')
const avatarQuickActions = document.getElementById('avatarQuickActions')
const quickEditPhoto = document.getElementById('quickEditPhoto')

const fallbackProfile = {
    name: 'Alex Green',
    role: 'Forest Guardian',
    eco_points: 1250,
    stats: {
        trees_planted: 12,
        care_actions: 85,
        impact_area: 240
    },
    badges: [
        { id: 'guardian', title: 'Forest Guardian', description: 'Посадите 5 деревьев', icon: '🌳', earned: true, achievedAt: '2024-03-01' },
        { id: 'care', title: 'Care Keeper', description: 'Совершайте действия по уходу', icon: '🪴', earned: true, achievedAt: '2024-04-10' },
        { id: 'impact', title: 'Impact Starter', description: 'Достигните площади 240 sq. ft.', icon: '✨', earned: false }
    ],
    recent_activities: [
        { id: '1', title: 'Посадка липы', type: 'approved', timestamp: new Date().toISOString(), xp: 50, icon: '✅' },
        { id: '2', title: 'Полив деревьев', type: 'care', timestamp: new Date().toISOString(), xp: 15, icon: '💧' }
    ]
}

let longPressTimer = null
let startY = 0
let pulling = false

function setAvatar(name, avatarUrl) {
    avatarEl.innerHTML = ''
    avatarEl.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : 'none'
    avatarEl.style.backgroundSize = 'cover'
    avatarEl.style.backgroundPosition = 'center'

    if (!avatarUrl) {
        const initials = (name || 'AG').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        avatarEl.textContent = initials
    }
    avatarEl.setAttribute('aria-label', `${name || 'User'} avatar`)
}

function animatePoints(target) {
    const current = parseInt(ecoPointsEl.textContent.replace(/,/g, ''), 10) || 0
    const duration = 1200
    const start = performance.now()

    function frame(now) {
        const progress = Math.min((now - start) / duration, 1)
        const value = Math.floor(current + (target - current) * progress)
        ecoPointsEl.textContent = value.toLocaleString('en-US')
        if (progress < 1) requestAnimationFrame(frame)
    }
    ecoCard.classList.add('glow')
    setTimeout(() => ecoCard.classList.remove('glow'), 1200)
    requestAnimationFrame(frame)
}

function renderBadges(badges) {
    badgeList.innerHTML = ''
    badgeSkeleton.style.display = 'none'
    badges.forEach(badge => {
        const item = document.createElement('button')
        item.className = `badge-item ${badge.earned ? 'active' : 'locked'}`
        item.setAttribute('aria-label', badge.title)
        item.innerHTML = `
            <div class="badge-icon" aria-hidden="true">${badge.icon || '🎖️'}</div>
            <div class="badge-title">${badge.title}</div>
            <div class="badge-desc">${badge.description || ''}</div>
            ${badge.earned ? '' : '<div class="badge-locked">🔒 Locked</div>'}
        `
        item.addEventListener('click', () => openBadgeModal(badge))
        badgeList.appendChild(item)
    })
}

function openBadgeModal(badge) {
    document.getElementById('badgeModalTitle').textContent = badge.title
    document.getElementById('badgeModalBody').innerHTML = `
        <div style="font-size:1.1rem">${badge.icon || '🎖️'}</div>
        <p>${badge.description || ''}</p>
        <p>${badge.earned ? 'Активный бейдж' : 'Бейдж заблокирован (🔒)'}</p>
        ${badge.achievedAt ? `<p class="muted">Получен: ${new Date(badge.achievedAt).toLocaleDateString()}</p>` : ''}
    `
    toggleModal(badgeModal, true)
}

function renderActivities(activities) {
    activityList.innerHTML = ''
    activitySkeleton.style.display = 'none'
    emptyActivity.hidden = activities.length !== 0

    activities.forEach(activity => {
        const row = document.createElement('div')
        row.className = 'activity-row'
        row.dataset.id = activity.id
        row.innerHTML = `
            <div class="activity-icon" aria-hidden="true">${activity.icon || '🌱'}</div>
            <div>
                <div class="activity-title">${activity.title}</div>
                <div class="activity-meta">${new Date(activity.timestamp).toLocaleString()} • ${activity.type}</div>
            </div>
            <div class="xp-tag">+${activity.xp}xp</div>
            <div class="activity-actions" aria-label="Действия">
                <button class="action-button" data-action="view">View</button>
                <button class="action-button" data-action="share">Share</button>
                <button class="action-button" data-action="delete">Delete</button>
            </div>
        `

        let startX = 0
        let currentX = 0
        let isSwiping = false

        row.addEventListener('pointerdown', (e) => {
            startX = e.clientX
            isSwiping = true
        })

        row.addEventListener('pointermove', (e) => {
            if (!isSwiping) return
            currentX = e.clientX
            const delta = currentX - startX
            row.style.transform = `translateX(${Math.min(0, delta)}px)`
        })

        row.addEventListener('pointerup', () => {
            isSwiping = false
            row.style.transform = 'translateX(0)'
        })

        row.querySelectorAll('.action-button').forEach(btn => {
            btn.addEventListener('click', () => handleActivityAction(btn.dataset.action, activity))
        })

        activityList.appendChild(row)
    })
}

function handleActivityAction(action, activity) {
    if (action === 'delete') {
        if (confirm('Удалить запись?')) {
            const row = activityList.querySelector(`[data-id="${activity.id}"]`)
            row?.remove()
            if (!activityList.children.length) emptyActivity.hidden = false
        }
        return
    }
    if (action === 'share' && navigator.share) {
        navigator.share({ title: activity.title, text: `${activity.title} +${activity.xp}xp`, url: location.href }).catch(() => { })
        return
    }
    alert(`${action === 'view' ? 'Просмотр' : 'Поделиться'}: ${activity.title}`)
}

function showSkeletons() {
    badgeSkeleton.style.display = 'grid'
    activitySkeleton.style.display = 'grid'
}

function toggleModal(modal, show) {
    modal.classList.toggle('active', show)
    modal.setAttribute('aria-hidden', show ? 'false' : 'true')
}

async function loadProfile() {
    showSkeletons()
    errorBanner.hidden = true
    try {
        const res = await fetch('/user/profile', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        hydrateProfile(data)
    } catch (err) {
        console.error(err)
        hydrateProfile(fallbackProfile)
        errorBanner.hidden = false
    }
}

function hydrateProfile(data) {
    const profile = { ...fallbackProfile, ...data }
    nameEl.textContent = profile.name
    roleEl.textContent = profile.role || 'Forest Guardian'
    voiceLabel.textContent = `Профиль, ${profile.name}, Eco points ${profile.eco_points}`
    setAvatar(profile.name, profile.avatar_url)

    animatePoints(profile.eco_points || 0)
    treesValueEl.textContent = profile.stats?.trees_planted ?? 0
    careValueEl.textContent = profile.stats?.care_actions ?? 0
    impactValueEl.textContent = profile.stats?.impact_area ?? 0

    renderBadges(profile.badges || [])
    renderActivities(profile.recent_activities || [])

    notificationDot.hidden = (profile.recent_activities || []).length === 0
}

function bindInteractions() {
    ecoCard.addEventListener('click', () => (window.location.href = '/exchange'))
    ecoCard.addEventListener('keydown', (e) => { if (e.key === 'Enter') ecoCard.click() })

    document.getElementById('statsGrid').addEventListener('click', (e) => {
        const pill = e.target.closest('.stat-pill')
        if (pill) alert('Открыть подробный лог по: ' + pill.dataset.key)
    })

    settingsButton.addEventListener('click', () => alert('Открыть настройки'))
    notificationsButton.addEventListener('click', () => alert('Открыть уведомления'))

    editProfileButton.addEventListener('click', () => {
        editForm.name.value = nameEl.textContent
        editForm.role.value = roleEl.textContent
        toggleModal(editModal, true)
    })

    editForm.addEventListener('submit', (e) => {
        e.preventDefault()
        const name = editForm.name.value.trim()
        const role = editForm.role.value.trim()
        if (name.length < 1 || name.length > 50) return alert('Имя должно быть 1–50 символов')
        if (role.length > 30) return alert('Роль не более 30 символов')
        nameEl.textContent = name
        roleEl.textContent = role || 'Forest Guardian'
        voiceLabel.textContent = `Профиль, ${name}, Eco points ${ecoPointsEl.textContent}`
        toggleModal(editModal, false)
    })

    document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => {
        toggleModal(editModal, false)
        toggleModal(badgeModal, false)
    }))

    document.addEventListener('click', (e) => {
        if (e.target === editModal) toggleModal(editModal, false)
        if (e.target === badgeModal) toggleModal(badgeModal, false)
    })

    avatarEl.addEventListener('click', () => toggleModal(editModal, true))

    avatarEl.addEventListener('pointerdown', () => {
        longPressTimer = setTimeout(() => {
            avatarQuickActions.hidden = false
        }, 600)
    })
    avatarEl.addEventListener('pointerup', () => {
        clearTimeout(longPressTimer)
    })

    quickEditPhoto.addEventListener('click', () => {
        alert('Загрузка редактора фото...')
        avatarQuickActions.hidden = true
    })

    retryButton.addEventListener('click', loadProfile)

    offlineBanner.hidden = navigator.onLine
    window.addEventListener('online', () => offlineBanner.hidden = true)
    window.addEventListener('offline', () => offlineBanner.hidden = false)

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY
            pulling = true
        }
    })

    document.addEventListener('touchmove', (e) => {
        if (!pulling) return
        const delta = e.touches[0].clientY - startY
        if (delta > 80) {
            pulling = false
            loadProfile()
        }
    })

    document.addEventListener('touchend', () => pulling = false)
}

bindInteractions()
loadProfile()
