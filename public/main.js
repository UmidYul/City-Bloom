document.addEventListener('DOMContentLoaded', async () => {
    const userArea = document.getElementById('userArea')
    const trees = document.getElementById('trees')
    try {
        const nav = document.getElementById('navLinks')
        const meRes = await fetch('/api/me')
        if (!meRes.ok) {
            // not authenticated
            userArea.innerHTML = '<div>Пожалуйста, <a href="/login">войдите</a>, чтобы увидеть ваши баллы и посадки.</div>'
            trees.innerHTML = '<div>Войдите, чтобы увидеть посадки.</div>'
            // show Register and Login for anonymous users, but hide Admin
            if (nav) nav.innerHTML = '<a href="/registration">Регистрация</a> • <a href="/login">Войти</a>'
            return
        }
        const me = await meRes.json()
        userArea.innerHTML = `<div><strong>${me.name || '(без имени)'}</strong><div class="points">${me.points || 0} Эко-баллы</div></div>`
        // build navigation according to role
        if (nav) {
            if (me.role === 'admin') {
                // admin: show Profile, Admin, Logout; do not show Register
                nav.innerHTML = `<a href="/profile/${me.id}">Профиль</a> • <a href="/admin">Админ</a> • <form style="display:inline" action="/logout" method="post"><button style="background:none;border:none;color:#06c;cursor:pointer;padding:0">Выйти</button></form>`
            } else {
                // normal user: show Register, Profile, Logout; hide Admin
                nav.innerHTML = `<a href="/register-tree">Добавить посадку</a> • <a href="/profile/${me.id}">Профиль</a> • <form style="display:inline" action="/logout" method="post"><button style="background:none;border:none;color:#06c;cursor:pointer;padding:0">Выйти</button></form>`
            }
        }

        const subsRes = await fetch('/api/mySubmissions')
        if (!subsRes.ok) {
            trees.innerHTML = '<div>Unable to load trees.</div>'
            return
        }
        const subs = await subsRes.json()
        if (!subs.length) {
            trees.innerHTML = '<div>Пока нет посадок.</div>'
            return
        }
        // build a table: Name (link) | Created | Status | Updated
        trees.innerHTML = ''
        const table = document.createElement('table')
        table.style.width = '100%'
        table.style.borderCollapse = 'collapse'
        const thead = document.createElement('thead')
        thead.innerHTML = `<tr><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Name</th><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Created</th><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Status</th><th style="text-align:left; border-bottom:1px solid #ddd; padding:8px">Updated</th></tr>`
        table.appendChild(thead)
        const tbody = document.createElement('tbody')
        for (const s of subs) {
            const tr = document.createElement('tr')
            tr.innerHTML = `<td style="padding:8px; border-bottom:1px solid #f0f0f0"><a href="/submission/${s.id}">${s.title || '(no title)'}</a></td><td style="padding:8px; border-bottom:1px solid #f0f0f0">${new Date(s.createdAt).toLocaleString()}</td><td style="padding:8px; border-bottom:1px solid #f0f0f0">${s.status}</td><td style="padding:8px; border-bottom:1px solid #f0f0f0">${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '-'}</td>`
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
