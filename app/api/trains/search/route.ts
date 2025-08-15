import { type NextRequest, NextResponse } from "next/server"

const WORDPRESS_API_URL = "https://noman.ebazarhut.com/wp-json/rail/v1"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const query = searchParams.get("query")
    const routeCode = searchParams.get("routeCode")
    const coach = searchParams.get("coach")

    let wpUrl: string
    let searchType: string

    if (routeCode) {
      wpUrl = `${WORDPRESS_API_URL}/trains/route/${routeCode}`
      searchType = "route_code"
      console.log(`[SERVER] [Next.js API] Fetching train by route code from: ${wpUrl}`)
    } else if (from && to) {
      wpUrl = `${WORDPRESS_API_URL}/trains/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      if (coach) {
        wpUrl += `&coach=${encodeURIComponent(coach)}`
      }
      searchType = "route"
      console.log(`[SERVER] [Next.js API] Fetching train by route from: ${wpUrl}`)
    } else if (query) {
      const isNumericQuery = /^\d+$/.test(query.trim())
      if (isNumericQuery) {
        wpUrl = `${WORDPRESS_API_URL}/trains/route/${query}`
        searchType = "route_code_primary"
        console.log(`[SERVER] [Next.js API] Trying route code endpoint first for numeric query: ${wpUrl}`)
      } else {
        wpUrl = `${WORDPRESS_API_URL}/trains/search?query=${encodeURIComponent(query)}`
        searchType = "name_search"
        console.log(`[SERVER] [Next.js API] Fetching train by name from: ${wpUrl}`)
      }
      if (coach) {
        wpUrl += `&coach=${encodeURIComponent(coach)}`
      }
    } else {
      wpUrl = `${WORDPRESS_API_URL}/trains`
      searchType = "list_all"
      console.log(`[SERVER] [Next.js API] Fetching all trains from: ${wpUrl}`)
    }

    const response = await fetch(wpUrl, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })

    console.log(`[SERVER] [Next.js API] WordPress API response status: ${response.status}`)

    let shouldTryFallback = false
    let data = null

    if (!response.ok) {
      shouldTryFallback = true
    } else {
      data = await response.json()
      // Check if WordPress returned an error structure
      if (data.code && (data.code === "train_not_found" || data.code.includes("error"))) {
        console.log(`[SERVER] [Next.js API] WordPress returned error: ${data.code} - ${data.message}`)
        shouldTryFallback = true
      }
    }

    // Try fallback for route code searches that failed
    if (shouldTryFallback && searchType === "route_code_primary" && query) {
      console.log(`[SERVER] [Next.js API] Route code search failed, trying general search fallback`)
      const fallbackUrl = `${WORDPRESS_API_URL}/trains/search?query=${encodeURIComponent(query)}`
      console.log(`[SERVER] [Next.js API] Fallback search URL: ${fallbackUrl}`)

      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      })

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json()
        console.log(`[SERVER] [Next.js API] Fallback search successful`)
        console.log(`[SERVER] [Next.js API] Fallback data structure:`, Object.keys(fallbackData))
        return processSearchResponse(fallbackData, fallbackUrl, query)
      }
    }

    // Handle original error cases
    if (!response.ok || (data && data.code && data.code === "train_not_found")) {
      const errorText = !response.ok ? await response.text() : JSON.stringify(data)
      console.log(`[SERVER] [Next.js API] WordPress API error response: ${errorText.substring(0, 200)}`)

      return NextResponse.json({
        trains: [],
        total: 0,
        error: data?.message || `WordPress API error: ${response.status}`,
        message: data?.message || "No trains found. Please try different search criteria.",
      })
    }

    return processSearchResponse(data, wpUrl, query)
  } catch (error) {
    console.error("[SERVER] [Next.js API] Train search error:", error)

    return NextResponse.json({
      trains: [],
      total: 0,
      error: "WordPress API unavailable",
      message: "API error occurred",
    })
  }
}

function processSearchResponse(data: any, wpUrl: string, originalQuery?: string) {
  console.log(`[SERVER] [Next.js API] Successfully fetched train search`)
  console.log(`[SERVER] [Next.js API] WordPress response structure:`, Object.keys(data))
  console.log(`[SERVER] [Next.js API] Raw WordPress response:`, JSON.stringify(data).substring(0, 500))

  console.log(`[SERVER] [Next.js API] Full WordPress response:`, JSON.stringify(data, null, 2))

  let trains = []
  if (data.trains && Array.isArray(data.trains)) {
    trains = data.trains
    console.log(`[SERVER] [Next.js API] Found ${trains.length} trains in data.trains`)
  } else if (data.items && Array.isArray(data.items)) {
    trains = data.items
    console.log(`[SERVER] [Next.js API] Found ${trains.length} trains in data.items`)
  } else if (Array.isArray(data)) {
    trains = data
    console.log(`[SERVER] [Next.js API] Found ${trains.length} trains in root array`)
  } else if (data.id && data.name && !data.trains) {
    // Single train object from route endpoint
    trains = [data]
    console.log(`[SERVER] [Next.js API] Found single train object`)
  } else {
    console.log(`[SERVER] [Next.js API] No trains found in response, data keys:`, Object.keys(data))
    console.log(`[SERVER] [Next.js API] Data type:`, typeof data)
    console.log(`[SERVER] [Next.js API] Is array:`, Array.isArray(data))

    // Return empty result if no valid train data found
    return NextResponse.json({
      trains: [],
      total: 0,
      message: "No trains found in WordPress response",
      debug: {
        wordpress_response: data,
        response_keys: Object.keys(data),
        response_type: typeof data,
      },
    })
  }

  if (trains.length === 0) {
    return NextResponse.json({
      trains: [],
      total: 0,
      message: "No trains found. Please try different search criteria.",
    })
  }

  const processedTrains = trains
    .map((train: any, index: number) => {
      if (!train || typeof train !== "object") {
        console.log(`[SERVER] [Next.js API] Invalid train object at index ${index}:`, train)
        return null
      }

      let displayCode = train.display_code || train.number || train.code_from_to || train.train_number
      let trainNumber = displayCode

      if (originalQuery && /^\d+$/.test(originalQuery.trim())) {
        const queryCode = originalQuery.trim()
        if (train.code_from_to === queryCode) {
          displayCode = train.code_from_to
          trainNumber = train.code_from_to
        } else if (train.code_to_from === queryCode) {
          displayCode = train.code_to_from
          trainNumber = train.code_to_from
        }
      }

      const processedTrain = {
        id: train.id || `train_${index}`,
        name: train.name || train.train_name || `Train ${train.id || index}`,
        train_name: train.name || train.train_name || `Train ${train.id || index}`,
        train_number: trainNumber || train.id?.toString() || `${index + 1}`,
        number: trainNumber || train.id?.toString() || `${index + 1}`,
        display_code: displayCode || trainNumber || `${index + 1}`,
        from_station: train.from_station || "",
        to_station: train.to_station || "",
        code_from_to: train.code_from_to || "",
        code_to_from: train.code_to_from || "",
        search_direction: train.search_direction || "forward",
        is_reverse_direction: train.search_direction === "reverse",
        classes: train.classes || train.train_classes || [],
        total_coaches: train.total_coaches || 0,
        _meta: {
          source: "wordpress",
          wordpress_url: wpUrl,
          classes_count: (train.classes || train.train_classes || []).length,
          total_coaches: train.total_coaches || 0,
          uses_train_number: true,
          original_query: originalQuery,
          raw_train_data: train,
        },
      }

      console.log(
        `[SERVER] [Next.js API] Processed train: ${processedTrain.name} (${processedTrain.number}) - Direction: ${processedTrain.search_direction} - Codes: ${train.code_from_to}/${train.code_to_from}`,
      )
      return processedTrain
    })
    .filter(Boolean) // Remove null entries

  return NextResponse.json({
    trains: processedTrains,
    total: processedTrains.length,
    message: "Data from WordPress",
  })
}
