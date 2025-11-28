document.addEventListener('DOMContentLoaded', async () => {
    const productsEl = document.getElementById('products')
    const promosList = document.getElementById('promosList')
    const userBalanceEl = document.getElementById('userBalance')

    const promoModal = document.getElementById('promoModal')
    const promoCodeEl = document.getElementById('promoCode')
    const promoOrgEl = document.getElementById('promoOrg')
    const promoExpiryEl = document.getElementById('promoExpiry')
    const promoTitleEl = document.getElementById('promoTitle')
    const closePromo = document.getElementById('closePromo')

    const tabProducts = document.getElementById('tabProducts')
    const tabPromos = document.getElementById('tabPromos')
    const productsTab = document.getElementById('productsTab')
    const promosTab = document.getElementById('promosTab')

    let currentUserPoints = 0

    closePromo.onclick = () => { promoModal.style.display = 'none' }

    // Tab switching
    tabProducts.onclick = () => {
        productsTab.style.display = ''
        promosTab.style.display = 'none'
        tabProducts.style.background = '#4CAF50'
        tabProducts.style.color = 'white'
        tabPromos.style.background = ''
        tabPromos.style.color = ''
    }

    tabPromos.onclick = () => {
        productsTab.style.display = 'none'
        promosTab.style.display = ''
        tabProducts.style.background = ''
        tabProducts.style.color = ''
        tabPromos.style.background = '#4CAF50'
        tabPromos.style.color = 'white'
        loadPromos()
    }

    // Load user balance
    async function loadUserBalance() {
        try {
            const res = await fetch('/api/me')
            if (res.ok) {
                const user = await res.json()
                currentUserPoints = user.points || 0
                userBalanceEl.textContent = currentUserPoints
            }
        } catch (err) {
            userBalanceEl.textContent = '?'
            console.error('Failed to load user balance:', err)
        }
    }

    // Load products
    async function loadProducts() {
        productsEl.innerHTML = 'Загрузка...'
        try {
            const res = await fetch('/api/products')
            if (!res.ok) throw new Error('Failed')
            const list = await res.json()
            renderProducts(list)
        } catch (err) {
            productsEl.innerHTML = '<div style="color:red">Ошибка загрузки товаров: ' + err.message + '</div>'
            console.error(err)
        }
    }

    function renderProducts(list) {
        productsEl.innerHTML = ''
        if (!list || list.length === 0) return productsEl.innerHTML = '<div class="muted">Нет доступных товаров</div>'

        for (const p of list) {
            const card = document.createElement('div')
            card.className = 'card'
            card.style.display = 'flex'
            card.style.flexDirection = 'column'
            card.style.gap = '8px'
            card.style.padding = '12px'

            const img = document.createElement('div')
            if (p.icon) img.innerHTML = `<img src="${p.icon}" style="width:100%;height:120px;object-fit:cover;border-radius:6px"/>`
            else img.innerHTML = `<div style="width:100%;height:120px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#999">Нет фото</div>`
            card.appendChild(img)

            const title = document.createElement('div')
            title.style.fontWeight = '700'
            title.style.fontSize = '0.95rem'
            title.textContent = p.name || 'Товар'
            card.appendChild(title)

            const org = document.createElement('div')
            org.className = 'muted'
            org.style.fontSize = '0.85rem'
            org.textContent = p.organization || ''
            card.appendChild(org)

            const price = document.createElement('div')
            price.style.fontSize = '1.1rem'
            price.style.fontWeight = '700'
            price.style.color = '#24b06b'
            price.textContent = (p.price || 0) + ' 🌱'
            card.appendChild(price)
            body.innerHTML = `
                <div style="font-weight:700;font-size:1.05rem">${p.title}</div>
                <div class="muted">${p.organization || 'Организация не указана'}</div>
                <div style="margin-top:8px">
                    <span style="font-weight:600;font-size:1.1rem;color:#4CAF50">${p.price}</span>
                    <span class="muted"> баллов</span>
                </div>
                <div class="muted" style="font-size:0.9rem">Срок действия: ${p.validDays || 30} дней</div>
                <div style="margin-top:6px;font-size:0.85rem;color:#666">
                    Доступно: <strong>${p.quantity || 0}</strong> шт.
                </div>
            `

            const actions = document.createElement('div')
            actions.style.display = 'flex'
            actions.style.flexDirection = 'column'
            actions.style.gap = '8px'

            const canRedeem = currentUserPoints >= (p.price || 0)
            const redeemBtn = document.createElement('button')
            redeemBtn.textContent = canRedeem ? 'Обменять' : `Недостаточно (${p.price})`
            redeemBtn.style.padding = '10px 16px'
            redeemBtn.style.borderRadius = '6px'
            redeemBtn.style.border = 'none'
            redeemBtn.style.cursor = canRedeem ? 'pointer' : 'not-allowed'
            redeemBtn.style.background = canRedeem ? '#4CAF50' : '#ccc'
            redeemBtn.style.color = 'white'
            redeemBtn.disabled = !canRedeem

            redeemBtn.onclick = async () => {
                if (!confirm(`Потратить ${p.price} баллов на "${p.title}"?`)) return
                try {
                    const res = await fetch('/api/redeem/' + encodeURIComponent(p.id), { method: 'POST' })
                    const j = await res.json()
                    if (!res.ok) throw new Error(j.error || 'Ошибка при обмене')

                    const promo = j.promo
                    // Show modal with promo info
                    promoTitleEl.textContent = promo.productTitle
                    promoOrgEl.textContent = promo.organization || 'Организация'
                    promoCodeEl.textContent = promo.code
                    const expiresDate = new Date(promo.expiresAt)
                    promoExpiryEl.textContent = `Действителен до: ${expiresDate.toLocaleDateString()} ${expiresDate.toLocaleTimeString()}`
                    promoModal.style.display = 'flex'

                    // Refresh balance and products
                    await loadUserBalance()
                    loadProducts()
                } catch (err) {
                    alert('Ошибка: ' + err.message)
                }
            }

            actions.appendChild(redeemBtn)
            card.appendChild(left)
            card.appendChild(body)
            card.appendChild(actions)
            productsEl.appendChild(card)
        }
    }

    // Load user promos
    async function loadPromos() {
        promosList.innerHTML = 'Загрузка...'
        try {
            const res = await fetch('/api/myPromos')
            if (!res.ok) throw new Error('Failed to load promos')
            const promos = await res.json()
            renderPromos(promos)
        } catch (err) {
            promosList.innerHTML = '<div style="color:red">Ошибка загрузки промокодов: ' + err.message + '</div>'
            console.error(err)
        }
    }

    function renderPromos(promos) {
        promosList.innerHTML = ''
        if (!promos || promos.length === 0) {
            promosList.innerHTML = '<div class="muted">У вас ещё нет промокодов. Обменяйте баллы на товары!</div>'
            return
        }

        for (const promo of promos) {
            const now = new Date()
            const expiresDate = new Date(promo.expiresAt)
            const isExpired = expiresDate < now
            const daysLeft = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24))

            const card = document.createElement('div')
            card.style.cssText = `padding:14px;border:2px solid ${isExpired ? '#ddd' : '#4CAF50'};border-radius:8px;background:${isExpired ? '#fafafa' : '#f8fef8'}`

            const title = document.createElement('div')
            title.style.cssText = 'font-weight:700;font-size:1.1rem'
            title.textContent = promo.productTitle
            if (isExpired) title.style.color = '#999'

            const org = document.createElement('div')
            org.className = 'muted'
            org.textContent = promo.organization || 'Организация'

            const code = document.createElement('div')
            code.style.cssText = `margin-top:10px;padding:12px;background:white;border-radius:6px;font-family:monospace;font-size:1.1rem;font-weight:700;text-align:center;cursor:pointer;${isExpired ? 'color:#999' : ''}`
            code.textContent = promo.code
            code.title = 'Нажмите, чтобы скопировать'
            code.onclick = () => {
                if (!isExpired) {
                    navigator.clipboard.writeText(promo.code).then(() => {
                        alert('Код скопирован!')
                    }).catch(err => console.error('Copy failed:', err))
                }
            }

            const status = document.createElement('div')
            status.className = 'muted'
            status.style.cssText = 'margin-top:10px;font-size:0.9rem'
            if (isExpired) {
                status.style.color = '#f44336'
                status.textContent = 'Промокод истёк'
            } else {
                status.textContent = `Действителен ещё ${daysLeft} дней`
            }

            const createdDate = new Date(promo.createdAt)
            const created = document.createElement('div')
            created.className = 'muted'
            created.style.fontSize = '0.85rem'
            created.textContent = `Получен: ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}`

            card.appendChild(title)
            card.appendChild(org)
            card.appendChild(code)
            card.appendChild(status)
            card.appendChild(created)
            promosList.appendChild(card)
        }
    }

    // Initial load
    await loadUserBalance()
    loadProducts()
})
