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

    let currentUserPoints = 0
    let currentTab = 'rewards'
    let currentCategory = 'all'
    let allProducts = []
    let reviewedPromoIds = new Set()
    // Pagination state for products
    let page = 1
    const pageSize = 8

    closePromo.onclick = () => { promoModal.style.display = 'none' }

    // Category filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter]')
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            currentCategory = btn.dataset.filter
            filterProducts()
        })
    })

    // Category pill switching
    const categoryPills = document.querySelectorAll('.pill[data-category]')
    categoryPills.forEach(pill => {
        if (pill.disabled) return

        pill.addEventListener('click', () => {
            categoryPills.forEach(p => p.classList.remove('active'))
            pill.classList.add('active')
            currentTab = pill.dataset.category

            // Show/hide tabs
            document.getElementById('rewardsTab').style.display = currentTab === 'rewards' ? '' : 'none'
            document.getElementById('promosTab').style.display = currentTab === 'promos' ? '' : 'none'

            // Load content
            if (currentTab === 'promos') loadPromos()
        })
    })

    // Category filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn[data-filter]')
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            currentCategory = btn.dataset.filter
            filterProducts()
        })
    })

    function filterProducts() {
        let filtered = allProducts
        if (currentCategory !== 'all') {
            filtered = allProducts.filter(p => (p.category || 'other') === currentCategory)
        }
        page = 1
        renderProducts(filtered)
    }

    // Load user balance
    async function loadUserBalance() {
        try {
            const res = await fetch('/api/me')
            if (res.ok) {
                const user = await res.json()
                currentUserPoints = user.points || 0
                userBalanceEl.textContent = currentUserPoints.toLocaleString()
            }
        } catch (err) {
            userBalanceEl.textContent = '0'
            console.error('Failed to load user balance:', err)
        }
    }

    // Load products
    async function loadProducts() {
        productsEl.innerHTML = '<div class="skeleton" style="height:120px;margin-bottom:12px"></div><div class="skeleton" style="height:120px"></div>'
        try {
            const productsRes = await fetch('/api/products')
            if (!productsRes.ok) throw new Error('Failed to load products')
            const data = await productsRes.json()
            // Handle both old array format and new {products, total} format
            allProducts = Array.isArray(data) ? data : (data.products || [])
            filterProducts()
        } catch (err) {
            productsEl.innerHTML = '<div class="card"><div style="color:#b00020;text-align:center;padding:20px">Ошибка загрузки товаров</div></div>'
            console.error('Error loading products:', err)
        }
    }


    function getCategoryIcon(category) {
        const icons = {
            food: '🍔',
            entertainment: '🎬',
            shopping: '🛍️',
            services: '💼',
            other: '📦'
        }
        return icons[category] || '🎁'
    }

    function getRatingHTML() { return '' }

    function renderProducts(list) {
        productsEl.innerHTML = ''
        if (!list || list.length === 0) {
            productsEl.innerHTML = '<div class="card text-center muted" style="padding:40px"><div style="font-size:48px;margin-bottom:12px">🎁</div><div>Нет доступных товаров</div></div>'
            return
        }

        const start = (page - 1) * pageSize
        const slice = list.slice(start, start + pageSize)

        for (const p of slice) {
            const card = document.createElement('div')
            card.className = 'product-card'

            // Icon
            const icon = document.createElement('div')
            icon.className = 'product-icon'
            if (p.icon) {
                const img = document.createElement('img')
                img.src = p.icon
                img.alt = p.title || 'Товар'
                img.onerror = () => {
                    icon.innerHTML = ''
                    icon.textContent = getCategoryIcon(p.category)
                }
                icon.appendChild(img)
            } else {
                icon.textContent = getCategoryIcon(p.category)
            }

            // Content
            const content = document.createElement('div')
            content.style.flex = '1'
            content.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
                    <div style="font-weight:700;font-size:16px">${p.title || 'Товар'}</div>
                </div>
                <div class="text-small muted" style="margin-bottom:8px">${p.organization || 'Магазин'}</div>
                ${getRatingHTML(p.id)}
                <div style="font-size:18px;font-weight:700;color:var(--accent)">${p.price || 0} баллов</div>
                <div class="text-small muted">Доступно: ${p.quantity || 0} шт</div>
            `


            // Button
            const btnContainer = document.createElement('div')
            btnContainer.style.marginTop = '12px'
            const canRedeem = currentUserPoints >= (p.price || 0) && (p.quantity || 0) > 0
            const btn = document.createElement('button')

            if (!canRedeem) {
                btn.className = 'ghost'
                btn.disabled = true
                btn.textContent = currentUserPoints < (p.price || 0) ? 'Недостаточно баллов' : 'Нет в наличии'
                btn.style.cursor = 'not-allowed'
            } else {
                btn.textContent = 'Обменять'
                btn.onclick = () => redeemProduct(p)
            }

            btnContainer.appendChild(btn)
            content.appendChild(btnContainer)

            card.appendChild(icon)
            card.appendChild(content)
            productsEl.appendChild(card)
        }

        // Pagination controls
        const totalPages = Math.ceil(list.length / pageSize)
        if (totalPages > 1) {
            const pager = document.createElement('div')
            pager.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:12px'
            const prev = document.createElement('button')
            prev.className = 'secondary'
            prev.textContent = '←'
            prev.disabled = page <= 1
            prev.onclick = () => { page = Math.max(1, page - 1); renderProducts(list) }
            const info = document.createElement('div')
            info.className = 'text-small muted'
            info.style.cssText = 'display:flex;align-items:center;padding:0 8px'
            info.textContent = `Стр. ${page} / ${totalPages}`
            const next = document.createElement('button')
            next.className = 'secondary'
            next.textContent = '→'
            next.disabled = page >= totalPages
            next.onclick = () => { page = Math.min(totalPages, page + 1); renderProducts(list) }
            pager.appendChild(prev)
            pager.appendChild(info)
            pager.appendChild(next)
            productsEl.appendChild(pager)
        }
    }

    async function redeemProduct(product) {
        if (!confirm(`Потратить ${product.price} баллов на "${product.title}"?`)) return

        try {
            const res = await fetch('/api/redeem/' + encodeURIComponent(product.id), { method: 'POST' })
            const j = await res.json()
            if (!res.ok) throw new Error(j.error || 'Ошибка обмена')

            const promo = j.promo
            // Show modal with promo info
            promoTitleEl.textContent = promo.productTitle
            promoOrgEl.textContent = promo.organization || 'Магазин'
            promoCodeEl.textContent = promo.code
            const expiresDate = new Date(promo.expiresAt)
            promoExpiryEl.textContent = `Действителен до: ${expiresDate.toLocaleDateString()}`

            // Generate QR code
            const qrcodeContainer = document.getElementById('qrcode')
            qrcodeContainer.innerHTML = '' // Clear previous QR code
            new QRCode(qrcodeContainer, {
                text: promo.code,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            })

            promoModal.style.display = 'flex'

            // Show success toast
            showToast('Промокод получен! ✓', 'success')

            // Refresh balance and products
            await loadUserBalance()
            loadProducts()
        } catch (err) {
            showToast(err.message || 'Ошибка обмена', 'error')
        }
    }

    // Load user promos
    async function loadPromos() {
        promosList.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px"></div>'
        try {
            const res = await fetch('/api/myPromos')
            if (!res.ok) throw new Error('Failed to load promos')
            const promos = await res.json()

            // Reviews removed

            renderPromos(promos)
        } catch (err) {
            promosList.innerHTML = '<div class="card"><div style="color:#b00020;text-align:center;padding:20px">Ошибка загрузки промокодов</div></div>'
            console.error(err)
        }
    }

    function renderPromos(promos) {
        promosList.innerHTML = ''
        if (!promos || promos.length === 0) {
            promosList.innerHTML = '<div class="card text-center" style="padding:40px"><div style="font-size:48px;margin-bottom:12px">🎟️</div><h4 style="margin-bottom:8px">Нет промокодов</h4><p class="muted">Обменяйте баллы на товары, чтобы получить промокоды!</p></div>'
            return
        }

        for (const promo of promos) {
            const now = new Date()
            const expiresDate = new Date(promo.expiresAt)
            const isExpired = expiresDate < now
            const daysLeft = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24))

            const card = document.createElement('div')
            card.className = 'card'
            card.style.borderLeft = `4px solid ${isExpired ? 'var(--text-gray)' : 'var(--accent)'}`
            card.style.marginBottom = '16px'
            if (isExpired) card.style.opacity = '0.6'

            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                    <div>
                        <div style="font-weight:700;font-size:16px">${promo.productTitle}</div>
                        <div class="text-small muted">${promo.organization || 'Магазин'}</div>
                    </div>
                    <div class="badge" style="background:${isExpired ? 'var(--input-bg)' : 'var(--badge-bg)'}">
                        ${isExpired ? 'Истёк' : 'Активен'}
                    </div>
                </div>
                
                <div style="padding:14px;background:var(--input-bg);border-radius:12px;margin-bottom:12px">
                    <div class="text-small muted" style="margin-bottom:4px">Промокод:</div>
                    <div style="font-family:monospace;font-weight:700;font-size:18px;user-select:all;cursor:pointer" onclick="copyPromoFromCard(this)">${promo.code}</div>
                </div>
                
                <button class="secondary" style="width:100%;font-size:13px;margin-bottom:8px" onclick='showPromoQR(${JSON.stringify(promo)})'>
                    📱 Показать QR-код
                </button>
                
                
                
                <div class="text-small muted text-center" style="margin-top:12px">
                    ${isExpired ? 'Истёк' : `Действителен ${daysLeft} дней`} • 
                    <span style="color:var(--text-gray)">Получен ${new Date(promo.createdAt).toLocaleDateString()}</span>
                </div>
            `

            promosList.appendChild(card)
        }
    }

    window.showPromoQR = function (promo) {
        promoTitleEl.textContent = promo.productTitle
        promoOrgEl.textContent = promo.organization || 'Магазин'
        promoCodeEl.textContent = promo.code
        const expiresDate = new Date(promo.expiresAt)
        promoExpiryEl.textContent = `Действителен до: ${expiresDate.toLocaleDateString()}`

        // Generate QR code
        const qrcodeContainer = document.getElementById('qrcode')
        qrcodeContainer.innerHTML = '' // Clear previous QR code
        new QRCode(qrcodeContainer, {
            text: promo.code,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        })

        promoModal.style.display = 'flex'
    }

    window.copyPromoFromCard = function (el) {
        const code = el.textContent
        navigator.clipboard.writeText(code).then(() => {
            const orig = el.textContent
            el.textContent = '✓ Скопировано!'
            setTimeout(() => el.textContent = orig, 1500)
        }).catch(err => {
            console.error('Failed to copy:', err)
            alert('Не удалось скопировать код')
        })
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div')
        toast.className = `toast ${type}`
        toast.textContent = message
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
    }

    // Reviews & rating submission removed

    // Initial load
    await loadUserBalance()
    await loadProducts()
})
