// Notifications component
class NotificationsComponent {
    constructor() {
        this.notifications = []
        this.unreadCount = 0
        this.dropdownOpen = false
        this.init()
    }

    async init() {
        await this.loadNotifications()
        this.render()
        this.attachEventListeners()

        // Refresh every 30 seconds
        setInterval(() => this.loadNotifications(), 30000)
    }

    async loadNotifications() {
        try {
            const res = await fetch('/api/notifications')
            if (res.ok) {
                this.notifications = await res.json()
                this.unreadCount = this.notifications.filter(n => !n.read).length
                this.updateBadge()
            }
        } catch (err) {
            console.error('Failed to load notifications:', err)
        }
    }

    render() {
        const container = document.getElementById('notifications-container')
        if (!container) return

        container.className = 'notifications-container'
        container.innerHTML = `
            <div class="notifications-bell" id="notifications-bell">
                🔔
                <span class="notifications-badge" id="notifications-badge" style="display: none;">0</span>
            </div>
            <div class="notifications-dropdown" id="notifications-dropdown">
                <div class="notifications-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <h3 style="margin:0;font-size:16px;">Уведомления</h3>
                </div>
                <div class="notifications-list" id="notifications-list">
                    <!-- Notifications will be rendered here -->
                </div>
                <div style="padding: 12px; border-top: 1px solid #eee; text-align: center;">
                    <a href="/notifications" style="color: var(--accent); text-decoration: none; font-size: 14px; font-weight: 500;">Смотреть все →</a>
                </div>
            </div>
        `

        this.updateBadge()
        this.renderList()
    }

    updateBadge() {
        const badge = document.getElementById('notifications-badge')
        if (!badge) return

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount
            badge.style.display = 'block'
        } else {
            badge.style.display = 'none'
        }
    }

    renderList() {
        const list = document.getElementById('notifications-list')
        if (!list) return

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notifications-empty">
                    <div class="notifications-empty-icon">📭</div>
                    <div>Нет уведомлений</div>
                </div>
            `
            return
        }

        list.innerHTML = this.notifications.map(n => `
            <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${this.formatTime(n.createdAt)}</div>
            </div>
        `).join('')
    }

    formatTime(dateString) {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Только что'
        if (diffMins < 60) return `${diffMins} мин назад`
        if (diffHours < 24) return `${diffHours} ч назад`
        if (diffDays < 7) return `${diffDays} дн назад`

        return date.toLocaleDateString()
    }

    attachEventListeners() {
        // Toggle dropdown
        document.addEventListener('click', (e) => {
            const bell = document.getElementById('notifications-bell')
            const dropdown = document.getElementById('notifications-dropdown')

            if (!bell || !dropdown) return

            if (bell.contains(e.target)) {
                this.dropdownOpen = !this.dropdownOpen
                dropdown.classList.toggle('active', this.dropdownOpen)
            } else if (!dropdown.contains(e.target)) {
                this.dropdownOpen = false
                dropdown.classList.remove('active')
            }
        })

        // Mark single as read or delete
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('notification-mark-read')) {
                const id = e.target.dataset.id
                await this.markAsRead(id)
            }
        })
    }

    async markAsRead(id) {
        try {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: 'PATCH'
            })
            if (res.ok) {
                await this.loadNotifications()
                this.renderList()
            }
        } catch (err) {
            console.error('Failed to mark notification as read:', err)
        }
    }

    async markAllAsRead() {
        try {
            const res = await fetch('/api/notifications/mark-all-read', {
                method: 'PATCH'
            })
            if (res.ok) {
                await this.loadNotifications()
                this.renderList()
            }
        } catch (err) {
            console.error('Failed to mark all as read:', err)
        }
    }
}

// Initialize notifications when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NotificationsComponent()
    })
} else {
    new NotificationsComponent()
}
