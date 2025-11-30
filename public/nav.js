// Navigation helper - set active nav item based on current page
function setActiveNav() {
    const pathname = window.location.pathname
    const navItems = document.querySelectorAll('.nav-item')

    navItems.forEach(item => {
        item.classList.remove('active')
        const href = item.getAttribute('href')

        if (pathname === '/' && href === '/') {
            item.classList.add('active')
        } else if (pathname.startsWith(href) && href !== '/') {
            item.classList.add('active')
        }
    })
}

// Call on page load and after navigation
document.addEventListener('DOMContentLoaded', () => {
    setActiveNav()

    // Register service worker for PWA/offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').catch(err => {
            console.warn('SW registration failed', err)
        })
    }

    // Handle profile navigation
    const profileNavLink = document.getElementById('profileNavLink')
    if (profileNavLink) {
        profileNavLink.addEventListener('click', async (e) => {
            e.preventDefault()

            try {
                const response = await fetch('/api/me')
                if (response.ok) {
                    const user = await response.json()
                    window.location.href = `/profile/${user.id}`
                } else {
                    window.location.href = '/login'
                }
            } catch (error) {
                console.error('Error loading profile:', error)
                window.location.href = '/login'
            }
        })
    }
})

// Update active nav when using back/forward buttons
window.addEventListener('popstate', () => {
    setActiveNav()
})
