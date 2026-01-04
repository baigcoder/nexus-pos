'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Declare google maps types
declare global {
    interface Window {
        google: typeof google
    }
}

interface LiveTrackingMapProps {
    restaurantLocation: { lat: number; lng: number }
    customerLocation: { lat: number; lng: number }
    riderLocation?: { lat: number; lng: number }
    riderName?: string
    showRoute?: boolean
    onRiderMove?: (location: { lat: number; lng: number }) => void
    className?: string
}

export default function LiveTrackingMap({
    restaurantLocation,
    customerLocation,
    riderLocation,
    riderName = 'Rider',
    showRoute = true,
    onRiderMove,
    className = '',
}: LiveTrackingMapProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<google.maps.Map | null>(null)
    const riderMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
    const routeRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize map
    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

        if (!apiKey) {
            setError('Google Maps API key not configured')
            return
        }

        // Load Google Maps script
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly&callback=initMap`
        script.async = true
        script.defer = true

            ; (window as any).initMap = () => {
                const google = window.google
                if (!mapRef.current) return

                // Calculate center between restaurant and customer
                const centerLat = (restaurantLocation.lat + customerLocation.lat) / 2
                const centerLng = (restaurantLocation.lng + customerLocation.lng) / 2

                // Create map
                const map = new google.maps.Map(mapRef.current, {
                    center: { lat: centerLat, lng: centerLng },
                    zoom: 14,
                    styles: darkMapStyle,
                    disableDefaultUI: true,
                    zoomControl: true,
                    mapId: 'nexus-pos-tracking',
                })

                mapInstanceRef.current = map

                // Restaurant marker
                const restaurantMarkerEl = document.createElement('div')
                restaurantMarkerEl.innerHTML = `
                <div style="
                    width: 48px; 
                    height: 48px; 
                    background: linear-gradient(135deg, #7c3aed, #a855f7);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.5);
                    border: 3px solid white;
                ">
                    <span style="font-size: 24px;">🍽️</span>
                </div>
            `

                new google.maps.marker.AdvancedMarkerElement({
                    map,
                    position: restaurantLocation,
                    content: restaurantMarkerEl,
                    title: 'Restaurant',
                })

                // Customer marker
                const customerMarkerEl = document.createElement('div')
                customerMarkerEl.innerHTML = `
                <div style="
                    width: 48px; 
                    height: 48px; 
                    background: linear-gradient(135deg, #10b981, #34d399);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5);
                    border: 3px solid white;
                ">
                    <span style="font-size: 24px;">📍</span>
                </div>
            `

                new google.maps.marker.AdvancedMarkerElement({
                    map,
                    position: customerLocation,
                    content: customerMarkerEl,
                    title: 'Delivery Location',
                })

                // Rider marker (if location provided)
                if (riderLocation) {
                    const riderMarkerEl = createRiderMarkerElement(riderName)
                    riderMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
                        map,
                        position: riderLocation,
                        content: riderMarkerEl,
                        title: riderName,
                    })
                }

                // Draw route
                if (showRoute) {
                    const directionsService = new google.maps.DirectionsService()
                    const directionsRenderer = new google.maps.DirectionsRenderer({
                        map,
                        suppressMarkers: true,
                        polylineOptions: {
                            strokeColor: '#a855f7',
                            strokeWeight: 4,
                            strokeOpacity: 0.8,
                        },
                    })
                    routeRendererRef.current = directionsRenderer

                    directionsService.route({
                        origin: restaurantLocation,
                        destination: customerLocation,
                        travelMode: google.maps.TravelMode.DRIVING,
                    }, (result, status) => {
                        if (status === 'OK' && result) {
                            directionsRenderer.setDirections(result)
                        }
                    })
                }

                // Fit bounds to show all markers
                const bounds = new google.maps.LatLngBounds()
                bounds.extend(restaurantLocation)
                bounds.extend(customerLocation)
                if (riderLocation) bounds.extend(riderLocation)
                map.fitBounds(bounds, 60)

                setIsLoaded(true)
            }

        document.head.appendChild(script)

        return () => {
            delete (window as any).initMap
        }
    }, [restaurantLocation, customerLocation, showRoute])

    // Update rider position
    useEffect(() => {
        if (!riderLocation || !mapInstanceRef.current) return

        if (riderMarkerRef.current) {
            riderMarkerRef.current.position = riderLocation
        } else if (mapInstanceRef.current) {
            const riderMarkerEl = createRiderMarkerElement(riderName)
            riderMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
                map: mapInstanceRef.current,
                position: riderLocation,
                content: riderMarkerEl,
                title: riderName,
            })
        }

        onRiderMove?.(riderLocation)
    }, [riderLocation, riderName, onRiderMove])

    if (error) {
        return (
            <div className={`bg-neutral-900 rounded-2xl flex items-center justify-center ${className}`}>
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🗺️</span>
                    </div>
                    <p className="text-neutral-400 text-sm">{error}</p>
                    <p className="text-neutral-500 text-xs mt-2">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`}>
            <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />
            {!isLoaded && (
                <div className="absolute inset-0 bg-neutral-900 rounded-2xl flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}

function createRiderMarkerElement(name: string): HTMLElement {
    const el = document.createElement('div')
    el.innerHTML = `
        <div style="position: relative;">
            <div style="
                width: 56px; 
                height: 56px; 
                background: linear-gradient(135deg, #f59e0b, #fbbf24);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 20px rgba(245, 158, 11, 0.5);
                border: 3px solid white;
                animation: pulse 2s infinite;
            ">
                <span style="font-size: 28px;">🏍️</span>
            </div>
            <div style="
                position: absolute;
                bottom: -24px;
                left: 50%;
                transform: translateX(-50%);
                background: #0a0a0a;
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                border: 1px solid #333;
            ">${name}</div>
        </div>
    `
    return el
}

// Dark mode map style
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]
