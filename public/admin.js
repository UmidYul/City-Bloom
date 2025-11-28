async function loadSubmissions() {
    const pendingArea = document.getElementById('pendingTable')
    const evaluatedArea = document.getElementById('evaluatedTable')
    pendingArea.innerHTML = 'Загрузка...'
    evaluatedArea.innerHTML = 'Загрузка...'
    try {
        const res = await fetch('/api/submissions')
        if (!res.ok) throw new Error('Unauthorized or server error')
        const subs = await res.json()
        const pending = subs.filter(s => s.status === 'pending')
        const evaluated = subs.filter(s => s.status !== 'pending')

        // build table helper
        function buildTable(items, includeActions) {
            const table = document.createElement('table')
            table.style.width = '100%'
            table.style.borderCollapse = 'collapse'
            const thead = document.createElement('thead')
            thead.innerHTML = `<tr><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Название</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Создано</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Статус</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Обновлено</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Пользователь</th>${includeActions ? '<th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Действия</th>' : ''}</tr>`
            table.appendChild(thead)
            const tbody = document.createElement('tbody')
            for (const s of items) {
                const tr = document.createElement('tr')
                const nameCell = `<td style="padding:8px;border-bottom:1px solid #f0f0f0"><a href="/submission/${s.id}">${s.title || '(no title)'}</a></td>`
                const createdCell = `<td style="padding:8px;border-bottom:1px solid #f0f0f0">${new Date(s.createdAt).toLocaleString()}</td>`
                const statusCell = `<td style="padding:8px;border-bottom:1px solid #f0f0f0">${s.status}</td>`
                const updatedCell = `<td style="padding:8px;border-bottom:1px solid #f0f0f0">${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '-'}</td>`
                const userCell = `<td style="padding:8px;border-bottom:1px solid #f0f0f0">${s.userId}</td>`
                tr.innerHTML = nameCell + createdCell + statusCell + updatedCell + userCell
                if (includeActions) {
                    const actionTd = document.createElement('td')
                    actionTd.style.padding = '8px'
                    // points input for approve
                    const pointsInput = document.createElement('input')
                    pointsInput.type = 'number'
                    pointsInput.min = '0'
                    pointsInput.value = '1000'
                    pointsInput.style.width = '90px'
                    pointsInput.style.padding = '6px'
                    pointsInput.style.borderRadius = '8px'
                    pointsInput.style.border = '1px solid #e6e9ef'
                    pointsInput.title = 'Количество баллов при одобрении'

                    const approveBtn = document.createElement('button')
                    approveBtn.textContent = 'Одобрить'
                    approveBtn.onclick = () => { if (confirm('Одобрить эту заявку?')) action(s.id, 'approve', '', parseInt(pointsInput.value || '1000', 10) || 0) }
                    const declineBtn = document.createElement('button')
                    declineBtn.style.marginLeft = '8px'
                    declineBtn.textContent = 'Отклонить'
                    declineBtn.onclick = () => {
                        const c = prompt('Введите комментарий для отклонения (обязательно):')
                        if (!c || !c.trim()) return alert('Комментарий обязателен')
                        action(s.id, 'decline', c)
                    }
                    actionTd.appendChild(pointsInput)
                    actionTd.appendChild(approveBtn)
                    actionTd.appendChild(declineBtn)
                    tr.appendChild(actionTd)
                }
                tbody.appendChild(tr)
            }
            table.appendChild(tbody)
            return table
        }

        pendingArea.innerHTML = ''
        pendingArea.appendChild(buildTable(pending, true))

        evaluatedArea.innerHTML = ''
        evaluatedArea.appendChild(buildTable(evaluated, false))

    } catch (err) {
        pendingArea.innerHTML = 'Ошибка загрузки: ' + err.message
        evaluatedArea.innerHTML = 'Ошибка загрузки: ' + err.message
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
        alert('Готово')
        loadSubmissions()
    } catch (err) {
        alert('Ошибка: ' + err.message)
    }
}

function initAdmin() {
    const btnPending = document.getElementById('btnPending')
    const btnEvaluated = document.getElementById('btnEvaluated')
    const pendingArea = document.getElementById('pendingArea')
    const evaluatedArea = document.getElementById('evaluatedArea')
    if (btnPending && btnEvaluated) {
        btnPending.onclick = () => {
            document.getElementById('pendingArea').style.display = ''
            document.getElementById('evaluatedArea').style.display = 'none'
        }
        btnEvaluated.onclick = () => {
            document.getElementById('pendingArea').style.display = 'none'
            document.getElementById('evaluatedArea').style.display = ''
        }
    }
    loadSubmissions()
}

document.addEventListener('DOMContentLoaded', initAdmin)
