let achievements = [];

// Load achievements
async function loadAchievements() {
    try {
        const response = await fetch('/api/my-achievements');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            throw new Error('Ошибка загрузки достижений');
        }

        achievements = await response.json();
        renderAchievements();
        updateSummary();
    } catch (error) {
        console.error('Error loading achievements:', error);
        showToast('Не удалось загрузить достижения', 'error');
    }
}

// Render achievements grid
function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');

    if (!achievements || achievements.length === 0) {
        grid.innerHTML = '<div class="text-small muted" style="text-align:center;padding:40px;grid-column:1/-1">Нет доступных достижений</div>';
        return;
    }

    let html = '';

    achievements.forEach(achievement => {
        const isEarned = achievement.earned;
        const cardClass = isEarned ? 'achievement-card earned' : 'achievement-card locked';

        html += `
        <div class="${cardClass}">
            ${isEarned ? '<div class="earned-badge">✓ Получено</div>' : ''}
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-title">${achievement.title}</div>
            <div class="achievement-description">${achievement.description}</div>
            
            ${!isEarned ? `
                <div class="achievement-progress">
                    <div class="achievement-progress-text">${achievement.current} / ${achievement.target}</div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width:${achievement.progress}%"></div>
                    </div>
                </div>
            ` : `
                <div class="text-small muted">${formatDate(achievement.earnedAt)}</div>
            `}
            
            <div class="points-badge">+${achievement.points} баллов</div>
        </div>
        `;
    });

    grid.innerHTML = html;
}

// Update summary stats
function updateSummary() {
    const earned = achievements.filter(a => a.earned);
    const total = achievements.length;
    const percentage = total > 0 ? Math.floor((earned.length / total) * 100) : 0;
    const bonusPoints = earned.reduce((sum, a) => sum + (a.points || 0), 0);

    document.getElementById('earnedCount').textContent = `${earned.length}/${total}`;
    document.getElementById('progressPercent').textContent = `${percentage}%`;
    document.getElementById('bonusPoints').textContent = bonusPoints;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize on page load
loadAchievements();
