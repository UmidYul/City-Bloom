document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay')
    const totalPlantingsEl = document.getElementById('totalPlantings')
    const totalCitiesEl = document.getElementById('totalCities')
    const totalUsersEl = document.getElementById('totalUsers')

    const plantTypeFilter = document.getElementById('plantTypeFilter')
    const dateFilter = document.getElementById('dateFilter')
    const cityFilter = document.getElementById('cityFilter')

    let map
    let markerClusterGroup
    let allPlantings = []
    let filteredPlantings = []

    // Initialize map centered on Uzbekistan
    function initMap() {
        map = L.map('map').setView([41.2995, 69.2401], 6) // Tashkent coordinates

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map)

        // Initialize marker cluster group
        markerClusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount()
                let size = 'small'
                if (count >= 10) size = 'medium'
                if (count >= 50) size = 'large'

                return L.divIcon({
                    html: `<div style="
                        background: linear-gradient(135deg, #24b06b, #1d8f56);
                        color: white;
                        border-radius: 50%;
                        width: ${size === 'small' ? '40px' : size === 'medium' ? '50px' : '60px'};
                        height: ${size === 'small' ? '40px' : size === 'medium' ? '50px' : '60px'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        font-size: ${size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px'};
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ">${count}</div>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(size === 'small' ? 40 : size === 'medium' ? 50 : 60, size === 'small' ? 40 : size === 'medium' ? 50 : 60)
                })
            }
        })

        map.addLayer(markerClusterGroup)
    }

    // Create custom marker icon based on plant type
    function getPlantIcon(plantType) {
        const icons = {
            tree: '🌳',
            flower: '🌸',
            shrub: '🌿'
        }

        const emoji = icons[plantType] || '🌱'

        return L.divIcon({
            html: `<div style="
                background: white;
                border: 3px solid #24b06b;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            ">${emoji}</div>`,
            className: 'custom-plant-icon',
            iconSize: L.point(36, 36),
            iconAnchor: L.point(18, 36)
        })
    }

    // Create popup content
    function createPopupContent(planting) {
        const plantTypeNames = {
            tree: 'Дерево',
            flower: 'Цветы',
            shrub: 'Кустарник'
        }

        const mediaHtml = planting.mediaType === 'video'
            ? `<video class="popup-media" controls>
                   <source src="${planting.media}" type="video/mp4">
               </video>`
            : `<img class="popup-media" src="${planting.media}" alt="Посадка">`

        return `
            <div class="popup-header">
                ${plantTypeNames[planting.plantType] || 'Растение'}
            </div>
            <div class="popup-body">
                ${mediaHtml}
                <div class="popup-info">
                    <div class="popup-row">
                        <span>📍</span>
                        <span>${planting.locationName}</span>
                    </div>
                    <div class="popup-row">
                        <span>👤</span>
                        <span>${planting.userName}</span>
                    </div>
                    <div class="popup-row">
                        <span>📅</span>
                        <span>${new Date(planting.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <a href="/submission/${planting.id}" style="
                    display: block;
                    margin-top: 12px;
                    padding: 10px;
                    background: linear-gradient(135deg, #24b06b, #1d8f56);
                    color: white;
                    text-align: center;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                ">Подробнее →</a>
            </div>
        `
    }

    // Add markers to map
    function addMarkersToMap(plantings) {
        markerClusterGroup.clearLayers()

        plantings.forEach(planting => {
            if (!planting.latitude || !planting.longitude) return

            const marker = L.marker([planting.latitude, planting.longitude], {
                icon: getPlantIcon(planting.plantType)
            })

            const popupContent = createPopupContent(planting)
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            })

            markerClusterGroup.addLayer(marker)
        })

        // Fit map to markers if there are any
        if (plantings.length > 0) {
            const bounds = markerClusterGroup.getBounds()
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] })
            }
        }
    }

    // Load plantings from API
    async function loadPlantings() {
        loadingOverlay.classList.add('active')
        try {
            const res = await fetch('/api/map/plantings')
            if (!res.ok) throw new Error('Failed to load plantings')

            allPlantings = await res.json()
            console.log('Loaded plantings:', allPlantings.length, allPlantings)
            filteredPlantings = allPlantings

            updateStats()
            populateCityFilter()
            addMarkersToMap(filteredPlantings)
        } catch (err) {
            console.error('Error loading plantings:', err)
            alert('Ошибка загрузки данных карты')
        } finally {
            loadingOverlay.classList.remove('active')
        }
    }

    // Update statistics
    function updateStats() {
        totalPlantingsEl.textContent = filteredPlantings.length

        const cities = new Set(filteredPlantings.map(p => p.city))
        totalCitiesEl.textContent = cities.size

        const users = new Set(filteredPlantings.map(p => p.userId))
        totalUsersEl.textContent = users.size
    }

    // Populate city filter dropdown
    function populateCityFilter() {
        const cities = [...new Set(allPlantings.map(p => p.city))].sort()

        cityFilter.innerHTML = '<option value="all">Все города</option>'
        cities.forEach(city => {
            const option = document.createElement('option')
            option.value = city
            option.textContent = city
            cityFilter.appendChild(option)
        })
    }

    // Apply filters
    function applyFilters() {
        const plantType = plantTypeFilter.value
        const dateRange = dateFilter.value
        const city = cityFilter.value

        filteredPlantings = allPlantings.filter(planting => {
            // Plant type filter
            if (plantType !== 'all' && planting.plantType !== plantType) {
                return false
            }

            // Date filter
            if (dateRange !== 'all') {
                const plantingDate = new Date(planting.createdAt)
                const now = new Date()
                const daysDiff = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24))

                if (dateRange === 'week' && daysDiff > 7) return false
                if (dateRange === 'month' && daysDiff > 30) return false
                if (dateRange === 'year' && daysDiff > 365) return false
            }

            // City filter
            if (city !== 'all' && planting.city !== city) {
                return false
            }

            return true
        })

        updateStats()
        addMarkersToMap(filteredPlantings)
    }

    // Reset filters
    window.resetFilters = function () {
        plantTypeFilter.value = 'all'
        dateFilter.value = 'all'
        cityFilter.value = 'all'
        applyFilters()
    }

    // Event listeners
    plantTypeFilter.addEventListener('change', applyFilters)
    dateFilter.addEventListener('change', applyFilters)
    cityFilter.addEventListener('change', applyFilters)

    // Initialize
    initMap()
    await loadPlantings()
})
