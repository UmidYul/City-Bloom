// Settings page functionality
document.addEventListener('DOMContentLoaded', () => {
    loadSettings()
    attachEventListeners()
})

// Load saved settings
function loadSettings() {
    // Language
    const currentLang = i18n.getCurrentLanguage()
    const langRadio = document.querySelector(`input[name="language"][value="${currentLang}"]`)
    if (langRadio) langRadio.checked = true

    // Theme
    const theme = localStorage.getItem('citybloom_theme') || 'light'
    const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`)
    if (themeRadio) themeRadio.checked = true
    applyTheme(theme)

    // Notifications
    const notifyApproval = localStorage.getItem('notify_approval') !== 'false'
    const notifyAchievements = localStorage.getItem('notify_achievements') !== 'false'
    const notifyProducts = localStorage.getItem('notify_products') !== 'false'

    document.getElementById('notifyApproval').checked = notifyApproval
    document.getElementById('notifyAchievements').checked = notifyAchievements
    document.getElementById('notifyProducts').checked = notifyProducts

    // Privacy
    const publicProfile = localStorage.getItem('public_profile') !== 'false'
    const showOnMap = localStorage.getItem('show_on_map') !== 'false'

    document.getElementById('publicProfile').checked = publicProfile
    document.getElementById('showOnMap').checked = showOnMap
}

// Attach event listeners
function attachEventListeners() {
    // Language change
    document.querySelectorAll('input[name="language"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const lang = e.target.value
            await i18n.switchLanguage(lang)
            window.location.reload()
        })
    })

    // Theme change
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const theme = e.target.value
            localStorage.setItem('citybloom_theme', theme)
            applyTheme(theme)
        })
    })

    // Notifications
    document.getElementById('notifyApproval').addEventListener('change', (e) => {
        localStorage.setItem('notify_approval', e.target.checked)
    })
    document.getElementById('notifyAchievements').addEventListener('change', (e) => {
        localStorage.setItem('notify_achievements', e.target.checked)
    })
    document.getElementById('notifyProducts').addEventListener('change', (e) => {
        localStorage.setItem('notify_products', e.target.checked)
    })

    // Privacy
    document.getElementById('publicProfile').addEventListener('change', (e) => {
        localStorage.setItem('public_profile', e.target.checked)
    })
    document.getElementById('showOnMap').addEventListener('change', (e) => {
        localStorage.setItem('show_on_map', e.target.checked)
    })
}

// Apply theme
function applyTheme(theme) {
    const root = document.documentElement

    if (theme === 'dark') {
        root.style.setProperty('--bg', '#1a1a1a')
        root.style.setProperty('--card', '#2a2a2a')
        root.style.setProperty('--text-dark', '#f0f0f0')
        root.style.setProperty('--text-gray', '#b0b0b0')
        root.style.setProperty('--text-muted', '#808080')
        root.style.setProperty('--input-bg', '#333333')
        root.style.setProperty('--border-light', '#404040')
        root.style.setProperty('--divider', 'rgba(255, 255, 255, 0.1)')
    } else if (theme === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(isDark ? 'dark' : 'light')
    } else {
        // Light theme (default)
        root.style.setProperty('--bg', '#f7f8fa')
        root.style.setProperty('--card', '#ffffff')
        root.style.setProperty('--text-dark', '#1c1c1c')
        root.style.setProperty('--text-gray', '#7a818a')
        root.style.setProperty('--text-muted', '#9ea4ae')
        root.style.setProperty('--input-bg', '#f0f3f6')
        root.style.setProperty('--border-light', '#cdd5df')
        root.style.setProperty('--divider', 'rgba(0, 0, 0, 0.06)')
    }
}

// Auto-apply theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('citybloom_theme') || 'light'
    applyTheme(theme)
})
