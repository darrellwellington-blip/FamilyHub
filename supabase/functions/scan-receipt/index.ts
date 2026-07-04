import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { image, mimeType } = await req.json()
    if (!image) return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400, headers: CORS })

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: CORS })

    const prompt = `Analyze this grocery store receipt image and extract all purchased items.

Return ONLY a valid JSON array with no markdown, no explanation. Each element:
{
  "name": "product name (concise, e.g. 'Butter', 'Whole Milk', 'Cheddar Cheese')",
  "quantity": <number or null>,
  "unit": "unit string or null (e.g. 'lb', 'oz', 'pkg') or null",
  "purchase_price": <number price paid or null>,
  "category": "one of: Food, Beverages, Cleaning, Personal Care, Electronics, Appliances, Furniture, Tools, Storage"
}

Rules:
- Use grocery-friendly names (drop brand names unless essential)
- Quantity is item count (number of packages), not weight
- Unit is the package unit if visible on receipt (lb, oz, kg, L, ml, pkg, can, bottle, box)
- purchase_price is the actual price paid (after discounts)
- Skip non-product lines: taxes, subtotals, loyalty savings, fees, payment info
- Categorize food items as Food, drinks as Beverages, cleaning products as Cleaning, toiletries as Personal Care`

    const geminiBody = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType ?? 'image/jpeg', data: image } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    })

    let geminiRes: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: geminiBody }
      )
      if (geminiRes.status !== 429) break

      // Read wait time from Retry-After header or error message body
      const retryAfterHeader = geminiRes.headers.get('Retry-After')
      let waitMs = 5000
      if (retryAfterHeader) {
        waitMs = parseInt(retryAfterHeader) * 1000
      } else {
        const errText = await geminiRes.clone().text()
        const match = errText.match(/retry after (\d+)/i) ?? errText.match(/"retryDelay":"(\d+)s"/)
        if (match) waitMs = parseInt(match[1]) * 1000
      }
      // Cap at 35s — edge functions time out at 60s
      waitMs = Math.min(waitMs + 1000, 35000)
      await new Promise(r => setTimeout(r, waitMs))
    }

    if (!geminiRes!.ok) {
      const errBody = await geminiRes!.text()
      // Extract a human-readable message for quota errors
      let message = `Gemini error: ${errBody}`
      if (geminiRes!.status === 429) {
        const match = errBody.match(/"message":"([^"]+)"/)
        message = match ? `Rate limited: ${match[1]}` : 'Gemini rate limit hit — please wait a minute and try again.'
      }
      return new Response(JSON.stringify({ error: message }), { status: 502, headers: CORS })
    }

    const geminiData = await geminiRes!.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Strip any markdown fences Gemini might add despite instructions
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const items = JSON.parse(cleaned)

    return new Response(JSON.stringify({ items }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
