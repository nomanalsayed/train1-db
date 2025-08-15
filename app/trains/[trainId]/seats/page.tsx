"use client"

import { Button } from "@/components/ui/button"
import { Home, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { SeatMapVisual } from "@/components/seat-map-visual"
import { ApiClient } from "@/lib/api-client"

interface PageProps {
  params: Promise<{
    trainId: string
  }>
  searchParams: Promise<{
    from?: string
    to?: string
    trainName?: string
    coach?: string
  }>
}

interface CoachData {
  coach_id: number
  coach_code: string
  type: string
  class_name: string
  total_seats: number
  seat_layout?: any[][]
  direction?: string
  route_code?: string
}

export default function SeatMapPage({ params, searchParams }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ trainId: string } | null>(null)
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{
    from?: string
    to?: string
    trainName?: string
    coach?: string
  } | null>(null)

  const [trainData, setTrainData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const resolveParams = async () => {
      try {
        const [paramsResolved, searchParamsResolved] = await Promise.all([params, searchParams])
        setResolvedParams(paramsResolved)
        setResolvedSearchParams(searchParamsResolved)
      } catch (err) {
        console.error("[v0] Error resolving params:", err)
        setError("Failed to load page parameters")
        setLoading(false)
      }
    }

    resolveParams()
  }, [params, searchParams])

  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return

    const fetchTrainData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("[v0] Fetching train data for:", resolvedParams.trainId)

        const trainDetail = await ApiClient.getTrainDetail(
          resolvedParams.trainId,
          resolvedSearchParams.from,
          resolvedSearchParams.to,
        )

        console.log("[v0] Train detail response:", trainDetail)
        setTrainData(trainDetail)
      } catch (err) {
        console.error("[v0] Error fetching train data:", err)
        setError(err instanceof Error ? err.message : "Failed to load train data")
      } finally {
        setLoading(false)
      }
    }

    fetchTrainData()
  }, [resolvedParams, resolvedSearchParams])

  if (loading || !resolvedParams || !resolvedSearchParams) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading train seat information...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <h2 className="text-xl font-semibold">No Coach Information Available</h2>
            <p className="text-sm mt-2">{error}</p>
          </div>
          <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!trainData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-gray-600 mb-4">
            <h2 className="text-xl font-semibold">No Train Data Available</h2>
            <p className="text-sm mt-2">Could not load train information.</p>
          </div>
          <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const allCoaches: any[] = []

  if (trainData.classes && Array.isArray(trainData.classes)) {
    trainData.classes.forEach((trainClass: any) => {
      if (trainClass.coaches && Array.isArray(trainClass.coaches)) {
        trainClass.coaches.forEach((coach: any) => {
          const seatLayout: any[] = []

          if (coach.frontFacingSeats && Array.isArray(coach.frontFacingSeats)) {
            coach.frontFacingSeats.forEach((seatNum: number) => {
              seatLayout.push({
                number: seatNum,
                type: "front_facing",
                color: "green",
              })
            })
          }

          if (coach.backFacingSeats && Array.isArray(coach.backFacingSeats)) {
            coach.backFacingSeats.forEach((seatNum: number) => {
              seatLayout.push({
                number: seatNum,
                type: "back_facing",
                color: "orange",
              })
            })
          }

          allCoaches.push({
            coach_id: coach.id || coach.coach_id,
            coach_code: coach.coach_code || coach.code,
            coach_name: coach.name || coach.coach_code,
            type: trainClass.shortCode || trainClass.class_short || "S_CHAIR",
            class_name: trainClass.name || trainClass.class_name || "S_CHAIR",
            total_seats: coach.totalSeats || coach.total_seats || 40,
            seat_layout: seatLayout,
            direction: coach.direction || "forward",
            route_code: coach.route_code || trainData.code_from_to,
          })
        })
      }
    })
  }

  console.log("[v0] Extracted coaches:", allCoaches)

  if (allCoaches.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-gray-600 mb-4">
            <h2 className="text-xl font-semibold">No Coach Information Available</h2>
            <p className="text-sm mt-2">No coaches found for this train.</p>
          </div>
          <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const selectedCoach = resolvedSearchParams.coach
    ? allCoaches.find((coach) => coach.coach_code?.toUpperCase() === resolvedSearchParams.coach?.toUpperCase())
    : allCoaches[0]

  const coachToDisplay = selectedCoach || allCoaches[0]

  const handleCoachChange = (coachCode: string) => {
    const params = new URLSearchParams()
    if (resolvedSearchParams.from) params.set("from", resolvedSearchParams.from)
    if (resolvedSearchParams.to) params.set("to", resolvedSearchParams.to)
    if (resolvedSearchParams.trainName) params.set("trainName", resolvedSearchParams.trainName)
    params.set("coach", coachCode)

    router.push(`/trains/${resolvedParams.trainId}/seats?${params.toString()}`)
  }

  return (
    <SeatMapVisual
      coach={coachToDisplay}
      trainName={trainData.train_name || trainData.name || resolvedSearchParams.trainName || "Unknown Train"}
      route={{
        from: resolvedSearchParams.from || trainData.from_station || "Unknown",
        to: resolvedSearchParams.to || trainData.to_station || "Unknown",
      }}
      allCoaches={allCoaches}
      onCoachChange={handleCoachChange}
    />
  )
}
