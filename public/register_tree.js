document.addEventListener('DOMContentLoaded', () => {
    // init Leaflet map
    const mapContainer = document.getElementById('map')
    if (mapContainer) {
        const linkCSS = document.createElement('link')
        linkCSS.rel = 'stylesheet'
        linkCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(linkCSS)
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => {
            // default center: Tashkent, Uzbekistan
            const map = L.map('map').setView([41.2995, 69.2401], 12)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
            let marker = null
            function setMarker(lat, lng) {
                if (marker) marker.setLatLng([lat, lng])
                else marker = L.marker([lat, lng]).addTo(map)
                document.getElementById('lat').value = lat
                document.getElementById('lng').value = lng
            }
            map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng))
            // try geolocation
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(p => {
                    map.setView([p.coords.latitude, p.coords.longitude], 15)
                })
            }
        }
        document.body.appendChild(script)
    }

    const form = document.getElementById('plantForm')
    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData()
        fd.append('title', document.getElementById('title').value)
        fd.append('plantType', document.getElementById('plantType').value)
        fd.append('location', document.getElementById('location').value)
        fd.append('description', document.getElementById('description').value)
        const lat = document.getElementById('lat').value
        const lng = document.getElementById('lng').value
        if (lat) fd.append('lat', lat)
        if (lng) fd.append('lng', lng)
        const before = document.getElementById('beforeVideo').files[0]
        const after = document.getElementById('afterVideo').files[0]
        if (before) fd.append('beforeVideo', before)
        if (after) fd.append('afterVideo', after)

        try {
            const res = await fetch('/api/submitPlant', { method: 'POST', body: fd })
            const j = await res.json()
            if (!res.ok) throw new Error(j.error || 'Submit failed')
            alert('Заявка сохранена — ожидает одобрения администратора')
            // redirect to home page
            location.href = '/'
        } catch (err) {
            alert('Ошибка: ' + err.message)
        }
    })
})
