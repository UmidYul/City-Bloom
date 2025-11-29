// Load admin navigation
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
            const me = await meRes.json()
            document.getElementById('navLinks').innerHTML = `<a href="/">Главная</a> • <a href="/profile/${me.id}">Профиль</a> • <form style="display:inline" action="/logout" method="post"><button style="background:none;border:none;color:#06c;cursor:pointer;padding:0">Выйти</button></form>`
        }
    } catch (err) {
        console.error('Failed to load user:', err)
    }

    // Load dashboard stats
    loadDashboardStats()
})

async function loadDashboardStats() {
    try {
        const [subsRes, usersRes, productsRes] = await Promise.all([
            fetch('/api/submissions'),
            fetch('/api/users'),
            fetch('/api/products')
        ])

        if (subsRes.ok) {
            const subs = await subsRes.json()
            const pending = subs.filter(s => s.status === 'pending')
            const approved = subs.filter(s => s.status === 'approved')
            document.getElementById('pendingSubmissionsCount').textContent = pending.length
            document.getElementById('approvedSubmissionsCount').textContent = approved.length
        }

        if (usersRes.ok) {
            const users = await usersRes.json()
            document.getElementById('totalUsersCount').textContent = users.length || 0
        }

        if (productsRes.ok) {
            const products = await productsRes.json()
            document.getElementById('totalProductsCount').textContent = products.length || 0
        }
    } catch (err) {
        console.error('Failed to load stats:', err)
    }
}

async function loadSubmissions() {
    const pendingArea = document.getElementById('pendingTable')
    const evaluatedArea = document.getElementById('evaluatedTable')
    pendingArea.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px"></div>'
    evaluatedArea.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px"></div>'
    
    try {
        const res = await fetch('/api/submissions')
        if (!res.ok) throw new Error('Unauthorized or server error')
        const subs = await res.json()
        const pending = subs.filter(s => s.status === 'pending')
        const evaluated = subs.filter(s => s.status !== 'pending')

        // build modern card-based view
        function buildSubmissionCards(items, includeActions) {
            if (items.length === 0) {
                return '<div class="muted text-small" style="text-align:center;padding:20px">Нет заявок</div>'
            }

            const container = document.createElement('div')
            container.style.display = 'grid'
            container.style.gap = '12px'

            for (const s of items) {
                const card = document.createElement('div')
                card.className = 'user-card'
                
                const statusClass = s.status === 'approved' ? 'approved' : s.status === 'declined' ? 'declined' : 'pending'
                
                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                        <div style="flex:1">
                            <a href="/submission/${s.id}" style="color:var(--text-dark);text-decoration:none;font-weight:600;font-size:15px">${s.title || '(без названия)'}</a>
                            <div class="muted text-small" style="margin-top:4px">ID: ${s.userId}</div>
                        </div>
                        <span class="status-badge ${statusClass}">${s.status}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:${includeActions ? '12px' : '0'}">
                        <div>
                            <div class="muted text-small">Создано</div>
                            <div style="font-weight:500">${new Date(s.createdAt).toLocaleDateString('ru')}</div>
                        </div>
                        <div>
                            <div class="muted text-small">Обновлено</div>
                            <div style="font-weight:500">${s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('ru') : '-'}</div>
                        </div>
                    </div>
                `

                if (includeActions) {
                    const actionsDiv = document.createElement('div')
                    actionsDiv.style.display = 'flex'
                    actionsDiv.style.gap = '8px'
                    actionsDiv.style.alignItems = 'center'
                    actionsDiv.style.borderTop = '1px solid var(--divider)'
                    actionsDiv.style.paddingTop = '12px'

                    const pointsInput = document.createElement('input')
                    pointsInput.type = 'number'
                    pointsInput.min = '0'
                    pointsInput.value = '1000'
                    pointsInput.placeholder = 'Баллы'
                    pointsInput.style.flex = '1'
                    pointsInput.style.height = '38px'

                    const approveBtn = document.createElement('button')
                    approveBtn.textContent = '✓ Одобрить'
                    approveBtn.className = 'secondary'
                    approveBtn.style.height = '38px'
                    approveBtn.style.fontSize = '13px'
                    approveBtn.onclick = () => { 
                        if (confirm('Одобрить эту заявку?')) 
                            action(s.id, 'approve', '', parseInt(pointsInput.value || '1000', 10) || 0) 
                    }

                    const declineBtn = document.createElement('button')
                    declineBtn.textContent = '✗ Отклонить'
                    declineBtn.className = 'ghost'
                    declineBtn.style.height = '38px'
                    declineBtn.style.fontSize = '13px'
                    declineBtn.onclick = () => {
                        const c = prompt('Введите комментарий для отклонения (обязательно):')
                        if (!c || !c.trim()) return alert('Комментарий обязателен')
                        action(s.id, 'decline', c)
                    }

                    actionsDiv.appendChild(pointsInput)
                    actionsDiv.appendChild(approveBtn)
                    actionsDiv.appendChild(declineBtn)
                    card.appendChild(actionsDiv)
                }

                container.appendChild(card)
            }
            return container.outerHTML
        }

        pendingArea.innerHTML = buildSubmissionCards(pending, true)
        evaluatedArea.innerHTML = buildSubmissionCards(evaluated, false)

        // Update dashboard counts
        document.getElementById('pendingSubmissionsCount').textContent = pending.length

    } catch (err) {
        pendingArea.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Ошибка загрузки: ' + err.message + '</div>'
        evaluatedArea.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Ошибка загрузки: ' + err.message + '</div>'
    }
}

async function action(id, actionType, comment, points) {
    // require comment only for decline
    if (actionType === 'decline' && (!comment || !comment.trim())) return alert('Комментарий обязателен')
    try {
        const body = { action: actionType }
        if (typeof comment !== 'undefined') body.comment = comment
        if (typeof points !== 'undefined') body.points = points
        const res = await fetch('/api/submissions/' + encodeURIComponent(id) + '/action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Action failed')
        
        showToast('✓ Операция выполнена успешно', 'success')
        loadSubmissions()
        loadDashboardStats()
    } catch (err) {
        showToast('✗ Ошибка: ' + err.message, 'error')
    }
}

// Load users with search and filter
let allUsers = []
let currentFilter = 'all'

async function loadUsers() {
    const usersList = document.getElementById('usersList')
    usersList.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px"></div><div class="skeleton" style="height:80px"></div>'
    
    try {
        const res = await fetch('/api/users')
        if (!res.ok) throw new Error('Failed to load users')
        allUsers = await res.json()
        renderUsers()
    } catch (err) {
        usersList.innerHTML = '<div class="muted" style="text-align:center;padding:20px">Ошибка загрузки: ' + err.message + '</div>'
    }
}

function renderUsers() {
    const usersList = document.getElementById('usersList')
    const searchValue = document.getElementById('userSearch')?.value.toLowerCase() || ''
    
    let filtered = allUsers

    // Apply filter
    if (currentFilter === 'admin') {
        filtered = filtered.filter(u => u.role === 'admin')
    } else if (currentFilter === 'active') {
        filtered = filtered.filter(u => (u.points || 0) > 0)
    }

    // Apply search
    if (searchValue) {
        filtered = filtered.filter(u => 
            (u.name || '').toLowerCase().includes(searchValue) ||
            (u.email || '').toLowerCase().includes(searchValue)
        )
    }

    if (filtered.length === 0) {
        usersList.innerHTML = '<div class="muted text-small" style="text-align:center;padding:20px">Пользователи не найдены</div>'
        return
    }

    usersList.innerHTML = filtered.map(u => `
        <div class="user-card">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        <a href="/profile/${u.id}" style="color:var(--text-dark);text-decoration:none;font-weight:600;font-size:15px">${u.name || 'Пользователь'}</a>
                        <span class="user-role-badge ${u.role || 'user'}">${u.role || 'user'}</span>
                    </div>
                    <div class="muted text-small">${u.email || 'Нет email'}</div>
                    ${u.city ? `<div class="muted text-small">📍 ${u.city}</div>` : ''}
                </div>
                <div style="text-align:right">
                    <div style="font-size:24px;font-weight:700;color:var(--accent)">${u.points || 0}</div>
                    <div class="muted text-small">баллов</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:13px;padding-top:10px;border-top:1px solid var(--divider)">
                <div style="text-align:center">
                    <div class="muted text-small">Посадок</div>
                    <div style="font-weight:600">${u.treesPlanted || 0}</div>
                </div>
                <div style="text-align:center">
                    <div class="muted text-small">Доверие</div>
                    <div style="font-weight:600">${u.trustRating || 10}/10</div>
                </div>
                <div style="text-align:center">
                    <div class="muted text-small">Рейтинг</div>
                    <div style="font-weight:600">#${u.rank || '-'}</div>
                </div>
            </div>
        </div>
    `).join('')
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
}

function initAdmin() {
    const btnPending = document.getElementById('btnPending')
    const btnEvaluated = document.getElementById('btnEvaluated')
    const pendingArea = document.getElementById('pendingArea')
    const evaluatedArea = document.getElementById('evaluatedArea')
    const tabSubmissions = document.getElementById('tabSubmissions')
    const tabProducts = document.getElementById('tabProducts')
    const tabUsers = document.getElementById('tabUsers')
    const submissionsTab = document.getElementById('submissionsTab')
    const productsTab = document.getElementById('productsTab')
    const usersTab = document.getElementById('usersTab')

    // Tab switching
    function switchTab(tab) {
        // Hide all tabs
        submissionsTab.style.display = 'none'
        productsTab.style.display = 'none'
        usersTab.style.display = 'none'

        // Remove active class
        tabSubmissions.classList.remove('active')
        tabProducts.classList.remove('active')
        tabUsers.classList.remove('active')

        // Show selected tab
        if (tab === 'submissions') {
            submissionsTab.style.display = ''
            tabSubmissions.classList.add('active')
            loadSubmissions()
        } else if (tab === 'products') {
            productsTab.style.display = ''
            tabProducts.classList.add('active')
        } else if (tab === 'users') {
            usersTab.style.display = ''
            tabUsers.classList.add('active')
            loadUsers()
        }
    }

    if (tabSubmissions) tabSubmissions.onclick = () => switchTab('submissions')
    if (tabProducts) tabProducts.onclick = () => switchTab('products')
    if (tabUsers) tabUsers.onclick = () => switchTab('users')

    // Submissions filter buttons
    if (btnPending && btnEvaluated) {
        btnPending.onclick = () => {
            pendingArea.style.display = ''
            evaluatedArea.style.display = 'none'
            btnPending.className = 'secondary'
            btnEvaluated.className = 'ghost'
        }
        btnEvaluated.onclick = () => {
            pendingArea.style.display = 'none'
            evaluatedArea.style.display = ''
            btnPending.className = 'ghost'
            btnEvaluated.className = 'secondary'
        }
    }

    // Users search and filter
    const userSearch = document.getElementById('userSearch')
    const filterAll = document.getElementById('filterAll')
    const filterAdmin = document.getElementById('filterAdmin')
    const filterActive = document.getElementById('filterActive')

    if (userSearch) {
        userSearch.addEventListener('input', renderUsers)
    }

    if (filterAll) {
        filterAll.onclick = () => {
            currentFilter = 'all'
            filterAll.className = 'secondary'
            filterAdmin.className = 'ghost'
            filterActive.className = 'ghost'
            renderUsers()
        }
    }

    if (filterAdmin) {
        filterAdmin.onclick = () => {
            currentFilter = 'admin'
            filterAll.className = 'ghost'
            filterAdmin.className = 'secondary'
            filterActive.className = 'ghost'
            renderUsers()
        }
    }

    if (filterActive) {
        filterActive.onclick = () => {
            currentFilter = 'active'
            filterAll.className = 'ghost'
            filterAdmin.className = 'ghost'
            filterActive.className = 'secondary'
            renderUsers()
        }
    }

    loadSubmissions()
}

document.addEventListener('DOMContentLoaded', initAdmin)
