document.addEventListener('DOMContentLoaded', async () => {
    const productForm = document.getElementById('productForm')
    const addProductBtn = document.getElementById('addProductBtn')
    const productMsg = document.getElementById('productMsg')
    const productsList = document.getElementById('productsList')

    let editingProductId = null

    // Check if user is admin
    async function checkAdmin() {
        try {
            const res = await fetch('/api/me')
            if (!res.ok) {
                console.error('Failed to fetch /api/me:', res.status)
                productMsg.textContent = 'Ошибка: Требуется авторизация'
                return false
            }
            const user = await res.json()
            console.log('User:', user)
            if (user.role !== 'admin') {
                console.warn('User is not admin, role:', user.role)
                productMsg.textContent = 'Ошибка: Требуются права администратора'
                addProductBtn.disabled = true
                return false
            }
            console.log('User is admin, role:', user.role)
            return true
        } catch (err) {
            console.error('Error checking admin:', err)
            productMsg.textContent = 'Ошибка: ' + err.message
            return false
        }
    }

    // Load and display products (with all products including 0 quantity)
    async function loadProducts() {
        productsList.innerHTML = 'Загрузка...'
        try {
            const res = await fetch('/api/products/admin/list')
            if (!res.ok) throw new Error('Failed to load products')
            const contentType = res.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response from server')
            }
            const products = await res.json()
            displayProducts(products)
        } catch (err) {
            productsList.innerHTML = '<p style="color:red">Ошибка загрузки товаров: ' + err.message + '</p>'
        }
    }

    // Display products in list
    function displayProducts(products) {
        productsList.innerHTML = ''
        if (!products || products.length === 0) {
            productsList.innerHTML = '<p class="muted">Товаров нет. Добавьте первый товар выше.</p>'
            return
        }

        for (const p of products) {
            const card = document.createElement('div')
            card.className = 'product-admin-card'
            card.style.cssText = 'padding:14px;border:1px solid var(--divider);border-radius:var(--radius);background:var(--card)'

            // Main container with flex layout
            const container = document.createElement('div')
            container.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap'

            const iconDiv = document.createElement('div')
            iconDiv.style.cssText = 'flex-shrink:0'
            if (p.icon) {
                iconDiv.innerHTML = `<img src="${p.icon}" style="width:80px;height:80px;object-fit:cover;border-radius:8px"/>`
            } else {
                iconDiv.innerHTML = '<div style="width:80px;height:80px;background:var(--input-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;text-align:center">Нет фото</div>'
            }

            const infoDiv = document.createElement('div')
            infoDiv.style.cssText = 'flex:1;min-width:150px'
            const quantityStatus = (p.quantity || 0) > 0 ? `✓ ${p.quantity} шт.` : '❌ Закончилось'
            const quantityColor = (p.quantity || 0) > 0 ? 'var(--accent)' : '#f44336'

            const categoryNames = {
                food: '🍔 Еда',
                entertainment: '🎬 Развлечения',
                shopping: '🛍️ Покупки',
                services: '💼 Услуги',
                other: '📦 Другое'
            }
            const categoryLabel = categoryNames[p.category] || categoryNames.other

            infoDiv.innerHTML = `
                <div style="font-weight:700;font-size:16px;margin-bottom:4px">${p.title}</div>
                <div class="muted text-small" style="margin-bottom:6px">${p.organization || 'Организация не указана'}</div>
                <div style="font-weight:600;color:var(--accent);margin-bottom:4px">${p.price} баллов</div>
                <div class="muted text-small">Категория: ${categoryLabel}</div>
                <div class="muted text-small">Срок: ${p.validDays || 30} дн.</div>
                <div style="margin-top:8px;display:inline-block;padding:4px 10px;background:${quantityColor}15;border-radius:6px;color:${quantityColor};font-weight:600;font-size:12px">
                    ${quantityStatus}
                </div>
            `

            const actionsDiv = document.createElement('div')
            actionsDiv.style.cssText = 'display:flex;gap:8px;width:100%;margin-top:12px;padding-top:12px;border-top:1px solid var(--divider)'

            const editBtn = document.createElement('button')
            editBtn.textContent = '✏️ Редактировать'
            editBtn.className = 'secondary'
            editBtn.style.cssText = 'flex:1;font-size:13px;height:38px'
            editBtn.onclick = () => editProduct(p)

            const deleteBtn = document.createElement('button')
            deleteBtn.textContent = '🗑️ Удалить'
            deleteBtn.className = 'ghost'
            deleteBtn.style.cssText = 'flex:1;font-size:13px;height:38px;background:#fee;color:#c00'
            deleteBtn.onclick = () => deleteProduct(p.id)

            actionsDiv.appendChild(editBtn)
            actionsDiv.appendChild(deleteBtn)

            container.appendChild(iconDiv)
            container.appendChild(infoDiv)
            card.appendChild(container)
            card.appendChild(actionsDiv)
            productsList.appendChild(card)
        }
    }

    // Edit product
    function editProduct(product) {
        document.getElementById('productTitle').value = product.title
        document.getElementById('productPrice').value = product.price
        document.getElementById('productOrganization').value = product.organization || ''
        document.getElementById('productCategory').value = product.category || 'other'
        document.getElementById('productValidDays').value = product.validDays || 30
        document.getElementById('productQuantity').value = product.quantity || 0
        document.getElementById('productIcon').value = ''
        editingProductId = product.id
        addProductBtn.textContent = 'Сохранить товар'
        productForm.scrollIntoView({ behavior: 'smooth' })
    }

    // Add or update product
    addProductBtn.onclick = async () => {
        const isAdmin = await checkAdmin()
        if (!isAdmin) return

        const title = document.getElementById('productTitle').value.trim()
        const price = parseInt(document.getElementById('productPrice').value, 10)
        const organization = document.getElementById('productOrganization').value.trim()
        const category = document.getElementById('productCategory').value
        const validDays = parseInt(document.getElementById('productValidDays').value, 10)
        const quantity = parseInt(document.getElementById('productQuantity').value, 10)
        const iconInput = document.getElementById('productIcon')

        if (!title || !price || isNaN(price) || price <= 0) {
            productMsg.textContent = 'Заполните название и цену'
            return
        }

        if (isNaN(quantity) || quantity < 0) {
            productMsg.textContent = 'Некорректное количество'
            return
        }

        productMsg.textContent = 'Обработка...'
        try {
            const formData = new FormData()
            formData.append('title', title)
            formData.append('price', price)
            formData.append('quantity', quantity)
            formData.append('category', category)
            if (organization) formData.append('organization', organization)
            if (!isNaN(validDays) && validDays > 0) formData.append('validDays', validDays)
            if (iconInput.files.length > 0) formData.append('icon', iconInput.files[0])

            let res
            if (editingProductId) {
                res = await fetch('/api/products/' + editingProductId, {
                    method: 'PUT',
                    body: formData
                })
            } else {
                res = await fetch('/api/products', {
                    method: 'POST',
                    body: formData
                })
            }

            // Log the response for debugging
            console.log('Response status:', res.status, 'Content-Type:', res.headers.get('content-type'))

            // Check status first
            if (res.status === 401 || res.status === 403) {
                throw new Error('Доступ запрещён. Требуются права администратора.')
            }

            // Try to parse JSON
            let j
            try {
                j = await res.json()
            } catch (parseErr) {
                const text = await res.text()
                console.error('Failed to parse response:', text.substring(0, 200))
                throw new Error('Ошибка сервера: неверный ответ. ' + (text.substring(0, 50) || 'Unknown'))
            }

            if (!res.ok) throw new Error(j.error || 'Ошибка при сохранении')

            productMsg.textContent = editingProductId ? 'Товар обновлён' : 'Товар добавлен'
            productForm.reset()
            editingProductId = null
            addProductBtn.textContent = 'Добавить товар'

            setTimeout(() => { productMsg.textContent = '' }, 3000)
            loadProducts()
        } catch (err) {
            console.error('Error:', err)
            productMsg.textContent = 'Ошибка: ' + err.message
        }
    }

    // Delete product
    async function deleteProduct(productId) {
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) return

        try {
            const res = await fetch('/api/products/' + productId, { method: 'DELETE' })
            const contentType = res.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('Доступ запрещён. Проверьте, что вы авторизованы как администратор')
                }
                throw new Error('Invalid response from server')
            }
            const j = await res.json()
            if (!res.ok) throw new Error(j.error || 'Failed to delete')
            alert('Товар удалён')
            loadProducts()
        } catch (err) {
            alert('Ошибка: ' + err.message)
        }
    }

    // Initial load
    checkAdmin().then(isAdmin => {
        if (isAdmin) {
            loadProducts()
        } else {
            productsList.innerHTML = '<p style="color:red">Доступ запрещён. Требуются права администратора.</p>'
        }
    })
})
