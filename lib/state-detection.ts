
// State detection using LLM API for document analysis
export interface StateDetectionResult {
  detectedState?: string
  confidence: number
  source: 'address' | 'employer' | 'document_type' | 'unknown'
  rawData?: {
    employeeAddress?: string
    employerAddress?: string
    employeeCity?: string
    employeeState?: string
    employeeZipCode?: string
    employerState?: string
    fullText?: string
    llmReasoning?: string
    [key: string]: any
  }
}

export interface StateDetectionInput {
  documentType: string
  extractedData: {
    employeeAddress?: string
    employerAddress?: string
    employeeCity?: string
    employeeState?: string  
    employeeZipCode?: string
    employerState?: string
    payerAddress?: string
    recipientAddress?: string
    fullText?: string
    [key: string]: any
  }
}

// US State codes and names mapping for validation
const US_STATES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
}

const STATE_NAME_TO_CODE = Object.entries(US_STATES).reduce((acc, [code, name]) => {
  acc[name.toLowerCase()] = code
  return acc
}, {} as Record<string, string>)

/**
 * Extract state from structured address data first, then fallback to LLM API
 */
export async function detectStateFromDocument(input: StateDetectionInput): Promise<StateDetectionResult> {
  console.log('🔍 [STATE DETECTION] Starting state detection process...')
  console.log('🔍 [STATE DETECTION] Input data:', {
    documentType: input.documentType,
    hasEmployeeAddress: !!input.extractedData.employeeAddress,
    hasEmployerAddress: !!input.extractedData.employerAddress,
    hasEmployeeState: !!input.extractedData.employeeState,
    hasEmployerState: !!input.extractedData.employerState,
    hasRecipientAddress: !!input.extractedData.recipientAddress,
    hasPayerAddress: !!input.extractedData.payerAddress,
  })

  // Step 1: Try direct state field extraction
  const directState = extractDirectStateField(input.extractedData)
  if (directState.detectedState) {
    console.log(`✅ [STATE DETECTION] Found direct state field: ${directState.detectedState}`)
    return directState
  }

  // Step 2: Try address parsing
  const addressState = extractStateFromAddresses(input.extractedData)
  if (addressState.detectedState) {
    console.log(`✅ [STATE DETECTION] Extracted state from address: ${addressState.detectedState}`)
    return addressState
  }

  // Step 3: Use LLM API for advanced extraction
  console.log('🔍 [STATE DETECTION] Direct extraction failed, using LLM API...')
  const llmState = await detectStateUsingLLM(input)
  if (llmState.detectedState) {
    console.log(`✅ [STATE DETECTION] LLM detected state: ${llmState.detectedState}`)
    return llmState
  }

  console.log('⚠️ [STATE DETECTION] Could not detect state from document')
  return {
    confidence: 0,
    source: 'unknown',
    rawData: input.extractedData
  }
}

/**
 * Extract state from direct state fields (employeeState, employerState, etc.)
 */
function extractDirectStateField(data: any): StateDetectionResult {
  // Priority order for state field extraction
  const stateFields = ['employeeState', 'employerState', 'recipientState', 'payerState']
  
  for (const field of stateFields) {
    const stateValue = data[field]
    if (stateValue && typeof stateValue === 'string') {
      const cleanState = stateValue.trim().toUpperCase()
      
      // Validate state code
      if (US_STATES[cleanState]) {
        return {
          detectedState: cleanState,
          confidence: 0.95,
          source: field.includes('employee') ? 'address' : 'employer',
          rawData: data
        }
      }
    }
  }

  return { confidence: 0, source: 'unknown', rawData: data }
}

/**
 * Extract state from address strings using regex patterns
 */
function extractStateFromAddresses(data: any): StateDetectionResult {
  const addressFields = [
    { field: 'employeeAddress', source: 'address' as const },
    { field: 'recipientAddress', source: 'address' as const },
    { field: 'employerAddress', source: 'employer' as const },
    { field: 'payerAddress', source: 'employer' as const },
  ]

  for (const { field, source } of addressFields) {
    const address = data[field]
    if (address && typeof address === 'string') {
      const state = parseStateFromAddress(address)
      if (state) {
        return {
          detectedState: state,
          confidence: 0.85,
          source,
          rawData: data
        }
      }
    }
  }

  return { confidence: 0, source: 'unknown', rawData: data }
}

/**
 * Parse state from address string using regex patterns
 */
function parseStateFromAddress(address: string): string | null {
  // Common address patterns with state
  const patterns = [
    // "City, ST 12345" or "City, ST 12345-1234"
    /,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?/,
    
    // "City ST 12345" (no comma)
    /\s+([A-Z]{2})\s+\d{5}(?:-\d{4})?/,
    
    // "City, State 12345" (full state name)
    /,\s*([A-Za-z\s]+)\s+\d{5}(?:-\d{4})?/,
    
    // Just state code at end: "...ST"
    /\b([A-Z]{2})\s*$/,
    
    // State name at end: "...California"
    /\b([A-Za-z\s]+)\s*$/
  ]

  for (const pattern of patterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      const stateCandidate = match[1].trim().toUpperCase()
      
      // Check if it's a valid state code
      if (US_STATES[stateCandidate]) {
        return stateCandidate
      }
      
      // Check if it's a full state name
      const stateCode = STATE_NAME_TO_CODE[match[1].trim().toLowerCase()]
      if (stateCode) {
        return stateCode
      }
    }
  }

  return null
}

/**
 * Use LLM API to detect state from document text
 */
async function detectStateUsingLLM(input: StateDetectionInput): Promise<StateDetectionResult> {
  try {
    console.log('🔍 [STATE DETECTION LLM] Calling LLM API for state detection...')
    
    const documentText = input.extractedData.fullText || ''
    const addresses = [
      input.extractedData.employeeAddress,
      input.extractedData.employerAddress,
      input.extractedData.recipientAddress,
      input.extractedData.payerAddress,
    ].filter(Boolean)

    const prompt = `You are analyzing a ${input.documentType} tax document to determine the taxpayer's state for state tax calculation purposes.

DOCUMENT TEXT:
${documentText}

EXTRACTED ADDRESSES:
${addresses.join('\n')}

TASK: Identify the US state where the taxpayer resides for tax purposes. This is usually the employee/recipient state, not the employer/payer state.

PRIORITY ORDER:
1. Employee/recipient address state (primary residence)
2. Employee/recipient state field
3. Employer/payer address state (if employee state not found)

RESPONSE FORMAT: Respond with a JSON object only:
{
  "stateCode": "XX",
  "stateName": "State Name",
  "confidence": 0.8,
  "reasoning": "Found in employee address: 123 Main St, City, ST 12345"
}

RULES:
- Return valid US state codes only (CA, NY, TX, etc.)
- Use confidence 0.9+ for explicit state codes
- Use confidence 0.7-0.8 for state names or inferred
- Use confidence 0.5-0.6 for uncertain/partial matches
- Return confidence 0.0 if no state found

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`

    const response = await fetch('/api/ai/state-detection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    })

    if (!response.ok) {
      throw new Error(`LLM API failed with status: ${response.status}`)
    }

    const result = await response.json()
    
    if (result.stateCode && US_STATES[result.stateCode.toUpperCase()]) {
      return {
        detectedState: result.stateCode.toUpperCase(),
        confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1),
        source: 'document_type',
        rawData: {
          ...input.extractedData,
          llmReasoning: result.reasoning
        }
      }
    }

    console.log('⚠️ [STATE DETECTION LLM] LLM did not return valid state')
    return { confidence: 0, source: 'unknown', rawData: input.extractedData }

  } catch (error) {
    console.error('❌ [STATE DETECTION LLM] LLM state detection error:', error)
    return { confidence: 0, source: 'unknown', rawData: input.extractedData }
  }
}

/**
 * Validate if a state code is supported for tax calculations
 */
export function isStateSupportedForTaxCalculation(stateCode: string): boolean {
  // Import here to avoid circular dependency
  const { STATE_TAX_DATA } = require('./state-tax-data')
  return !!STATE_TAX_DATA[stateCode?.toUpperCase()]
}

/**
 * Get state name from state code
 */
export function getStateName(stateCode: string): string | undefined {
  return US_STATES[stateCode?.toUpperCase()]
}

/**
 * Get all valid US state codes
 */
export function getAllStatesCodes(): string[] {
  return Object.keys(US_STATES)
}
