// Notifications Page JavaScript
let currentFilter = 'all';
let allNotifications = [];

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Failed to load notifications');

        allNotifications = await response.json();
        renderNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        document.getElementById('notificationsList').innerHTML =
            '<p style="color: #e74c3c; text-align: center; padding: 16px;">Ошибка загрузки уведомлений</p>';
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const emptyState = document.getElementById('emptyState');

    // Filter notifications based on current filter
    let filtered = allNotifications;
    if (currentFilter === 'unread') {
        filtered = allNotifications.filter(n => !n.read);
    } else if (currentFilter === 'read') {
        filtered = allNotifications.filter(n => n.read);
    }

    if (filtered.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';

    container.innerHTML = filtered.map(notification => {
        const icon = getNotificationIcon(notification.type);
        const time = formatTime(notification.createdAt);
        const unreadClass = notification.read ? '' : 'unread-notification';

        return `
            <div class="notification-card ${unreadClass}" data-id="${notification.id}">
                <div style="display: flex; gap: 12px;">
                    <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${notification.title}</h3>
                            ${!notification.read ? `<button onclick="markAsRead('${notification.id}')" title="Отметить прочитанным" style="background:none;border:none;padding:4px 8px;color:#666;cursor:pointer;font-size:16px;">✓</button>` : ''}
                        </div>
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${notification.message}</p>
                        <div style="font-size: 12px; color: #999;">${time}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getNotificationIcon(type) {
    const icons = {
        submission_approved: '✅',
        submission_declined: '❌',
        achievement_unlocked: '🏆',
        level_up: '⬆️',
        new_product: '🎁',
        promo_expiring: '⏰'
    };
    return icons[type] || '🔔';
}

function formatTime(timestamp) {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;

    return new Date(timestamp).toLocaleDateString('ru-RU');
}

async function markAsRead(id) {
    try {
        const response = await fetch(`/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const notification = allNotifications.find(n => n.id === id);
            if (notification) notification.read = true;
            renderNotifications();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    try {
        const response = await fetch('/api/notifications/mark-all-read', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            allNotifications.forEach(n => n.read = true);
            renderNotifications();
        }
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

// Event Listeners
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderNotifications();
    });
});

// Initial load
loadNotifications();

// Auto-refresh every 30 seconds
setInterval(loadNotifications, 30000);
