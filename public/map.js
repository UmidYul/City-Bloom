document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay')

    const plantTypeFilter = document.getElementById('plantTypeFilter')
    const mapEl = document.getElementById('map')

    let map
    let markerClusterGroup
    let allPlantings = []
    let filteredPlantings = []

    // Resize map to fill space between top and bottom navbars
    function resizeMapCanvas() {
        if (document.body.classList.contains('map-fullscreen')) {
            // In fullscreen, CSS controls size
            mapEl.style.height = ''
            try { map && map.invalidateSize() } catch (_) { }
            return
        }
        const header = document.querySelector('.site-header')
        const bottom = document.querySelector('.bottom-nav')
        const topH = header ? header.getBoundingClientRect().height : 0
        const bottomH = bottom ? bottom.getBoundingClientRect().height : 0
        const vh = window.innerHeight
        const target = Math.max(200, vh - topH - bottomH)
        mapEl.style.height = target + 'px'
        try { map && map.invalidateSize() } catch (_) { }
    }

    // Initialize map centered on Uzbekistan
    function initMap() {
        resizeMapCanvas()
        map = L.map('map', { zoomControl: false }).setView([41.2995, 69.2401], 6) // Tashkent coordinates

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

        // Layer for user location, added after clusters to render on top
        userLayer = L.layerGroup().addTo(map)
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

    // Show user location if permitted
    let userLayer
    function enableUserLocation() {
        if (!navigator.geolocation) return
        map.on('locationfound', (e) => {
            try { userLayer && userLayer.clearLayers() } catch (_) { }
            const { latlng, accuracy } = e
            const marker = L.circleMarker(latlng, {
                radius: 6,
                color: '#1d4ed8',
                fillColor: '#3b82f6',
                fillOpacity: 0.9,
                weight: 2
            })
            const accCircle = L.circle(latlng, {
                radius: Math.min(accuracy || 50, 200),
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 1
            })
            userLayer.addLayer(accCircle)
            userLayer.addLayer(marker)
        })
        map.on('locationerror', () => { /* silently ignore */ })
        map.locate({ enableHighAccuracy: true, setView: false, watch: false, maximumAge: 60000 })
    }

    // Create popup content
    function createPopupContent(planting) {
        const plantTypeNames = {
            tree: t ? t('map.tree') : 'Дерево',
            flower: t ? t('map.flower') : 'Цветы',
            shrub: t ? t('map.shrub') : 'Кустарник'
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
            addMarkersToMap(filteredPlantings)
        } catch (err) {
            console.error('Error loading plantings:', err)
            alert('Ошибка загрузки данных карты')
        } finally {
            loadingOverlay.classList.remove('active')
        }
    }

    // No statistics or city filter in simplified layout

    // Apply filters
    function applyFilters() {
        const plantType = plantTypeFilter.value

        filteredPlantings = allPlantings.filter(planting => {
            // Plant type filter
            if (plantType !== 'all' && planting.plantType !== plantType) {
                return false
            }

            // Only plant type filtering in simplified layout

            return true
        })

        addMarkersToMap(filteredPlantings)
    }

    // Event listeners
    plantTypeFilter.addEventListener('change', applyFilters)

    // Initialize
    initMap()
    await loadPlantings()
    // Recompute height after data load (fonts/layout may settle)
    setTimeout(resizeMapCanvas, 100)
    window.addEventListener('resize', resizeMapCanvas)
    enableUserLocation()

    // Fullscreen toggle
    const fsBtn = document.getElementById('toggleFullscreen')
    function setFsIcon() {
        if (!fsBtn) return
        const isFs = document.body.classList.contains('map-fullscreen')
        fsBtn.textContent = isFs ? '⤡' : '⤢'
        fsBtn.title = isFs ? 'Выйти из полноэкранного режима' : 'На весь экран'
    }
    function toggleFullscreen() {
        document.body.classList.toggle('map-fullscreen')
        // Let layout settle, then fix Leaflet sizing
        setTimeout(() => {
            resizeMapCanvas()
        }, 150)
        setFsIcon()
    }
    if (fsBtn) {
        fsBtn.addEventListener('click', toggleFullscreen)
        setFsIcon()
    }
    // ESC to exit fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('map-fullscreen')) {
            toggleFullscreen()
        }
    })
})
