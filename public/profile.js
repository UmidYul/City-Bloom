// Fetch user profile by id from URL and populate the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const parts = location.pathname.split('/')
        const id = parts[parts.length - 1]
        if (!id) return

        const res = await fetch('/api/users/' + encodeURIComponent(id))
        if (!res.ok) {
            document.getElementById('name').textContent = 'Пользователь не найден'
            return
        }
        const user = await res.json()
        document.getElementById('name').textContent = user.name || '(no name)'
        document.getElementById('tel').textContent = user.phone || ''
        document.getElementById('role').textContent = user.role || ''

        // show counts instead of full list
        try {
            const myRes = await fetch('/api/mySubmissions')
            if (myRes.ok) {
                const subs = await myRes.json()
                const approved = subs.filter(s => s.status === 'approved')
                document.getElementById('approvedCount').textContent = approved.length
                document.getElementById('totalCount').textContent = subs.length
                // keep the subs container as a simple message
                const container = document.getElementById('subs')
                container.innerHTML = `<div>Показано количество одобренных посадок и общее число заявок.</div>`
            }
        } catch (err) {
            console.error('Failed to load submissions', err)
            document.getElementById('subs').textContent = 'Ошибка загрузки заявок'
        }
    } catch (err) {
        console.error(err)
        document.getElementById('name').textContent = 'Ошибка при загрузке профиля'
    }
})
