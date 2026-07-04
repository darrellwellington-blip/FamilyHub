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

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType ?? 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return new Response(JSON.stringify({ error: `Gemini error: ${err}` }), { status: 502, headers: CORS })
    }

    const geminiData = await geminiRes.json()
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
