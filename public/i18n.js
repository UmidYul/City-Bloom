// Simple i18n system for City Bloom
class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('citybloom_lang') || 'ru'
        this.translations = {}
        this.fallbackLang = 'ru'
    }

    async init() {
        await this.loadLanguage(this.currentLang)
    }

    async loadLanguage(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`)
            if (!response.ok) throw new Error(`Failed to load ${lang}`)
            this.translations = await response.json()
            this.currentLang = lang
            localStorage.setItem('citybloom_lang', lang)
            document.documentElement.lang = lang
            return true
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error)
            if (lang !== this.fallbackLang) {
                return this.loadLanguage(this.fallbackLang)
            }
            return false
        }
    }

    t(key, params = {}) {
        const keys = key.split('.')
        let value = this.translations

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k]
            } else {
                console.warn(`Translation key not found: ${key}`)
                return key
            }
        }

        if (typeof value !== 'string') {
            console.warn(`Translation value is not a string: ${key}`)
            return key
        }

        // Simple template replacement {{param}}
        return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match
        })
    }

    async switchLanguage(lang) {
        const success = await this.loadLanguage(lang)
        if (success) {
            // Trigger custom event for components to re-render
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }))
        }
        return success
    }

    getCurrentLanguage() {
        return this.currentLang
    }

    getAvailableLanguages() {
        return [
            { code: 'ru', name: 'Русский', flag: '🇷🇺' },
            { code: 'uz', name: 'O\'zbekcha', flag: '🇺🇿' },
            { code: 'en', name: 'English', flag: '🇬🇧' }
        ]
    }
}

// Global instance
const i18n = new I18n()

// Helper function for quick access
function t(key, params) {
    return i18n.t(key, params)
}

// Auto-translate elements with data-i18n attribute
function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n')
        const text = i18n.t(key)

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.hasAttribute('placeholder')) {
                el.placeholder = text
            } else {
                el.value = text
            }
        } else {
            el.textContent = text
        }
    })

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder')
        el.placeholder = i18n.t(key)
    })

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title')
        el.title = i18n.t(key)
    })
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await i18n.init()
    translatePage()
})

// Re-translate when language changes
window.addEventListener('languageChanged', () => {
    translatePage()
})
