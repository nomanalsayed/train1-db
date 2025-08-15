"use client"

import { useState, useEffect } from "react"
import { ArrowLeft } from "lucide-react"

interface Props {
  fromStation: string
  toStation: string
  trainId?: string
  onSelect: (coach: string) => void
  onBack: () => void
}

interface CoachData {
  code: string
  name: string
  totalSeats: number
  type: string
}

export function CoachSelection({ fromStation, toStation, trainId, onSelect, onBack }: Props) {
  const [coaches, setCoaches] = useState<CoachData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        console.log("[v0] Fetching coaches from API...")

        if (trainId) {
          const response = await fetch(`/api/trains/${trainId}/coaches`)
          console.log("[v0] Train coaches API response status:", response.status)

          if (response.ok) {
            const data = await response.json()
            console.log("[v0] Train coaches API data:", data)

            if (data.coaches && data.coaches.length > 0) {
              const coachList = data.coaches.map((coach: any) => ({
                code: coach.code,
                name: coach.code, // Use actual coach code, not hardcoded names
                totalSeats: coach.totalSeats || 0,
                type: coach.type || "S_CHAIR",
              }))
              setCoaches(coachList)
              console.log(
                "[v0] Successfully loaded train-specific coaches:",
                coachList.map((c) => c.code),
              )
              setLoading(false)
              return
            }
          }
        }

        const response = await fetch("/api/coaches")
        console.log("[v0] Generic coaches API response status:", response.status)

        const data = await response.json()
        console.log("[v0] Generic coaches API data:", data)

        if (response.ok && data.coaches && data.coaches.length > 0) {
          const coachList = data.coaches.map((coach: any) => ({
            code: coach.code || coach.name || "Unknown",
            name: coach.code || coach.name || "Unknown", // Use actual coach code
            totalSeats: coach.total_seats || 0,
            type: coach.code || "Unknown",
          }))
          setCoaches(coachList)
          console.log(
            "[v0] Successfully loaded generic coaches:",
            coachList.map((c) => c.code),
          )
        } else {
          console.error("[v0] Coaches API failed or returned no data:", data)
          const fallbackCoaches = [
            { code: "UMA", name: "UMA", totalSeats: 40, type: "S_CHAIR" },
            { code: "CHA", name: "CHA", totalSeats: 60, type: "S_CHAIR" },
          ]
          setCoaches(fallbackCoaches)
        }
      } catch (error) {
        console.error("[v0] Failed to fetch coaches:", error)
        const fallbackCoaches = [
          { code: "UMA", name: "UMA", totalSeats: 40, type: "S_CHAIR" },
          { code: "CHA", name: "CHA", totalSeats: 60, type: "S_CHAIR" },
        ]
        setCoaches(fallbackCoaches)
      } finally {
        setLoading(false)
      }
    }

    fetchCoaches()
  }, [trainId, fromStation, toStation])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4 flex items-center space-x-3">
          <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Select Coach</h1>
        </div>
      </div>

      <div className="px-6 py-6 bg-white border-b border-gray-100">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">FROM</p>
          <p className="font-semibold text-gray-900">{fromStation}</p>
          <div className="flex justify-center my-3">
            <div className="w-8 h-0.5 bg-blue-500"></div>
          </div>
          <p className="text-sm text-gray-500 mb-1">TO</p>
          <p className="font-semibold text-gray-900">{toStation}</p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && (
        <div className="px-6 py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Coaches</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {coaches.map((coach) => (
              <button
                key={coach.code}
                onClick={() => onSelect(coach.code)}
                className="bg-white border border-gray-200 rounded-lg p-4 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="text-lg font-semibold text-gray-900">{coach.code}</div>
                {coach.totalSeats > 0 && <div className="text-sm text-gray-500 mt-1">{coach.totalSeats} seats</div>}
              </button>
            ))}
          </div>

          {coaches.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No coaches available</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
