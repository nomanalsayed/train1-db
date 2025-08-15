import { type NextRequest, NextResponse } from "next/server"
import { API_CONFIG } from "@/lib/config"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainId: string; routeCode: string }> },
) {
  try {
    const resolvedParams = await params
    const { trainId, routeCode } = resolvedParams
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") || ""
    const to = searchParams.get("to") || ""

    console.log(`[Next.js API] Fetching train ${trainId} with route ${routeCode}`)

    let data = null
    let wpUrl = ""

    // First try: Get train by ID with route parameters
    try {
      wpUrl = `${API_CONFIG.RAIL_BASE_URL}/trains/${trainId}/seats`
      const url = new URL(wpUrl)
      if (from) url.searchParams.set("from", from)
      if (to) url.searchParams.set("to", to)

      console.log(`[Next.js API] Trying train seats endpoint: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Bangladesh-Railway-App/1.0",
        },
      })

      if (response.ok) {
        data = await response.json()
        console.log(`[Next.js API] Successfully fetched train data via seats endpoint`)
      }
    } catch (error) {
      console.log(`[Next.js API] Seats endpoint failed, trying alternatives`)
    }

    // Second try: Search for the train by route code to get the correct train ID
    if (!data) {
      try {
        wpUrl = `${API_CONFIG.RAIL_BASE_URL}/trains/search`
        const url = new URL(wpUrl)
        url.searchParams.set("query", routeCode)

        console.log(`[Next.js API] Trying search endpoint: ${url.toString()}`)

        const response = await fetch(url.toString(), {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Bangladesh-Railway-App/1.0",
          },
        })

        if (response.ok) {
          const searchData = await response.json()
          console.log(`[Next.js API] Search response:`, searchData)

          if (searchData.trains && searchData.trains.length > 0) {
            // Find the train with matching route code
            const matchingTrain = searchData.trains.find(
              (train: any) =>
                train.display_code === routeCode ||
                train.number === routeCode ||
                train.code_from_to === routeCode ||
                train.code_to_from === routeCode,
            )

            if (matchingTrain) {
              // Now get the full train data using the correct train ID
              const actualTrainId = matchingTrain.id
              wpUrl = `${API_CONFIG.RAIL_BASE_URL}/trains/${actualTrainId}/seats`
              const seatsUrl = new URL(wpUrl)
              if (from) seatsUrl.searchParams.set("from", from)
              if (to) seatsUrl.searchParams.set("to", to)

              console.log(`[Next.js API] Fetching seats for actual train ID ${actualTrainId}: ${seatsUrl.toString()}`)

              const seatsResponse = await fetch(seatsUrl.toString(), {
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  "User-Agent": "Bangladesh-Railway-App/1.0",
                },
              })

              if (seatsResponse.ok) {
                data = await seatsResponse.json()
                console.log(`[Next.js API] Successfully fetched train data via search + seats`)
              }
            }
          }
        }
      } catch (error) {
        console.log(`[Next.js API] Search endpoint failed`)
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          id: routeCode,
          name: `Train ${routeCode}`,
          train_number: routeCode,
          is_reverse_direction: false,
          fromStation: from || null,
          toStation: to || null,
          classes: [],
          _meta: {
            source: "wordpress",
            wordpress_url: wpUrl,
            classes_count: 0,
            total_coaches: 0,
            uses_train_number: true,
            error: "No train data found",
          },
        },
        { status: 404 },
      )
    }

    const isReverseDirection = determineReverseDirection(data, from, to, routeCode)

    const processedData = {
      id: routeCode, // Use route code as display ID
      name: data.train_name || `Train ${routeCode}`,
      train_number: routeCode,
      is_reverse_direction: isReverseDirection,
      fromStation: from || null,
      toStation: to || null,
      classes: processCoaches(data.coaches || []),
      _meta: {
        source: "wordpress",
        wordpress_url: wpUrl,
        classes_count: (data.coaches || []).length,
        total_coaches: (data.coaches || []).length,
        uses_train_number: true,
        actual_train_id: data.train_id,
        route_code: routeCode,
        direction: isReverseDirection ? "reverse" : "forward",
      },
    }

    console.log(`[Next.js API] Returning processed train data for route ${routeCode}`)
    return NextResponse.json(processedData)
  } catch (error) {
    console.error("[Next.js API] Error in train route endpoint:", error)
    const resolvedParams = await params
    return NextResponse.json(
      {
        error: "Failed to fetch train data",
        message: error instanceof Error ? error.message : "Unknown error",
        trainId: resolvedParams.trainId,
        routeCode: resolvedParams.routeCode,
      },
      { status: 500 },
    )
  }
}

function determineReverseDirection(data: any, from: string, to: string, routeCode: string): boolean {
  // Check if route code indicates reverse (like 103 vs 101)
  if (routeCode === "103" || routeCode.includes("reverse") || routeCode.includes("return")) {
    return true
  }

  // Check based on from/to stations vs train's origin/destination
  if (from && to && data.route) {
    const trainFrom = data.route.from?.toLowerCase()
    const trainTo = data.route.to?.toLowerCase()
    const searchFrom = from.toLowerCase()
    const searchTo = to.toLowerCase()

    // If search direction is opposite to train's natural direction
    if (trainFrom && trainTo && searchFrom === trainTo && searchTo === trainFrom) {
      return true
    }
  }

  // Check if data already indicates reverse direction
  if (data.direction === "reverse" || data.is_reverse_direction) {
    return true
  }

  return false
}

function processCoaches(coaches: any[]): any[] {
  if (!Array.isArray(coaches)) return []

  return coaches.map((coach: any) => ({
    id: coach.coach_id || coach.id,
    code: coach.coach_code || coach.code,
    name: coach.coach_code || coach.code,
    type: coach.type || coach.class_name || "S_CHAIR",
    totalSeats: coach.total_seats || 0,
    position: coach.position || 0,
    seatLayout: coach.seat_layout || [],
    frontFacingSeats: coach.front_facing_seats || [],
    backFacingSeats: coach.back_facing_seats || [],
  }))
}
