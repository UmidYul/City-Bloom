document.addEventListener('DOMContentLoaded', async () => {
    const parts = location.pathname.split('/')
    const id = parts[parts.length - 1]
    const titleEl = document.getElementById('submissionTitle')
    const metaEl = document.getElementById('submissionMeta')
    const detailsEl = document.getElementById('submissionDetails')
    const beforeVideo = document.getElementById('beforeVideo')
    const afterVideo = document.getElementById('afterVideo')
    const adminActions = document.getElementById('adminActions')
    const adminCard = document.getElementById('adminCard')
    const mapContainer = document.getElementById('submissionMap')

    const declineBackdrop = document.getElementById('declineModalBackdrop')
    const declineComment = document.getElementById('declineComment')
    const declineCancel = document.getElementById('declineCancel')
    const declineSubmit = document.getElementById('declineSubmit')

    function openDeclineModal() {
        declineComment.value = ''
        declineBackdrop.style.display = 'flex'
        declineBackdrop.setAttribute('aria-hidden', 'false')
        declineComment.focus()
    }

    function closeDeclineModal() {
        declineBackdrop.style.display = 'none'
        declineBackdrop.setAttribute('aria-hidden', 'true')
    }

    if (!id) return titleEl.textContent = 'ID не указан'

    try {
        const res = await fetch('/api/submissions/' + encodeURIComponent(id))
        if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j.error || 'Not found')
        }
        const s = await res.json()

        // populate title/meta/details
        titleEl.textContent = s.title || '(без названия)'
        metaEl.innerHTML = `<div><strong>Тип:</strong> ${s.plantType || '-'}</div><div><strong>Статус:</strong> ${s.status || '-'}</div><div><strong>Создано:</strong> ${s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</div><div><strong>Обновлено:</strong> ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '-'}</div>`
        detailsEl.innerHTML = `<p>${s.description || ''}</p>`

        // media
        if (s.beforeVideo) beforeVideo.src = s.beforeVideo
        else beforeVideo.removeAttribute('src')
        if (s.afterVideo) afterVideo.src = s.afterVideo
        else afterVideo.removeAttribute('src')

        // admin actions (approve / decline using modal)
        try {
            const meRes = await fetch('/api/me')
            if (meRes.ok) {
                const me = await meRes.json()
                if (me.role === 'admin' && s.status === 'pending') {
                    if (adminCard) adminCard.style.display = ''
                    adminActions.innerHTML = ''
                    // points input (admin can choose how many points to award)
                    const pointsInput = document.createElement('input')
                    pointsInput.type = 'number'
                    pointsInput.min = '0'
                    pointsInput.value = (s.pointsAwarded || 1000)
                    pointsInput.style.width = '110px'
                    pointsInput.style.padding = '6px'
                    pointsInput.style.borderRadius = '8px'
                    pointsInput.style.border = '1px solid #e6e9ef'
                    pointsInput.title = 'Количество баллов, выдаваемых при одобрении'

                    const approveBtn = document.createElement('button')
                    approveBtn.textContent = 'Одобрить'
                    approveBtn.onclick = async () => {
                        if (!confirm('Одобрить эту заявку?')) return
                        approveBtn.disabled = true
                        try {
                            const pts = parseInt(pointsInput.value || '1000', 10) || 0
                            const res = await fetch('/api/submissions/' + encodeURIComponent(id) + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', comment: '', points: pts }) })
                            const j = await res.json()
                            if (!res.ok) throw new Error(j.error || 'Action failed')
                            location.reload()
                        } catch (err) {
                            alert('Ошибка: ' + err.message)
                        } finally { approveBtn.disabled = false }
                    }

                    const declineBtn = document.createElement('button')
                    declineBtn.textContent = 'Отклонить'
                    declineBtn.onclick = () => openDeclineModal()

                    adminActions.appendChild(pointsInput)
                    adminActions.appendChild(approveBtn)
                    adminActions.appendChild(declineBtn)

                    // wire modal buttons
                    declineCancel.addEventListener('click', () => closeDeclineModal())
                    declineBackdrop.addEventListener('click', (e) => { if (e.target === declineBackdrop) closeDeclineModal() })
                    declineSubmit.addEventListener('click', async () => {
                        const comment = (declineComment.value || '').trim()
                        if (!comment) return alert('Комментарий обязателен')
                        declineSubmit.disabled = true
                        try {
                            const res = await fetch('/api/submissions/' + encodeURIComponent(id) + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline', comment }) })
                            const j = await res.json()
                            if (!res.ok) throw new Error(j.error || 'Action failed')
                            closeDeclineModal()
                            location.reload()
                        } catch (err) {
                            alert('Ошибка: ' + err.message)
                        } finally { declineSubmit.disabled = false }
                    })
                } else {
                    // ensure admin card stays hidden for non-admins or non-pending
                    if (adminCard) adminCard.style.display = 'none'
                }
            }
        } catch (err) {
            console.error('Failed to determine user role', err)
        }

        // map
        if (s.location && typeof s.location === 'object' && !isNaN(s.location.lat) && !isNaN(s.location.lng)) {
            try {
                const map = L.map(mapContainer).setView([s.location.lat, s.location.lng], 15)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
                L.marker([s.location.lat, s.location.lng]).addTo(map)
                setTimeout(() => map.invalidateSize(), 200)
            } catch (err) {
                console.error('Map init failed', err)
            }
        }

        // admin comment
        if (s.adminComment) {
            const comm = document.createElement('div')
            comm.innerHTML = `<h4>Комментарий администратора</h4><div>${s.adminComment}</div>`
            detailsEl.appendChild(comm)
        }
    } catch (err) {
        titleEl.textContent = 'Ошибка: ' + err.message
    }
})
