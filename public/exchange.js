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
    let favoriteIds = new Set()
    let productRatings = {}
    let reviewedPromoIds = new Set()

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
        if (currentCategory === 'favorites') {
            // Show only favorited products
            filtered = allProducts.filter(p => favoriteIds.has(p.id))
        } else if (currentCategory !== 'all') {
            filtered = allProducts.filter(p => (p.category || 'other') === currentCategory)
        }
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
            const [productsRes, favoritesRes, ratingsRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/favorites'),
                fetch('/api/products/ratings')
            ])

            if (!productsRes.ok) throw new Error('Failed to load products')
            allProducts = await productsRes.json()

            if (favoritesRes.ok) {
                const favorites = await favoritesRes.json()
                favoriteIds = new Set(favorites.map(f => f.productId))
            }

            if (ratingsRes.ok) {
                productRatings = await ratingsRes.json()
            }

            console.log('Products loaded:', allProducts)
            filterProducts()
        } catch (err) {
            productsEl.innerHTML = '<div class="card"><div style="color:#b00020;text-align:center;padding:20px">Ошибка загрузки товаров</div></div>'
            console.error('Error loading products:', err)
        }
    }

    async function toggleFavorite(productId, currentlyFavorited) {
        try {
            if (currentlyFavorited) {
                await fetch(`/api/favorites/${productId}`, { method: 'DELETE' })
                favoriteIds.delete(productId)
            } else {
                await fetch(`/api/favorites/${productId}`, { method: 'POST' })
                favoriteIds.add(productId)
            }
            filterProducts() // Re-render
        } catch (err) {
            console.error('Error toggling favorite:', err)
            alert('Ошибка при обновлении избранного')
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

    function getRatingHTML(productId) {
        const rating = productRatings[productId]
        if (!rating || rating.count === 0) {
            return '<div class="text-small muted" style="margin-bottom:4px">Нет отзывов</div>'
        }

        const stars = '⭐'.repeat(Math.round(rating.average))
        return `<div style="margin-bottom:4px">
            <span style="color:#FFB800;font-size:14px">${stars}</span>
            <span class="text-small muted"> ${rating.average} (${rating.count})</span>
        </div>`
    }

    function renderProducts(list) {
        productsEl.innerHTML = ''
        if (!list || list.length === 0) {
            const emptyMessage = currentCategory === 'favorites'
                ? '<div class="card text-center muted" style="padding:40px"><div style="font-size:48px;margin-bottom:12px">❤️</div><div style="font-weight:600;margin-bottom:8px">Избранное пусто</div><div style="font-size:14px">Добавляйте товары в избранное, нажав на сердечко</div></div>'
                : '<div class="card text-center muted" style="padding:40px"><div style="font-size:48px;margin-bottom:12px">🎁</div><div>Нет доступных товаров</div></div>'
            productsEl.innerHTML = emptyMessage
            return
        }

        for (const p of list) {
            const isFavorited = favoriteIds.has(p.id)
            const card = document.createElement('div')
            card.className = 'product-card'

            // Icon
            const icon = document.createElement('div')
            icon.className = 'product-icon'
            if (p.icon) {
                icon.innerHTML = `<img src="${p.icon}" alt="${p.title}" />`
            } else {
                icon.textContent = getCategoryIcon(p.category)
            }

            // Content
            const content = document.createElement('div')
            content.style.flex = '1'
            content.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
                    <div style="font-weight:700;font-size:16px">${p.title || 'Товар'}</div>
                    <button class="favorite-btn" data-id="${p.id}" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0;line-height:1" title="${isFavorited ? 'Удалить из избранного' : 'Добавить в избранное'}">
                        ${isFavorited ? '❤️' : '🤍'}
                    </button>
                </div>
                <div class="text-small muted" style="margin-bottom:8px">${p.organization || 'Магазин'}</div>
                ${getRatingHTML(p.id)}
                <div style="font-size:18px;font-weight:700;color:var(--accent)">${p.price || 0} баллов</div>
                <div class="text-small muted">Доступно: ${p.quantity || 0} шт</div>
            `

            // Favorite button handler
            const favBtn = content.querySelector('.favorite-btn')
            favBtn.onclick = (e) => {
                e.stopPropagation()
                toggleFavorite(p.id, isFavorited)
            }

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

            // Load user's reviews to track which promos already reviewed
            try {
                const reviewsRes = await fetch('/api/my-reviews')
                if (reviewsRes.ok) {
                    const reviews = await reviewsRes.json()
                    reviewedPromoIds.clear()
                    reviews.forEach(r => {
                        if (r.promoCodeId) reviewedPromoIds.add(r.promoCodeId)
                    })
                }
            } catch (err) {
                console.error('Failed to load reviews:', err)
            }

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
                
                ${!reviewedPromoIds.has(promo.id) ? `<button class="ghost" style="width:100%;font-size:13px" onclick='showReviewForm("${promo.id}", "${promo.productId}", "${promo.productTitle}")'>⭐ Оставить отзыв</button>` : '<div class="text-small muted text-center" style="padding:8px">✓ Отзыв оставлен</div>'}
                
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

    // Review Modal
    const reviewModal = document.getElementById('reviewModal')
    const reviewProductTitle = document.getElementById('reviewProductTitle')
    const starRating = document.getElementById('starRating')
    const reviewComment = document.getElementById('reviewComment')
    const submitReview = document.getElementById('submitReview')
    const cancelReview = document.getElementById('cancelReview')

    let currentReviewProductId = null
    let selectedRating = 0

    // Star rating interaction
    starRating.querySelectorAll('span').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating)
            updateStarDisplay()
        })
        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.dataset.rating)
            highlightStars(rating)
        })
    })

    starRating.addEventListener('mouseleave', () => {
        highlightStars(selectedRating)
    })

    function highlightStars(rating) {
        starRating.querySelectorAll('span').forEach((star, index) => {
            star.style.opacity = index < rating ? '1' : '0.3'
        })
    }

    function updateStarDisplay() {
        highlightStars(selectedRating)
    }

    let currentReviewPromoId = null

    window.showReviewForm = function (promoId, productId, productTitle) {
        currentReviewPromoId = promoId
        currentReviewProductId = productId
        reviewProductTitle.textContent = `Отзыв: ${productTitle}`
        selectedRating = 0
        reviewComment.value = ''
        updateStarDisplay()
        reviewModal.style.display = 'flex'
    }

    cancelReview.onclick = () => {
        reviewModal.style.display = 'none'
    }

    submitReview.onclick = async () => {
        if (selectedRating === 0) {
            showToast('Выберите оценку', 'error')
            return
        }

        try {
            const res = await fetch(`/api/products/${currentReviewProductId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating: selectedRating,
                    comment: reviewComment.value.trim(),
                    promoCodeId: currentReviewPromoId
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Ошибка отправки отзыва')

            showToast('Отзыв успешно отправлен!', 'success')
            reviewModal.style.display = 'none'

            // Mark promo as reviewed
            reviewedPromoIds.add(currentReviewPromoId)

            // Reload products and promos to update ratings and buttons
            await loadProducts()
            if (currentTab === 'promos') {
                await loadPromos()
            }
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    // Initial load
    await loadUserBalance()
    await loadProducts()
})
