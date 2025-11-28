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
            card.style.cssText = 'padding:12px;border:1px solid #e6e9ef;border-radius:8px;display:grid;grid-template-columns:100px 1fr auto;gap:12px;align-items:start'

            const iconDiv = document.createElement('div')
            if (p.icon) {
                iconDiv.innerHTML = `<img src="${p.icon}" style="width:100px;height:100px;object-fit:cover;border-radius:6px"/>`
            } else {
                iconDiv.innerHTML = '<div style="width:100px;height:100px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#999">Нет фото</div>'
            }

            const infoDiv = document.createElement('div')
            const quantityStatus = (p.quantity || 0) > 0 ? `✓ ${p.quantity} шт.` : '❌ Закончилось'
            const quantityColor = (p.quantity || 0) > 0 ? '#4CAF50' : '#f44336'
            infoDiv.innerHTML = `
                <div style="font-weight:700;font-size:1.1rem">${p.title}</div>
                <div class="muted">${p.organization || 'Организация не указана'}</div>
                <div style="margin-top:6px"><strong>${p.price}</strong> баллов</div>
                <div class="muted">Срок действия: ${p.validDays || 30} дн.</div>
                <div style="margin-top:8px;padding:6px 10px;background:${quantityColor}15;border-radius:4px;color:${quantityColor};font-weight:600;font-size:0.9rem">
                    Количество: ${quantityStatus}
                </div>
            `

            const actionsDiv = document.createElement('div')
            actionsDiv.style.cssText = 'display:flex;flex-direction:column;gap:6px'

            const editBtn = document.createElement('button')
            editBtn.textContent = 'Редактировать'
            editBtn.style.cssText = 'background:#2196F3;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer'
            editBtn.onclick = () => editProduct(p)

            const deleteBtn = document.createElement('button')
            deleteBtn.textContent = 'Удалить'
            deleteBtn.style.cssText = 'background:#f44336;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer'
            deleteBtn.onclick = () => deleteProduct(p.id)

            actionsDiv.appendChild(editBtn)
            actionsDiv.appendChild(deleteBtn)

            card.appendChild(iconDiv)
            card.appendChild(infoDiv)
            card.appendChild(actionsDiv)
            productsList.appendChild(card)
        }
    }

    // Edit product
    function editProduct(product) {
        document.getElementById('productTitle').value = product.title
        document.getElementById('productPrice').value = product.price
        document.getElementById('productOrganization').value = product.organization || ''
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
