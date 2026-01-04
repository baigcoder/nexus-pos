'use client'

import { useEffect, useRef, useState } from 'react'

// Declare google maps types
declare global {
    interface Window {
        google: typeof google
        initFleetMap?: () => void
    }
}

interface Rider {
    id: string
    name: string
    position: { lat: number; lng: number }
    status: 'available' | 'busy' | 'offline'
    currentOrder?: string
}

interface FleetMapProps {
    restaurantLocation: { lat: number; lng: number }
    riders: Rider[]
    onRiderClick?: (rider: Rider) => void
    className?: string
}

export default function FleetMap({
    restaurantLocation,
    riders,
    onRiderClick,
    className = '',
}: FleetMapProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<google.maps.Map | null>(null)
    const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map())
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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initFleetMap`
        script.async = true
        script.defer = true

        window.initFleetMap = () => {
            const google = window.google
            if (!mapRef.current) return

            const map = new google.maps.Map(mapRef.current, {
                center: restaurantLocation,
                zoom: 13,
                styles: darkMapStyle,
                disableDefaultUI: true,
                zoomControl: true,
            })

            mapInstanceRef.current = map

            // Restaurant marker
            new google.maps.Marker({
                map,
                position: restaurantLocation,
                title: 'Restaurant',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#7c3aed',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: 12,
                },
            })

            setIsLoaded(true)
        }

        document.head.appendChild(script)

        return () => {
            delete window.initFleetMap
        }
    }, [restaurantLocation])

    // Update rider markers
    useEffect(() => {
        if (!mapInstanceRef.current || !isLoaded) return

        const google = window.google
        const map = mapInstanceRef.current

        // Update or create markers for each rider
        riders.forEach((rider) => {
            const existingMarker = markerRefs.current.get(rider.id)
            const statusColors = {
                available: '#10b981',
                busy: '#f59e0b',
                offline: '#6b7280',
            }

            if (existingMarker) {
                existingMarker.setPosition(rider.position)
            } else {
                const marker = new google.maps.Marker({
                    map,
                    position: rider.position,
                    title: rider.name,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: statusColors[rider.status],
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 10,
                    },
                })

                marker.addListener('click', () => {
                    onRiderClick?.(rider)
                })

                markerRefs.current.set(rider.id, marker)
            }
        })

        // Remove markers for riders that no longer exist
        markerRefs.current.forEach((marker, riderId) => {
            if (!riders.find(r => r.id === riderId)) {
                marker.setMap(null)
                markerRefs.current.delete(riderId)
            }
        })
    }, [riders, isLoaded, onRiderClick])

    if (error) {
        return (
            <div className={`bg-neutral-900 rounded-2xl flex items-center justify-center ${className}`}>
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🗺️</span>
                    </div>
                    <p className="text-neutral-400 text-sm">{error}</p>
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

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-white">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-white">On Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-neutral-500"></div>
                    <span className="text-white">Offline</span>
                </div>
            </div>
        </div>
    )
}

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
