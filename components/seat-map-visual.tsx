"use client"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface SeatMapProps {
  coach: {
    coach_id?: number
    coach_code: string
    coach_name?: string
    type: string
    class_name: string
    total_seats: number
    seat_layout?: any[]
    direction?: string
    route_code?: string
  }
  trainName: string
  route: {
    from: string
    to: string
  }
  allCoaches?: any[]
  onCoachChange?: (coachCode: string) => void
}

export function SeatMapVisual({ coach, trainName, route, allCoaches = [], onCoachChange }: SeatMapProps) {
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  const handleDone = () => {
    router.push("/")
  }

  const isReverseDirection = () => {
    if (coach.direction === "reverse") return true

    // Additional logic to determine reverse direction based on route
    const trainDirection = coach.route_code
    if (trainDirection && trainDirection.includes("103")) {
      // Route code 103 typically indicates reverse direction (Panchagarh to Dhaka)
      return true
    }

    return false
  }

  const renderSeatGrid = (seats: number[], bgColor: string, label: string) => {
    if (!seats || seats.length === 0) return null

    const rows = []
    for (let i = 0; i < seats.length; i += 5) {
      const rowSeats = seats.slice(i, i + 5)
      rows.push(
        <div key={`row-${i}`} className="flex justify-center items-center gap-2 mb-2">
          <div className="flex gap-1">
            {rowSeats.slice(0, 2).map((seatNum, seatIdx) =>
              seatNum ? (
                <div
                  key={`seat-${seatNum}`}
                  className={`w-10 h-10 ${bgColor} rounded-lg text-sm text-white flex items-center justify-center font-medium shadow-sm border-2 border-white`}
                >
                  {seatNum}
                </div>
              ) : (
                <div key={`empty-left-${i}-${seatIdx}`} className="w-10 h-10"></div>
              ),
            )}
          </div>

          <div className="w-8 flex items-center justify-center">
            <div className="w-px h-6 bg-gray-300"></div>
          </div>

          <div className="flex gap-1">
            {rowSeats.slice(2, 5).map((seatNum, seatIdx) =>
              seatNum ? (
                <div
                  key={`seat-${seatNum}`}
                  className={`w-10 h-10 ${bgColor} rounded-lg text-sm text-white flex items-center justify-center font-medium shadow-sm border-2 border-white`}
                >
                  {seatNum}
                </div>
              ) : (
                <div key={`empty-right-${i}-${seatIdx}`} className="w-10 h-10"></div>
              ),
            )}
          </div>
        </div>,
      )
    }

    return (
      <div
        className={`${bgColor === "bg-blue-500" ? "bg-blue-50" : "bg-gray-50"} p-6 rounded-lg relative border ${
          bgColor === "bg-blue-500" ? "border-blue-200" : "border-gray-200"
        }`}
      >
        <div className="absolute top-2 right-2">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              bgColor === "bg-blue-500" ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-800"
            }`}
          >
            {label} Facing
          </span>
        </div>

        <div className="pt-8">{rows}</div>
      </div>
    )
  }

  const renderSeatLayout = () => {
    if (!coach.seat_layout || coach.seat_layout.length === 0) {
      const totalSeats = coach.total_seats || 100
      const frontEnd = 50 // Default: seats 1-50 are forward facing
      const frontSeats = Array.from({ length: frontEnd }, (_, i) => i + 1)
      const backSeats = Array.from({ length: totalSeats - frontEnd }, (_, i) => frontEnd + i + 1)

      return renderDefaultLayout(frontSeats, backSeats)
    }

    const frontSeats: number[] = []
    const backSeats: number[] = []
    const allSeats: { number: number; type: string }[] = []

    if (Array.isArray(coach.seat_layout)) {
      coach.seat_layout.forEach((item) => {
        if (Array.isArray(item)) {
          item.forEach((seat) => {
            if (typeof seat === "object" && seat !== null) {
              allSeats.push({
                number: seat.number || seat.seat_number,
                type: seat.color === "blue" || seat.type === "front_facing" ? "front_facing" : "back_facing",
              })
            }
          })
        } else if (typeof item === "object" && item !== null) {
          allSeats.push({
            number: item.number || item.seat_number,
            type: item.color === "blue" || item.type === "front_facing" ? "front_facing" : "back_facing",
          })
        }
      })
    }

    allSeats.sort((a, b) => a.number - b.number)

    const reverseDirection = isReverseDirection()

    allSeats.forEach((seat) => {
      let seatType = seat.type

      // If reverse direction, swap the seat types
      if (reverseDirection) {
        seatType = seat.type === "front_facing" ? "back_facing" : "front_facing"
      }

      if (seatType === "front_facing") {
        frontSeats.push(seat.number)
      } else {
        backSeats.push(seat.number)
      }
    })

    if (frontSeats.length === 0 && backSeats.length === 0) {
      const totalSeats = coach.total_seats || 100
      const frontEnd = 50
      let defaultFrontSeats = Array.from({ length: frontEnd }, (_, i) => i + 1)
      let defaultBackSeats = Array.from({ length: totalSeats - frontEnd }, (_, i) => frontEnd + i + 1)

      if (reverseDirection) {
        ;[defaultFrontSeats, defaultBackSeats] = [defaultBackSeats, defaultFrontSeats]
      }

      return renderDefaultLayout(defaultFrontSeats, defaultBackSeats)
    }

    const sections = []

    if (backSeats.length > 0) {
      sections.push({
        seats: backSeats,
        color: "bg-gray-500", // Use gray for backward facing
        label: "Backward",
        minSeat: Math.min(...backSeats),
      })
    }

    if (frontSeats.length > 0) {
      sections.push({
        seats: frontSeats,
        color: "bg-blue-500", // Use blue for forward facing
        label: "Forward",
        minSeat: Math.min(...frontSeats),
      })
    }

    sections.sort((a, b) => a.minSeat - b.minSeat)

    return (
      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={`section-${section.label}-${index}`}>
            {renderSeatGrid(section.seats, section.color, section.label)}
          </div>
        ))}
      </div>
    )
  }

  const renderDefaultLayout = (frontSeats: number[], backSeats: number[]) => {
    return (
      <div className="space-y-6">
        {backSeats.length > 0 && renderSeatGrid(backSeats, "bg-gray-500", "Backward")}
        {frontSeats.length > 0 && renderSeatGrid(frontSeats, "bg-blue-500", "Forward")}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-semibold text-lg text-gray-800">{trainName}</h1>
            <p className="text-sm text-gray-500">{coach.coach_code}</p>
          </div>
          <button
            onClick={handleDone}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">{trainName}</h2>
              <p className="text-blue-600 font-medium">{coach.coach_code}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Seats</p>
              <p className="text-2xl font-semibold text-gray-800">{coach.total_seats}</p>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4 bg-blue-50 rounded-lg p-4">
            <div className="text-center">
              <p className="font-medium text-blue-700">{route.from}</p>
              <p className="text-xs text-gray-500">From</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="text-center">
              <p className="font-medium text-blue-700">{route.to}</p>
              <p className="text-xs text-gray-500">To</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">
              <span className="font-medium">Class:</span> {coach.class_name}
            </span>
          </div>
        </div>

        {allCoaches && allCoaches.length > 1 && (
          <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Coach</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {allCoaches.map((coachOption) => (
                <button
                  key={coachOption.coach_code}
                  onClick={() => onCoachChange && onCoachChange(coachOption.coach_code)}
                  className={`p-3 rounded-lg border transition-colors ${
                    coach.coach_code === coachOption.coach_code
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <div className="font-medium">{coachOption.coach_code}</div>
                  <div className="text-xs text-gray-500 mt-1">{coachOption.total_seats} seats</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Seat Layout</h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-500 rounded"></div>
                <span className="text-gray-600">Backward</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Forward</span>
              </div>
            </div>
          </div>

          {renderSeatLayout()}
        </div>
      </div>
    </div>
  )
}

// Also provide as default export for compatibility
export default SeatMapVisual
