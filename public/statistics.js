let plantingsChart = null;
let plantTypesChart = null;
let allActivities = [];

// Load all statistics data
async function loadStatistics() {
    try {
        const response = await fetch('/api/my-stats');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            throw new Error('Ошибка загрузки статистики');
        }

        const data = await response.json();
        renderStatistics(data);
    } catch (error) {
        console.error('Error loading statistics:', error);
        showToast('Не удалось загрузить статистику', 'error');
    }
}

// Render all statistics components
function renderStatistics(data) {
    // Summary cards
    document.getElementById('totalPlantings').textContent = data.summary.totalPlantings;
    document.getElementById('thisMonth').textContent = data.summary.thisMonth;
    document.getElementById('totalEarned').textContent = data.summary.totalEarned;
    document.getElementById('totalSpent').textContent = data.summary.totalSpent;

    // Charts
    renderPlantingsChart(data.monthlyPlantings);
    renderPlantTypesChart(data.plantTypes);

    // Activity calendar
    renderActivityCalendar(data.activityCalendar);

    // Activity timeline
    allActivities = data.activities;
    renderActivityTimeline(allActivities);
}

// Render monthly plantings bar chart
function renderPlantingsChart(monthlyData) {
    const ctx = document.getElementById('plantingsChart');

    if (plantingsChart) {
        plantingsChart.destroy();
    }

    const labels = monthlyData.map(item => item.month);
    const values = monthlyData.map(item => item.count);

    plantingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Посадки',
                data: values,
                backgroundColor: 'rgba(52, 211, 153, 0.6)',
                borderColor: 'rgba(52, 211, 153, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Render plant types pie chart
function renderPlantTypesChart(typesData) {
    const ctx = document.getElementById('plantTypesChart');

    if (plantTypesChart) {
        plantTypesChart.destroy();
    }

    const labels = typesData.map(item => item.type || 'Не указано');
    const values = typesData.map(item => item.count);

    const colors = [
        'rgba(52, 211, 153, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(234, 179, 8, 0.8)'
    ];

    plantTypesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Render activity calendar (GitHub-style)
function renderActivityCalendar(calendarData) {
    const container = document.getElementById('activityCalendar');

    if (!calendarData || calendarData.length === 0) {
        container.innerHTML = '<div class="text-small muted">Нет данных для отображения</div>';
        return;
    }

    // Group by weeks
    const weeks = [];
    for (let i = 0; i < calendarData.length; i += 7) {
        weeks.push(calendarData.slice(i, i + 7));
    }

    let html = '<div style="display:flex;gap:4px;flex-direction:column">';

    weeks.forEach(week => {
        html += '<div style="display:flex;gap:4px">';
        week.forEach(day => {
            const intensity = getIntensityColor(day.count);
            const tooltipText = `${day.date}: ${day.count} ${pluralize(day.count, 'посадка', 'посадки', 'посадок')}`;

            html += `<div 
                style="width:14px;height:14px;background:${intensity};border-radius:3px;cursor:pointer" 
                title="${tooltipText}">
            </div>`;
        });
        html += '</div>';
    });

    html += '</div>';

    // Legend
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--text-muted)">';
    html += '<span>Меньше</span>';
    html += '<div style="width:14px;height:14px;background:#ebedf0;border-radius:3px"></div>';
    html += '<div style="width:14px;height:14px;background:#c6e48b;border-radius:3px"></div>';
    html += '<div style="width:14px;height:14px;background:#7bc96f;border-radius:3px"></div>';
    html += '<div style="width:14px;height:14px;background:#239a3b;border-radius:3px"></div>';
    html += '<div style="width:14px;height:14px;background:#196127;border-radius:3px"></div>';
    html += '<span>Больше</span>';
    html += '</div>';

    container.innerHTML = html;
}

function getIntensityColor(count) {
    if (count === 0) return '#ebedf0';
    if (count === 1) return '#c6e48b';
    if (count === 2) return '#7bc96f';
    if (count === 3) return '#239a3b';
    return '#196127';
}

// Render activity timeline
function renderActivityTimeline(activities) {
    const container = document.getElementById('activityTimeline');

    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="text-small muted" style="text-align:center;padding:24px">Нет активности</div>';
        return;
    }

    let html = '';

    activities.forEach(activity => {
        const icon = getActivityIcon(activity.type);
        const color = getActivityColor(activity.type);
        const timeAgo = formatTimeAgo(new Date(activity.date));

        html += `
        <div style="display:flex;gap:12px;padding:12px;border-left:3px solid ${color};margin-bottom:12px;background:var(--input-bg);border-radius:8px">
            <div style="font-size:24px;min-width:24px">${icon}</div>
            <div style="flex:1">
                <div style="font-weight:600;margin-bottom:4px">${activity.title}</div>
                <div class="text-small muted">${activity.description}</div>
                <div class="text-small" style="color:${color};margin-top:4px">${timeAgo}</div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

function getActivityIcon(type) {
    const icons = {
        planting: '🌱',
        approval: '✅',
        decline: '❌',
        reward: '🎁',
        purchase: '🛒'
    };
    return icons[type] || '📌';
}

function getActivityColor(type) {
    const colors = {
        planting: '#34d399',
        approval: '#10b981',
        decline: '#ef4444',
        reward: '#f59e0b',
        purchase: '#3b82f6'
    };
    return colors[type] || '#6b7280';
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;

    return date.toLocaleDateString('ru-RU');
}

function pluralize(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

// Filter activity timeline
document.getElementById('activityFilter').addEventListener('change', (e) => {
    const filter = e.target.value;

    let filtered = allActivities;
    if (filter !== 'all') {
        filtered = allActivities.filter(activity => {
            if (filter === 'plantings') return activity.type === 'planting';
            if (filter === 'rewards') return activity.type === 'reward' || activity.type === 'purchase';
            if (filter === 'approvals') return activity.type === 'approval' || activity.type === 'decline';
            return true;
        });
    }

    renderActivityTimeline(filtered);
});

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
loadStatistics();
