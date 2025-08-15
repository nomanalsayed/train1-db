import { type NextRequest, NextResponse } from "next/server"
import { API_CONFIG } from "@/lib/config"

const WORDPRESS_API_URL = API_CONFIG.RAIL_BASE_URL

export async function GET(request: NextRequest, { params }: { params: Promise<{ trainId: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const resolvedParams = await params
    const trainNumber = resolvedParams.trainId

    if (!trainNumber || trainNumber === "undefined") {
      return NextResponse.json({ error: "Train number is required" }, { status: 400 })
    }

    const url = new URL(`${WORDPRESS_API_URL}/trains/${trainNumber}`)
    if (from) url.searchParams.set("from", from)
    if (to) url.searchParams.set("to", to)

    console.log(`[Next.js API] Fetching train by number from: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`[Next.js API] WordPress API error: ${response.status} ${response.statusText}`)

      if (response.status === 404) {
        return NextResponse.json(
          {
            error: "Train not found",
            message: `Train number ${trainNumber} does not exist in the database`,
            wordpress_url: url.toString(),
          },
          { status: 404 },
        )
      }

      return NextResponse.json(
        {
          error: "WordPress API error",
          message: `Failed to fetch train data: ${response.status} ${response.statusText}`,
          wordpress_url: url.toString(),
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log(`[Next.js API] Successfully fetched train ${trainNumber}`)

    let classes = []

    if (data.train_classes && Array.isArray(data.train_classes)) {
      classes = data.train_classes.map((trainClass: any) => ({
        id: trainClass.class_id,
        name: trainClass.class_name,
        shortCode: trainClass.class_short,
        coaches: trainClass.coaches
          ? trainClass.coaches.map((coach: any) => ({
              id: coach.coach_id,
              code: coach.coach_code,
              coach_code: coach.coach_code,
              name: coach.coach_name || coach.coach_code,
              totalSeats: coach.total_seats,
              frontFacingSeats: coach.front_facing_seats || [],
              backFacingSeats: coach.back_facing_seats || [],
              directionFlipped: coach.direction_flipped || false,
            }))
          : [],
      }))
    }

    const transformedData = {
      id: data.id || trainNumber,
      name: data.name || data.train_name || `Train ${trainNumber}`,
      train_name: data.train_name || data.name,
      train_number: data.train_number || trainNumber,
      primary_number: data.primary_number,
      reverse_number: data.reverse_number,
      is_reverse_direction: data.is_reverse_direction || false,
      direction_info: data.direction_info,
      code_from_to: data.code_from_to,
      code_to_from: data.code_to_from,
      from_station: data.from_station,
      to_station: data.to_station,
      fromStation: data.from_station
        ? {
            title: data.from_station.title || data.from_station,
            code: data.from_station.code || data.from_station,
          }
        : null,
      toStation: data.to_station
        ? {
            title: data.to_station.title || data.to_station,
            code: data.to_station.code || data.to_station,
          }
        : null,
      classes: classes,
      _meta: {
        source: "wordpress",
        wordpress_url: url.toString(),
        classes_count: classes.length,
        total_coaches: classes.reduce((total, cls) => total + (cls.coaches?.length || 0), 0),
        uses_train_number: true,
      },
    }

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error("[Next.js API] Train detail error:", error)

    return NextResponse.json(
      {
        error: "Connection failed",
        message:
          "Unable to connect to WordPress API. Please check your WordPress installation and plugin configuration.",
        details: error instanceof Error ? error.message : String(error),
        wordpress_url: WORDPRESS_API_URL,
      },
      { status: 500 },
    )
  }
}
