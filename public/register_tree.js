document.addEventListener('DOMContentLoaded', () => {
    let map = null
    let marker = null

    // Plant type pills
    const pills = document.querySelectorAll('.pill[data-type]')
    const plantTypeInput = document.getElementById('plantType')

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'))
            pill.classList.add('active')
            plantTypeInput.value = pill.dataset.type
        })
    })

    // Geolocation button
    const geoBtn = document.getElementById('geoBtn')
    if (geoBtn) {
        geoBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                geoBtn.textContent = '⏳'
                navigator.geolocation.getCurrentPosition(p => {
                    const lat = p.coords.latitude
                    const lng = p.coords.longitude
                    document.getElementById('lat').value = lat.toFixed(6)
                    document.getElementById('lng').value = lng.toFixed(6)
                    if (map) {
                        map.setView([lat, lng], 15)
                        setMarker(lat, lng)
                    }
                    geoBtn.textContent = '✓'
                    setTimeout(() => geoBtn.textContent = '📍', 1500)
                }, err => {
                    console.error('Geolocation error:', err)
                    geoBtn.textContent = '❌'
                    setTimeout(() => geoBtn.textContent = '📍', 1500)
                })
            }
        })
    }

    // Init Leaflet map
    const mapContainer = document.getElementById('map')
    if (mapContainer && typeof L !== 'undefined') {
        // default center: Tashkent, Uzbekistan
        map = L.map('map').setView([41.2995, 69.2401], 12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

        function setMarker(lat, lng) {
            if (marker) marker.setLatLng([lat, lng])
            else marker = L.marker([lat, lng]).addTo(map)
            document.getElementById('lat').value = lat.toFixed(6)
            document.getElementById('lng').value = lng.toFixed(6)
        }

        map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng))
    }

    // Video upload zones
    setupUploadZone('beforeZone', 'beforeVideo', 'beforePreview')
    setupUploadZone('afterZone', 'afterVideo', 'afterPreview')

    function setupUploadZone(zoneId, inputId, previewId) {
        const zone = document.getElementById(zoneId)
        const input = document.getElementById(inputId)
        const preview = document.getElementById(previewId)

        if (!zone || !input || !preview) return

        zone.addEventListener('click', () => input.click())

        input.addEventListener('change', () => {
            const file = input.files[0]
            if (file) {
                zone.classList.add('has-file')
                zone.innerHTML = `<div style="font-size:24px">✓</div><div class="text-medium">${file.name}</div><div class="text-small muted">${(file.size / 1024 / 1024).toFixed(1)} MB</div>`

                // Show video preview
                const url = URL.createObjectURL(file)
                preview.innerHTML = `<div class="video-preview"><video src="${url}" controls></video></div>`
                preview.style.display = 'block'

                validateForm()
            }
        })
    }

    // Form validation
    function validateForm() {
        const beforeFile = document.getElementById('beforeVideo').files[0]
        const afterFile = document.getElementById('afterVideo').files[0]
        const submitBtn = document.getElementById('submitBtn')

        // Require both videos
        if (beforeFile && afterFile) {
            submitBtn.disabled = false
        } else {
            submitBtn.disabled = true
        }
    }

    // Form submission
    const form = document.getElementById('plantForm')
    const submitBtn = document.getElementById('submitBtn')
    const submitText = document.getElementById('submitText')
    const errorMsg = document.getElementById('errorMsg')

    form.addEventListener('submit', async (e) => {
        e.preventDefault()

        if (submitBtn.disabled) return

        submitBtn.disabled = true
        submitText.textContent = 'Submitting...'
        errorMsg.style.display = 'none'

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

            // Success - show toast and redirect
            showToast('Plant registered! ✓', 'success')
            setTimeout(() => {
                location.href = '/'
            }, 1500)
        } catch (err) {
            console.error('Submit error:', err)
            errorMsg.textContent = err.message || 'Ошибка отправки. Попробуйте еще раз.'
            errorMsg.style.display = 'block'
            submitBtn.disabled = false
            submitText.textContent = 'Plant it!'
        }
    })

    function showToast(message, type = 'success') {
        const toast = document.createElement('div')
        toast.className = `toast ${type}`
        toast.textContent = message
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
    }
})
