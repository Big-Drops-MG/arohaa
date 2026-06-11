"use client"

import { useEffect,useState } from "react";

export default function Ribbon() {

    const [city, setCity] = useState<string>("Your City")

    useEffect(() => {
        async function fetchCity() {
            try {
                const response = await fetch("/api/location")
                const data = await response.json()
                
                if (data?.city) {
                    setCity(data.city)
                } else {
                    setCity("Your City")
                }
            } catch (error) {
                console.error("Error fetching city:", error)
                setCity("Your City")
            }
        }
        fetchCity()
    }, [])

    return (
        <div className="bg-[#F46036] p-3 flex items-center justify-center rounded-sm">
            <p className="text-white font-sans font-semibold text-base lg:text-lg xl:text-xl">Save Big on Windows in {city}!</p>
        </div>
    );
}