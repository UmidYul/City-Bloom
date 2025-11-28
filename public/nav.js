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
})

// Update active nav when using back/forward buttons
window.addEventListener('popstate', () => {
    setActiveNav()
})
