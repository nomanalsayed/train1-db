const WORDPRESS_API_URL = "https://noman.ebazarhut.com/wp-json/rail/v1"

export async function GET(request: Request, { params }: { params: { trainId: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const trainId = params.trainId

    console.log(`[Next.js API] Fetching train data for ID/Route: ${trainId}`)

    // Try multiple endpoints to find the train data
    let wpData = null
    let wpUrl = ""
    let isReverseDirection = false

    // First, try as a direct train ID
    wpUrl = `${WORDPRESS_API_URL}/trains/${trainId}`
    const queryParams = new URLSearchParams()
    if (from) queryParams.append("from", from)
    if (to) queryParams.append("to", to)
    if (queryParams.toString()) {
      wpUrl += `?${queryParams.toString()}`
    }

    console.log(`[Next.js API] Trying train ID endpoint: ${wpUrl}`)
    let response = await fetch(wpUrl)

    if (response.ok) {
      const data = await response.json()
      if (!data.code || data.code !== "train_not_found") {
        wpData = data
        console.log(`[Next.js API] Successfully fetched train by ID: ${trainId}`)
      }
    }

    // If train ID failed, try as route code
    if (!wpData) {
      wpUrl = `${WORDPRESS_API_URL}/trains/route/${trainId}`
      if (queryParams.toString()) {
        wpUrl += `?${queryParams.toString()}`
      }

      console.log(`[Next.js API] Trying route code endpoint: ${wpUrl}`)
      response = await fetch(wpUrl)

      if (response.ok) {
        const data = await response.json()
        if (!data.code || data.code !== "train_not_found") {
          wpData = data
          console.log(`[Next.js API] Successfully fetched train by route code: ${trainId}`)
        }
      }
    }

    // If both failed, try search to find the train
    if (!wpData) {
      const searchUrl = `${WORDPRESS_API_URL}/trains/search?query=${encodeURIComponent(trainId)}`
      console.log(`[Next.js API] Trying search endpoint: ${searchUrl}`)

      response = await fetch(searchUrl)
      if (response.ok) {
        const searchData = await response.json()
        if (searchData.trains && searchData.trains.length > 0) {
          // Find the train that matches our criteria
          const matchingTrain = searchData.trains.find(
            (train: any) =>
              train.display_code === trainId ||
              train.code_from_to === trainId ||
              train.code_to_from === trainId ||
              train.id?.toString() === trainId,
          )

          if (matchingTrain) {
            wpData = matchingTrain
            console.log(`[Next.js API] Found train via search: ${trainId}`)

            // Determine direction based on route codes and from/to
            if (from && to) {
              isReverseDirection =
                matchingTrain.search_direction === "reverse" ||
                (matchingTrain.code_to_from === trainId && from === "Panchagarh" && to === "Dhaka")
            }
          }
        }
      }
    }

    if (!wpData) {
      console.log(`[Next.js API] No train data found for: ${trainId}`)
      return new Response(
        JSON.stringify({
          error: "Train not found",
          message: `No train found with ID or route code: ${trainId}`,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Determine reverse direction if not already set
    if (!isReverseDirection && from && to) {
      isReverseDirection = from === "Panchagarh" && to === "Dhaka"
    }

    const transformedData = {
      id: wpData.id || trainId,
      name: wpData.name || wpData.train_name || `Train ${trainId}`,
      train_number: wpData.display_code || wpData.number || trainId,
      is_reverse_direction: isReverseDirection,
      fromStation: from,
      toStation: to,
      classes: wpData.classes || wpData.train_classes || [],
      _meta: {
        source: "wordpress",
        wordpress_url: wpUrl,
        classes_count: (wpData.classes || wpData.train_classes || []).length,
        total_coaches: wpData.total_coaches || 0,
        uses_train_number: true,
      },
    }

    console.log(`[Next.js API] Returning train data for ${trainId}:`, {
      name: transformedData.name,
      train_number: transformedData.train_number,
      is_reverse_direction: transformedData.is_reverse_direction,
      classes_count: transformedData._meta.classes_count,
    })

    return new Response(JSON.stringify(transformedData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error(`[Next.js API] Error fetching train ${params.trainId}:`, error)
    return new Response(JSON.stringify({ error: "Failed to fetch train route" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
