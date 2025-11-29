document.addEventListener('DOMContentLoaded', () => {
    let map = null
    let marker = null
    let beforeVideoFile = null
    let afterVideoFile = null

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
                        if (marker) marker.setLatLng([lat, lng])
                        else marker = L.marker([lat, lng]).addTo(map)
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
        // default center: Andijan, Uzbekistan
        map = L.map('map').setView([40.7821, 72.3442], 12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

        function setMarker(lat, lng) {
            if (marker) marker.setLatLng([lat, lng])
            else marker = L.marker([lat, lng]).addTo(map)
            document.getElementById('lat').value = lat.toFixed(6)
            document.getElementById('lng').value = lng.toFixed(6)
        }

        map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng))
    }

    // Video upload zones - BEFORE
    const beforeZone = document.getElementById('beforeZone')
    const beforeInput = document.getElementById('beforeVideo')

    if (beforeZone && beforeInput) {
        beforeZone.addEventListener('click', () => beforeInput.click())

        beforeInput.addEventListener('change', (e) => {
            const file = e.target.files[0]
            if (file) {
                // Validate file
                const validation = validateVideoFile(file, 'before')
                if (!validation.valid) {
                    showError(validation.error)
                    beforeInput.value = ''
                    return
                }

                beforeVideoFile = file
                beforeZone.classList.add('has-file')
                beforeZone.innerHTML = `
                    <div style="font-size:24px">✓</div>
                    <div class="text-medium">${file.name}</div>
                    <div class="text-small muted">${(file.size / 1024 / 1024).toFixed(1)} MB</div>
                `
            }
        })
    }    // Video upload zones - AFTER
    const afterZone = document.getElementById('afterZone')
    const afterInput = document.getElementById('afterVideo')

    if (afterZone && afterInput) {
        afterZone.addEventListener('click', () => afterInput.click())

        afterInput.addEventListener('change', (e) => {
            const file = e.target.files[0]
            if (file) {
                // Validate file
                const validation = validateVideoFile(file, 'after')
                if (!validation.valid) {
                    showError(validation.error)
                    afterInput.value = ''
                    return
                }

                afterVideoFile = file
                afterZone.classList.add('has-file')
                afterZone.innerHTML = `
                    <div style="font-size:24px">✓</div>
                    <div class="text-medium">${file.name}</div>
                    <div class="text-small muted">${(file.size / 1024 / 1024).toFixed(1)} MB</div>
                `
            }
        })
    }

    // Validate video file
    function validateVideoFile(file, type) {
        const maxSize = 50 * 1024 * 1024 // 50MB
        const allowedFormats = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi']

        if (!file) {
            return { valid: false, error: 'Файл не выбран' }
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: `Видео "${type}" слишком большое. Максимум 50MB (у вас: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
            }
        }

        if (!allowedFormats.includes(file.type)) {
            return {
                valid: false,
                error: `Неподдерживаемый формат. Используйте: MP4, WebM, MOV`
            }
        }

        return { valid: true }
    }

    function showError(message) {
        const errorMsg = document.getElementById('errorMsg')
        if (errorMsg) {
            errorMsg.textContent = message
            errorMsg.style.display = 'block'
            setTimeout(() => {
                errorMsg.style.display = 'none'
            }, 5000)
        }
    }    // Form submission
    const form = document.getElementById('plantForm')
    const submitBtn = document.getElementById('submitBtn')
    const submitText = document.getElementById('submitText')
    const errorMsg = document.getElementById('errorMsg')

    if (!form || !submitBtn || !submitText || !errorMsg) {
        console.error('Form elements not found!')
        return
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault()

        // Hide previous errors
        errorMsg.style.display = 'none'

        // Validate videos
        if (!beforeVideoFile || !afterVideoFile) {
            errorMsg.textContent = 'Пожалуйста, загрузите оба видео (ДО и ПОСЛЕ)'
            errorMsg.style.display = 'block'
            return
        }

        // Disable button and show progress
        submitBtn.disabled = true
        submitText.textContent = 'Подготовка...'

        const progressContainer = document.getElementById('uploadProgress')
        const progressBar = document.getElementById('progressBar')
        const progressPercent = document.getElementById('progressPercent')
        const uploadStatus = document.getElementById('uploadStatus')

        progressContainer.style.display = 'block'

        try {
            // Create FormData
            const formData = new FormData()
            formData.append('title', document.getElementById('title').value || '')
            formData.append('plantType', document.getElementById('plantType').value || 'Tree')
            formData.append('location', document.getElementById('location').value || '')
            formData.append('description', document.getElementById('description').value || '')

            const lat = document.getElementById('lat').value
            const lng = document.getElementById('lng').value
            if (lat) formData.append('lat', lat)
            if (lng) formData.append('lng', lng)

            formData.append('beforeVideo', beforeVideoFile)
            formData.append('afterVideo', afterVideoFile)

            console.log('Submitting plant registration...')

            // Simulate upload progress
            let progress = 0
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15
                if (progress > 90) progress = 90
                progressBar.style.width = progress + '%'
                progressPercent.textContent = Math.round(progress) + '%'

                if (progress < 30) {
                    uploadStatus.textContent = 'Загрузка видео...'
                } else if (progress < 60) {
                    uploadStatus.textContent = 'Обработка данных...'
                } else {
                    uploadStatus.textContent = 'Почти готово...'
                }
            }, 300)

            // Send request
            const response = await fetch('/api/submitPlant', {
                method: 'POST',
                body: formData
            })

            clearInterval(progressInterval)
            progressBar.style.width = '100%'
            progressPercent.textContent = '100%'

            console.log('Response status:', response.status)

            const result = await response.json()
            console.log('Response data:', result)

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка при отправке')
            }

            // Success
            uploadStatus.textContent = '✓ Успешно!'
            submitText.textContent = '✓ Success!'

            // Show success toast
            showToast('Plant registered! ✓', 'success')

            // Redirect after delay
            setTimeout(() => {
                window.location.href = '/'
            }, 1500)

        } catch (err) {
            console.error('Submit error:', err)
            progressContainer.style.display = 'none'
            errorMsg.textContent = err.message || 'Ошибка отправки. Попробуйте еще раз.'
            errorMsg.style.display = 'block'
            submitBtn.disabled = false
            submitText.textContent = 'Plant it!'
        }
    }); function showToast(message, type = 'success') {
        const toast = document.createElement('div')
        toast.className = `toast ${type}`
        toast.textContent = message
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
    }
})