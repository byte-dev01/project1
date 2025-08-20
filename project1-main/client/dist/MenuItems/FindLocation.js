/**
 * UCLA Health Immediate Care Location Finder
 * JavaScript Module
 */

class ImmediateCareLocationFinder {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            mapApiKey: options.mapApiKey || 'YOUR_MAP_API_KEY',
            defaultCenter: options.defaultCenter || [34.05, -118.45],
            defaultZoom: options.defaultZoom || 10,
            maxNearbyResults: options.maxNearbyResults || 5,
            ...options
        };

        // Initialize data
        this.locations = this.getLocationData();
        this.map = null;
        this.markers = [];
        this.selectedLocationId = null;
        this.currentFilter = 'all';
        this.userLocation = null;

        // Initialize the finder
        this.init();
    }

    // Location data
    getLocationData() {
        return [
            {
                id: 1,
                name: "UCLA Health Century City Immediate Care",
                address: "1800 Century Park E, Los Angeles, CA 90067",
                phone: "(310) 286-0122",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.0606, -118.4163],
                waitTime: 25,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray"]
            },
            {
                id: 2,
                name: "UCLA Health Culver City Immediate Care",
                address: "6000 Sepulveda Blvd, Culver City, CA 90230",
                phone: "(310) 398-4500",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.0024, -118.3966],
                waitTime: 45,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services"]
            },
            {
                id: 3,
                name: "UCLA Health Malibu Immediate Care",
                address: "23815 Stuart Ranch Rd, Malibu, CA 90265",
                phone: "(310) 456-7551",
                hours: {
                    mon: "8:00 AM - 6:00 PM",
                    tue: "8:00 AM - 6:00 PM",
                    wed: "8:00 AM - 6:00 PM",
                    thu: "8:00 AM - 6:00 PM",
                    fri: "8:00 AM - 6:00 PM",
                    sat: "Closed",
                    sun: "Closed"
                },
                coordinates: [34.0354, -118.6853],
                waitTime: 0,
                isOpen: false,
                services: ["Walk-in", "Appointments"]
            },
            {
                id: 4,
                name: "UCLA Health Marina Del Rey Immediate Care",
                address: "4650 Lincoln Blvd, Marina Del Rey, CA 90292",
                phone: "(310) 823-8911",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [33.9785, -118.4369],
                waitTime: 30,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray", "Sports Medicine"]
            },
            {
                id: 5,
                name: "UCLA Health Redondo Beach Immediate Care",
                address: "514 N Prospect Ave, Redondo Beach, CA 90277",
                phone: "(310) 517-4700",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [33.8703, -118.3759],
                waitTime: 15,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services"]
            },
            {
                id: 6,
                name: "UCLA Health Santa Clarita Immediate Care",
                address: "23838 Valencia Blvd, Valencia, CA 91355",
                phone: "(661) 799-8100",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.4149, -118.5558],
                waitTime: 20,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray"]
            },
            {
                id: 7,
                name: "UCLA Health Santa Monica 16th Street Immediate Care",
                address: "1245 16th St, Santa Monica, CA 90404",
                phone: "(310) 319-4500",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.0295, -118.4889],
                waitTime: 35,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray", "Occupational Health"]
            },
            {
                id: 8,
                name: "UCLA Health Santa Monica Wilshire Immediate Care",
                address: "2424 Wilshire Blvd, Santa Monica, CA 90403",
                phone: "(310) 828-0811",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.0372, -118.4819],
                waitTime: 40,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services"]
            },
            {
                id: 9,
                name: "UCLA Health Thousand Oaks Immediate Care",
                address: "401 Rolling Oaks Dr, Thousand Oaks, CA 91361",
                phone: "(805) 418-2100",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.1705, -118.8376],
                waitTime: 0,
                isOpen: false,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray"]
            },
            {
                id: 10,
                name: "UCLA Health Toluca Lake Immediate Care",
                address: "4323 Riverside Dr, Burbank, CA 91505",
                phone: "(818) 843-8600",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.1578, -118.3487],
                waitTime: 0,
                isOpen: false,
                services: ["Walk-in", "Appointments", "Lab Services"]
            },
            {
                id: 11,
                name: "UCLA Health Westwood Immediate Care",
                address: "10833 Le Conte Ave, Los Angeles, CA 90095",
                phone: "(310) 208-3444",
                hours: {
                    mon: "7:00 AM - 9:00 PM",
                    tue: "7:00 AM - 9:00 PM",
                    wed: "7:00 AM - 9:00 PM",
                    thu: "7:00 AM - 9:00 PM",
                    fri: "7:00 AM - 9:00 PM",
                    sat: "8:00 AM - 6:00 PM",
                    sun: "8:00 AM - 6:00 PM"
                },
                coordinates: [34.0665, -118.4455],
                waitTime: 50,
                isOpen: true,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray", "Travel Medicine"]
            },
            {
                id: 12,
                name: "UCLA Health Woodland Hills Immediate Care",
                address: "5400 Balboa Blvd, Encino, CA 91316",
                phone: "(818) 616-5100",
                hours: {
                    mon: "8:00 AM - 8:00 PM",
                    tue: "8:00 AM - 8:00 PM",
                    wed: "8:00 AM - 8:00 PM",
                    thu: "8:00 AM - 8:00 PM",
                    fri: "8:00 AM - 8:00 PM",
                    sat: "9:00 AM - 5:00 PM",
                    sun: "9:00 AM - 5:00 PM"
                },
                coordinates: [34.1683, -118.5018],
                waitTime: 0,
                isOpen: false,
                services: ["Walk-in", "Appointments", "Lab Services", "X-Ray"]
            }
        ];
    }

    // Initialize the finder
    init() {
        this.render();
        this.initMap();
        this.bindEvents();
        this.renderLocationList();
    }

    // Render HTML structure
    render() {
        const html = `
            <div class="immediate-care-finder">
                <div class="ic-emergency-banner">
                    If this is a medical emergency, <span class="alert">call 911</span> or go to the nearest emergency room. 
                    Last patient check-in 30 minutes before closing.
                </div>

                <div class="ic-search-controls">
                    <div class="ic-search-bar">
                        <div class="ic-location-dropdown">
                            <button class="ic-dropdown-button" id="dropdownButton">
                                <span id="dropdownText">Showing all locations</span>
                                <span>▼</span>
                            </button>
                            <div class="ic-dropdown-content" id="dropdownContent">
                                <div class="ic-dropdown-option selected" data-filter="all">All locations</div>
                                <div class="ic-dropdown-option" data-filter="near">Locations near me</div>
                                <div class="ic-dropdown-option" data-filter="open">Open now</div>
                            </div>
                        </div>
                        <div class="ic-search-input-container">
                            <input type="text" class="ic-search-input" id="zipSearch" placeholder="Enter ZIP code">
                            <button class="ic-search-button" id="searchButton">Search</button>
                        </div>
                    </div>
                </div>

                <div class="ic-content-layout">
                    <div class="ic-location-list-container">
                        <div class="ic-list-header">
                            <span>Immediate Care Locations</span>
                            <span class="ic-location-count" id="locationCount">12 locations</span>
                        </div>
                        <div class="ic-location-list" id="locationList">
                            <!-- Locations will be populated here -->
                        </div>
                    </div>

                    <div class="ic-map-container">
                        <div id="immediateCaremap" class="ic-map"></div>
                        <div class="ic-map-controls">
                            <button class="ic-map-button" id="resetMapBtn">Reset View</button>
                            <button class="ic-map-button" id="myLocationBtn">📍 My Location</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    // Initialize map
    initMap() {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet library is not loaded');
            return;
        }

        this.map = L.map('immediateCaremap').setView(this.options.defaultCenter, this.options.defaultZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add markers for all locations
        this.locations.forEach(location => {
            this.addMarker(location);
        });
    }

    // Add marker to map
    addMarker(location) {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${location.isOpen ? '#0066cc' : '#6c757d'}; 
                   color: white; width: 30px; height: 30px; border-radius: 50%; 
                   display: flex; align-items: center; justify-content: center; 
                   font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                ${location.id}
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker(location.coordinates, { icon })
            .addTo(this.map)
            .bindPopup(this.createPopupContent(location));

        marker.on('click', () => {
            this.selectLocation(location.id);
        });

        this.markers.push({ id: location.id, marker });
    }

    // Create popup content
    createPopupContent(location) {
        return `
            <div class="ic-location-popup">
                <div class="ic-popup-header">${location.name}</div>
                <div class="ic-popup-content">
                    <div class="ic-popup-row">
                        <span class="ic-popup-label">Address:</span>
                        <span>${location.address}</span>
                    </div>
                    <div class="ic-popup-row">
                        <span class="ic-popup-label">Phone:</span>
                        <span>${location.phone}</span>
                    </div>
                    <div class="ic-popup-row">
                        <span class="ic-popup-label">Status:</span>
                        <span style="color: ${location.isOpen ? '#28a745' : '#dc3545'}">
                            ${location.isOpen ? 'Open' : 'Closed'}
                        </span>
                    </div>
                    ${location.isOpen && location.waitTime ? `
                        <div class="ic-popup-row">
                            <span class="ic-popup-label">Wait time:</span>
                            <span>${location.waitTime} min</span>
                        </div>
                    ` : ''}
                </div>
                <div class="ic-popup-actions">
                    <button class="ic-popup-button primary" 
                            onclick="window.immediateCare.getDirections(${location.coordinates[0]}, ${location.coordinates[1]})">
                        Get Directions
                    </button>
                    <button class="ic-popup-button secondary" 
                            onclick="window.immediateCare.callLocation('${location.phone}')">
                        Call
                    </button>
                </div>
            </div>
        `;
    }

    // Bind events
    bindEvents() {
        // Dropdown toggle
        document.getElementById('dropdownButton').addEventListener('click', () => {
            document.getElementById('dropdownContent').classList.toggle('show');
        });

        // Dropdown options
        document.querySelectorAll('.ic-dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectFilter(e.target.dataset.filter);
            });
        });

        // Search button
        document.getElementById('searchButton').addEventListener('click', () => {
            this.searchByZip();
        });

        // Enter key in search
        document.getElementById('zipSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchByZip();
            }
        });

        // Map controls
        document.getElementById('resetMapBtn').addEventListener('click', () => {
            this.resetMap();
        });

        document.getElementById('myLocationBtn').addEventListener('click', () => {
            this.getCurrentLocation();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ic-location-dropdown')) {
                document.getElementById('dropdownContent').classList.remove('show');
            }
        });
    }

    // Render location list
    renderLocationList(filteredLocations = this.locations) {
        const listContainer = document.getElementById('locationList');
        listContainer.innerHTML = '';

        filteredLocations.forEach(location => {
            const card = document.createElement('div');
            card.className = `ic-location-card ${this.selectedLocationId === location.id ? 'selected' : ''}`;
            card.onclick = () => this.selectLocation(location.id);

            card.innerHTML = `
                <div class="ic-location-marker">${location.id}</div>
                <div class="ic-location-info">
                    <div class="ic-location-name">${location.name}</div>
                    <div class="ic-location-details">
                        ${location.address}<br>
                        ${location.phone}
                    </div>
                    <div class="ic-location-status">
                        <span class="ic-status-indicator ${location.isOpen ? 'open' : 'closed'}"></span>
                        <span>${location.isOpen ? 'Open' : 'Closed for today'}</span>
                    </div>
                    ${location.isOpen && location.waitTime ? `
                        <div class="ic-wait-time">Wait time: ~${location.waitTime} min</div>
                    ` : ''}
                </div>
            `;

            listContainer.appendChild(card);
        });

        // Update count
        document.getElementById('locationCount').textContent = 
            `${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''}`;
    }

    // Select location
    selectLocation(locationId) {
        this.selectedLocationId = locationId;
        this.renderLocationList();

        const location = this.locations.find(loc => loc.id === locationId);
        if (location && this.map) {
            this.map.setView(location.coordinates, 14);
            const marker = this.markers.find(m => m.id === locationId);
            if (marker) {
                marker.marker.openPopup();
            }
        }

        // Emit event for external integration
        this.emit('locationSelected', location);
    }

    // Filter functions
    selectFilter(filter) {
        this.currentFilter = filter;
        const dropdownText = document.getElementById('dropdownText');
        const options = document.querySelectorAll('.ic-dropdown-option');
        
        options.forEach(opt => opt.classList.remove('selected'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('selected');

        switch(filter) {
            case 'all':
                dropdownText.textContent = 'Showing all locations';
                this.renderLocationList();
                break;
            case 'near':
                dropdownText.textContent = 'Locations near me';
                if (this.userLocation) {
                    this.filterByDistance();
                } else {
                    this.getCurrentLocation();
                }
                break;
            case 'open':
                dropdownText.textContent = 'Open now';
                const openLocations = this.locations.filter(loc => loc.isOpen);
                this.renderLocationList(openLocations);
                break;
        }

        document.getElementById('dropdownContent').classList.remove('show');
    }

    // Get current location
    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = [position.coords.latitude, position.coords.longitude];
                    
                    // Add user marker
                    if (this.map) {
                        L.marker(this.userLocation, {
                            icon: L.divIcon({
                                className: 'user-location',
                                html: '<div style="background: #28a745; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                                iconSize: [18, 18],
                                iconAnchor: [9, 9]
                            })
                        }).addTo(this.map).bindPopup('Your Location');

                        this.map.setView(this.userLocation, 12);
                    }
                    
                    if (this.currentFilter === 'near') {
                        this.filterByDistance();
                    }

                    this.emit('locationFound', this.userLocation);
                },
                (error) => {
                    alert('Unable to get your location. Please try entering a ZIP code.');
                    this.emit('locationError', error);
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    }

    // Filter by distance
    filterByDistance() {
        if (!this.userLocation) return;

        const locationsWithDistance = this.locations.map(location => {
            const distance = this.calculateDistance(
                this.userLocation[0], this.userLocation[1],
                location.coordinates[0], location.coordinates[1]
            );
            return { ...location, distance };
        });

        locationsWithDistance.sort((a, b) => a.distance - b.distance);
        this.renderLocationList(locationsWithDistance.slice(0, this.options.maxNearbyResults));
    }

    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI/180);
    }

    // Search by ZIP
    async searchByZip() {
        const zip = document.getElementById('zipSearch').value;
        if (!zip) return;

        // Show loading state
        this.showLoading();

        try {
            // Use geocoding service (you would need to implement this with your preferred service)
            const coordinates = await this.geocodeZip(zip);
            if (coordinates) {
                this.userLocation = coordinates;
                this.filterByDistance();
                if (this.map) {
                    this.map.setView(coordinates, 12);
                }
            }
        } catch (error) {
            alert(`Unable to find locations near ZIP: ${zip}`);
        } finally {
            this.hideLoading();
        }
    }

    // Geocode ZIP (placeholder - implement with actual service)
    async geocodeZip(zip) {
        // This would use a real geocoding API
        // For demo, return approximate coordinates for some LA area ZIPs
        const zipCoordinates = {
            '90024': [34.0665, -118.4455], // Westwood
            '90067': [34.0606, -118.4163], // Century City
            '90404': [34.0295, -118.4889], // Santa Monica
            '90292': [33.9785, -118.4369], // Marina Del Rey
            '91355': [34.4149, -118.5558], // Valencia
        };

        return zipCoordinates[zip] || null;
    }

    // Reset map view
    resetMap() {
        if (this.map) {
            this.map.setView(this.options.defaultCenter, this.options.defaultZoom);
        }
        this.selectedLocationId = null;
        this.renderLocationList();
    }

    // Helper functions
    getDirections(lat, lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }

    callLocation(phone) {
        window.location.href = `tel:${phone.replace(/[^\d]/g, '')}`;
    }

    // Loading states
    showLoading() {
        const listContainer = document.getElementById('locationList');
        listContainer.innerHTML = `
            <div class="ic-loading-spinner">
                <div class="ic-spinner"></div>
            </div>
        `;
    }

    hideLoading() {
        this.renderLocationList();
    }

    // Event emitter
    emit(event, data) {
        if (this.options[`on${event.charAt(0).toUpperCase() + event.slice(1)}`]) {
            this.options[`on${event.charAt(0).toUpperCase() + event.slice(1)}`](data);
        }
    }

    // Public API methods
    refresh() {
        this.renderLocationList();
    }

    setFilter(filter) {
        this.selectFilter(filter);
    }

    getSelectedLocation() {
        return this.locations.find(loc => loc.id === this.selectedLocationId);
    }

    getOpenLocations() {
        return this.locations.filter(loc => loc.isOpen);
    }

    getNearestLocation(coordinates) {
        if (!coordinates) return null;
        
        let nearest = null;
        let minDistance = Infinity;

        this.locations.forEach(location => {
            const distance = this.calculateDistance(
                coordinates[0], coordinates[1],
                location.coordinates[0], location.coordinates[1]
            );
            if (distance < minDistance) {
                minDistance = distance;
                nearest = location;
            }
        });

        return nearest;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImmediateCareLocationFinder;
} else {
    window.ImmediateCareLocationFinder = ImmediateCareLocationFinder;
}