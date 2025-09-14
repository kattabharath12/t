
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  console.log('🔍 [STATE DETECTION API] Processing state detection request...')
  
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    console.log('🔍 [STATE DETECTION API] Sending request to LLM API...')
    
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API failed with status: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content returned from LLM API')
    }

    try {
      const result = JSON.parse(content)
      console.log('✅ [STATE DETECTION API] Successfully parsed LLM response:', result)
      return NextResponse.json(result)
    } catch (parseError) {
      console.error('❌ [STATE DETECTION API] Failed to parse LLM response as JSON:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse LLM response',
        rawContent: content 
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ [STATE DETECTION API] Error:', error)
    return NextResponse.json({
      error: 'State detection failed',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
