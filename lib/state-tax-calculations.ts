
import { STATE_TAX_DATA, StateTaxInfo, getStateInfo } from './state-tax-data'

export interface StateTaxCalculationResult {
  stateCode: string
  stateName: string
  hasIncomeTax: boolean
  stateStandardDeduction: number
  stateItemizedDeduction: number
  stateTaxableIncome: number
  stateTaxLiability: number
  statePersonalExemption: number
  stateEffectiveRate: number
  stateMarginalRate: number
  notes?: string
}

export function calculateStateTaxLiability(
  taxableIncome: number, 
  filingStatus: string, 
  stateCode: string
): number {
  const stateInfo = getStateInfo(stateCode)
  
  if (!stateInfo || !stateInfo.hasIncomeTax) {
    return 0 // No state income tax
  }

  const brackets = stateInfo.brackets[filingStatus.toLowerCase().replace(/_/g, '')]
  
  if (!brackets || brackets.length === 0) {
    return 0
  }

  let tax = 0
  
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) {
      break
    }
    
    const taxableInThisBracket = Math.min(taxableIncome, bracket.max) - bracket.min
    tax += taxableInThisBracket * bracket.rate
  }
  
  return Math.round(tax * 100) / 100
}

export function getStateStandardDeduction(filingStatus: string, stateCode: string): number {
  const stateInfo = getStateInfo(stateCode)
  
  if (!stateInfo || !stateInfo.hasIncomeTax) {
    return 0
  }

  const status = filingStatus.toLowerCase().replace(/_/g, '')
  
  switch (status) {
    case 'single':
      return stateInfo.standardDeduction.single
    case 'marriedfilingjointly':
      return stateInfo.standardDeduction.marriedFilingJointly
    case 'marriedfilingseparately':
      return stateInfo.standardDeduction.marriedFilingSeparately
    case 'headofhousehold':
      return stateInfo.standardDeduction.headOfHousehold
    case 'qualifyingsurvivingspouse':
      return stateInfo.standardDeduction.qualifyingSurvivingSpouse || stateInfo.standardDeduction.marriedFilingJointly
    default:
      return stateInfo.standardDeduction.single
  }
}

export function getStatePersonalExemption(stateCode: string): number {
  const stateInfo = getStateInfo(stateCode)
  return stateInfo?.personalExemption || 0
}

export function calculateStateTax(data: {
  adjustedGrossIncome: number
  filingStatus: string
  stateCode: string
  stateItemizedDeductions?: number
  dependents?: any[]
}): StateTaxCalculationResult {
  const { adjustedGrossIncome, filingStatus, stateCode, stateItemizedDeductions = 0, dependents = [] } = data
  
  const stateInfo = getStateInfo(stateCode)
  
  if (!stateInfo) {
    throw new Error(`Unsupported state: ${stateCode}`)
  }

  // Base result structure
  const result: StateTaxCalculationResult = {
    stateCode: stateInfo.stateCode,
    stateName: stateInfo.stateName,
    hasIncomeTax: stateInfo.hasIncomeTax,
    stateStandardDeduction: 0,
    stateItemizedDeduction: stateItemizedDeductions,
    stateTaxableIncome: 0,
    stateTaxLiability: 0,
    statePersonalExemption: getStatePersonalExemption(stateCode),
    stateEffectiveRate: 0,
    stateMarginalRate: 0,
    notes: stateInfo.notes,
  }

  // If no state income tax, return zeroed result
  if (!stateInfo.hasIncomeTax) {
    return result
  }

  // Calculate state standard deduction
  result.stateStandardDeduction = getStateStandardDeduction(filingStatus, stateCode)
  
  // Calculate state taxable income
  const stateDeduction = Math.max(result.stateStandardDeduction, stateItemizedDeductions)
  const personalExemptionTotal = result.statePersonalExemption * (1 + (dependents?.length || 0))
  
  result.stateTaxableIncome = Math.max(0, adjustedGrossIncome - stateDeduction - personalExemptionTotal)
  
  // Calculate state tax liability
  result.stateTaxLiability = calculateStateTaxLiability(result.stateTaxableIncome, filingStatus, stateCode)
  
  // Calculate effective rate
  result.stateEffectiveRate = adjustedGrossIncome > 0 ? (result.stateTaxLiability / adjustedGrossIncome) * 100 : 0
  
  // Calculate marginal rate
  if (stateInfo.brackets && stateInfo.brackets[filingStatus.toLowerCase().replace(/_/g, '')]) {
    const brackets = stateInfo.brackets[filingStatus.toLowerCase().replace(/_/g, '')]
    let marginalRate = 0
    for (const bracket of brackets) {
      if (result.stateTaxableIncome > bracket.min) {
        marginalRate = bracket.rate * 100
      }
    }
    result.stateMarginalRate = marginalRate
  }
  
  return result
}

// Enhanced calculation with both federal and state taxes
export interface CombinedTaxResult {
  // Federal tax data
  federalTaxableIncome: number
  federalTaxLiability: number
  federalEffectiveRate: number
  federalMarginalRate: number
  
  // State tax data
  stateTax: StateTaxCalculationResult
  
  // Combined totals
  totalTaxLiability: number
  totalEffectiveRate: number
  totalCredits: number
  totalWithholdings: number
  finalTax: number
  refundAmount: number
  amountOwed: number
}

export function calculateCombinedTax(data: {
  adjustedGrossIncome: number
  federalTaxableIncome: number
  federalTaxLiability: number
  federalEffectiveRate: number
  federalMarginalRate: number
  filingStatus: string
  stateCode: string
  stateItemizedDeductions?: number
  dependents?: any[]
  totalCredits?: number
  totalWithholdings?: number
}): CombinedTaxResult {
  const {
    adjustedGrossIncome,
    federalTaxableIncome,
    federalTaxLiability,
    federalEffectiveRate,
    federalMarginalRate,
    filingStatus,
    stateCode,
    stateItemizedDeductions = 0,
    dependents = [],
    totalCredits = 0,
    totalWithholdings = 0
  } = data

  // Calculate state tax
  const stateTax = calculateStateTax({
    adjustedGrossIncome,
    filingStatus,
    stateCode,
    stateItemizedDeductions,
    dependents
  })

  // Calculate combined totals
  const totalTaxLiability = federalTaxLiability + stateTax.stateTaxLiability
  const totalEffectiveRate = adjustedGrossIncome > 0 ? (totalTaxLiability / adjustedGrossIncome) * 100 : 0
  
  // Calculate final tax after credits and withholdings
  const finalTax = totalTaxLiability - totalCredits - totalWithholdings
  
  // Determine refund vs amount owed
  const refundAmount = finalTax < 0 ? Math.abs(finalTax) : 0
  const amountOwed = finalTax > 0 ? finalTax : 0

  return {
    federalTaxableIncome,
    federalTaxLiability,
    federalEffectiveRate,
    federalMarginalRate,
    stateTax,
    totalTaxLiability,
    totalEffectiveRate,
    totalCredits,
    totalWithholdings,
    finalTax,
    refundAmount,
    amountOwed,
  }
}

// Helper function to get tax summary for a state
export function getStateTaxSummary(stateCode: string): {
  stateInfo: StateTaxInfo | undefined
  hasFlatTax: boolean
  topMarginalRate: number
  hasStandardDeduction: boolean
} {
  const stateInfo = getStateInfo(stateCode)
  
  if (!stateInfo || !stateInfo.hasIncomeTax) {
    return {
      stateInfo,
      hasFlatTax: false,
      topMarginalRate: 0,
      hasStandardDeduction: false,
    }
  }

  // Check if it's a flat tax (single bracket with rate > 0)
  const singleBrackets = stateInfo.brackets.single || []
  const hasFlatTax = singleBrackets.length === 1 && singleBrackets[0]?.rate > 0

  // Get top marginal rate
  const topMarginalRate = singleBrackets.length > 0 
    ? Math.max(...singleBrackets.map(b => b.rate)) * 100 
    : 0

  // Check if has standard deduction
  const hasStandardDeduction = stateInfo.standardDeduction.single > 0

  return {
    stateInfo,
    hasFlatTax,
    topMarginalRate,
    hasStandardDeduction,
  }
}
