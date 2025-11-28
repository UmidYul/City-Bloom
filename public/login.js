document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form[action="/login"][method="post"]')
    const msg = document.getElementById('loginMsg')
    if (!form) return

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (msg) {
            msg.textContent = ''
        }
        const formData = new FormData(form)
        const phone = formData.get('phone') || ''
        const password = formData.get('password') || ''

        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ phone, password })
            })
            if (res.ok) {
                const data = await res.json()
                // Redirect to admin or home depending on role returned
                if (data && data.user && data.user.role === 'admin') {
                    window.location.href = '/admin'
                } else {
                    window.location.href = '/'
                }
                return
            }

            // show friendly error messages based on server response
            let errMsg = 'Ошибка входа'
            try {
                const body = await res.json()
                if (body && body.error) {
                    if (body.error.toLowerCase().includes('invalid')) errMsg = 'Неверный логин или пароль'
                    else errMsg = body.error
                }
            } catch (parseErr) {
                // non-json response
                errMsg = 'Ошибка сервера'
            }
            if (msg) msg.textContent = errMsg
        } catch (err) {
            if (msg) msg.textContent = 'Ошибка сети. Попробуйте еще раз.'
            console.error('Login error', err)
        }
    })
})
