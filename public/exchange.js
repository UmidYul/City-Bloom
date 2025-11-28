document.addEventListener('DOMContentLoaded', async () => {
    const productsEl = document.getElementById('products')
    const adminPanel = document.getElementById('adminPanel')
    const productForm = document.getElementById('productForm')
    const addProductBtn = document.getElementById('addProduct')
    const adminMsg = document.getElementById('adminMsg')

    const promoModal = document.getElementById('promoModal')
    const promoCodeEl = document.getElementById('promoCode')
    const promoOrgEl = document.getElementById('promoOrg')
    const promoExpiryEl = document.getElementById('promoExpiry')
    const promoTitleEl = document.getElementById('promoTitle')
    const closePromo = document.getElementById('closePromo')

    closePromo.onclick = () => { promoModal.style.display = 'none' }

    async function fetchProducts() {
        productsEl.innerHTML = 'Загрузка...'
        try {
            const res = await fetch('/api/products')
            if (!res.ok) throw new Error('Failed')
            const list = await res.json()
            renderProducts(list)
        } catch (err) {
            productsEl.innerHTML = 'Ошибка загрузки товаров'
            console.error(err)
        }
    }

    function renderProducts(list) {
        productsEl.innerHTML = ''
        if (!list.length) return productsEl.innerHTML = '<div>Нет доступных товаров</div>'
        for (const p of list) {
            const card = document.createElement('div')
            card.className = 'card'
            card.style.display = 'flex'
            card.style.gap = '12px'
            card.style.alignItems = 'center'

            const left = document.createElement('div')
            left.style.width = '96px'
            left.style.flex = '0 0 96px'
            if (p.icon) left.innerHTML = `<img src="${p.icon}" style="width:96px;height:96px;object-fit:cover;border-radius:8px"/>`
            else left.innerHTML = `<div style="width:96px;height:96px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center">?</div>`

            const body = document.createElement('div')
            body.style.flex = '1'
            body.innerHTML = `<div style="font-weight:700">${p.title}</div><div class="muted">${p.organization || ''}</div><div style="margin-top:6px">Цена: <strong>${p.price}</strong> баллов</div><div class="muted">Срок действия: ${p.validDays || 30} дн.</div>`

            const actions = document.createElement('div')
            actions.style.display = 'flex'
            actions.style.flexDirection = 'column'
            actions.style.gap = '8px'

            const redeemBtn = document.createElement('button')
            redeemBtn.textContent = 'Обменять'
            redeemBtn.onclick = async () => {
                if (!confirm('Потратить ' + p.price + ' баллов на ' + p.title + '?')) return
                try {
                    const res = await fetch('/api/redeem/' + encodeURIComponent(p.id), { method: 'POST' })
                    const j = await res.json()
                    if (!res.ok) throw new Error(j.error || 'Ошибка')
                    const promo = j.promo
                    // show modal with promo info
                    promoTitleEl.textContent = promo.productTitle
                    promoOrgEl.textContent = promo.organization
                    promoCodeEl.textContent = promo.code
                    promoExpiryEl.textContent = 'Действителен до: ' + (new Date(promo.expiresAt)).toLocaleString()
                    promoModal.style.display = 'flex'
                } catch (err) {
                    alert('Ошибка: ' + err.message)
                }
            }

            actions.appendChild(redeemBtn)

            // admin controls: edit / delete -- visible after checking /api/me
            const adminControls = document.createElement('div')
            adminControls.style.display = 'flex'
            adminControls.style.gap = '6px'

            const delBtn = document.createElement('button')
            delBtn.textContent = 'Удалить'
            delBtn.onclick = async () => {
                if (!confirm('Удалить товар?')) return
                try {
                    const res = await fetch('/api/products/' + encodeURIComponent(p.id), { method: 'DELETE' })
                    const j = await res.json()
                    if (!res.ok) throw new Error(j.error || 'Ошибка')
                    fetchProducts()
                } catch (err) { alert('Ошибка: ' + err.message) }
            }

            adminControls.appendChild(delBtn)
            actions.appendChild(adminControls)

            card.appendChild(left)
            card.appendChild(body)
            card.appendChild(actions)
            productsEl.appendChild(card)
        }
    }

    // check role to show admin panel and admin controls
    try {
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
            const me = await meRes.json()
            if (me.role === 'admin') {
                adminPanel.style.display = ''
            } else {
                // hide delete buttons for non-admins
                // adminControls will still be present but we can remove them later if needed
                document.querySelectorAll('#adminPanel').forEach(n => n.style.display = 'none')
            }
        }
    } catch (err) {
        console.error('failed to detect user role', err)
    }

    // admin: add product
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault()
            adminMsg.textContent = ''
            const fd = new FormData(productForm)
            try {
                const res = await fetch('/api/products', { method: 'POST', body: fd })
                const j = await res.json()
                if (!res.ok) throw new Error(j.error || 'Ошибка')
                adminMsg.textContent = 'Товар добавлен'
                productForm.reset()
                fetchProducts()
            } catch (err) {
                adminMsg.textContent = 'Ошибка: ' + err.message
            }
        })
    }

    fetchProducts()
})
