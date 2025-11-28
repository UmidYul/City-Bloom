document.addEventListener('DOMContentLoaded', async () => {
    const userArea = document.getElementById('userArea')
    const trees = document.getElementById('trees')
    const profileNavLink = document.getElementById('profileNavLink')

    try {
        const meRes = await fetch('/api/me')
        if (!meRes.ok) {
            // not authenticated - redirect to login
            window.location.href = '/login'
            return
        }
        const me = await meRes.json()
        userArea.innerHTML = `<div><strong>${me.name || '(без имени)'}</strong><div class="points" style="margin-top:8px;font-size:1.3rem;color:#24b06b;font-weight:700">${me.points || 0} 🌱</div></div>`

        // Update profile link with user ID
        if (profileNavLink) {
            profileNavLink.href = `/profile/${me.id}`
        }

        const subsRes = await fetch('/api/mySubmissions')
        if (!subsRes.ok) {
            trees.innerHTML = '<div>Ошибка загрузки посадок.</div>'
            return
        }
        const subs = await subsRes.json()
        if (!subs.length) {
            trees.innerHTML = '<div>Пока нет посадок. Добавьте первую!</div>'
            return
        }
        // build a table: Name (link) | Created | Status | Updated
        trees.innerHTML = ''
        const table = document.createElement('table')
        table.style.width = '100%'
        table.style.borderCollapse = 'collapse'
        const thead = document.createElement('thead')
        thead.innerHTML = `<tr><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Название</th><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Статус</th></tr>`
        table.appendChild(thead)
        const tbody = document.createElement('tbody')
        for (const s of subs) {
            const tr = document.createElement('tr')
            tr.innerHTML = `<td style="padding:8px; border-bottom:1px solid #f0f0f0"><a href="/submission/${s.id}" style="color:#06c;text-decoration:none">${s.title || '(без названия)'}</a></td><td style="padding:8px; border-bottom:1px solid #f0f0f0;font-size:0.9rem">${s.status}</td>`
            tbody.appendChild(tr)
        }
        table.appendChild(tbody)
        trees.appendChild(table)
    } catch (err) {
        userArea.innerHTML = 'Ошибка загрузки пользователя'
        trees.innerHTML = 'Ошибка загрузки посадок'
        console.error(err)
    }
})
