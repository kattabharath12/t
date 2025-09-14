
import { calculateTaxLiability, getStandardDeduction, TaxCalculationResult, calculateTaxReturn } from './tax-calculations'
import { calculateCombinedTax, CombinedTaxResult, StateTaxCalculationResult } from './state-tax-calculations'

export interface DeductionComparison {
  standardDeduction: number
  itemizedDeduction: number
  standardTaxLiability: number
  itemizedTaxLiability: number
  recommendedMethod: 'standard' | 'itemized'
  taxSavings: number
  effectiveStandardRate: number
  effectiveItemizedRate: number
}

export interface EnhancedTaxCalculationResult extends TaxCalculationResult {
  deductionComparison: DeductionComparison
  taxOptimizationSuggestions: string[]
  // State tax integration - NEW
  stateTax?: StateTaxCalculationResult
  combinedTaxResult?: CombinedTaxResult
}

export function calculateDeductionComparison(
  adjustedGrossIncome: number,
  filingStatus: string,
  itemizedDeductions: number,
  dependents: any[] = []
): DeductionComparison {
  const standardDeduction = getStandardDeduction(filingStatus)
  const itemizedDeduction = itemizedDeductions || 0

  // Calculate taxable income for both scenarios
  const standardTaxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction)
  const itemizedTaxableIncome = Math.max(0, adjustedGrossIncome - itemizedDeduction)

  // Calculate tax liability for both scenarios
  const standardTaxLiability = calculateTaxLiability(standardTaxableIncome, filingStatus)
  const itemizedTaxLiability = calculateTaxLiability(itemizedTaxableIncome, filingStatus)

  // Determine which method is better
  const recommendedMethod = itemizedTaxLiability < standardTaxLiability ? 'itemized' : 'standard'
  const taxSavings = Math.abs(standardTaxLiability - itemizedTaxLiability)

  // Calculate effective tax rates
  const effectiveStandardRate = adjustedGrossIncome > 0 ? (standardTaxLiability / adjustedGrossIncome) * 100 : 0
  const effectiveItemizedRate = adjustedGrossIncome > 0 ? (itemizedTaxLiability / adjustedGrossIncome) * 100 : 0

  return {
    standardDeduction,
    itemizedDeduction,
    standardTaxLiability,
    itemizedTaxLiability,
    recommendedMethod,
    taxSavings,
    effectiveStandardRate,
    effectiveItemizedRate
  }
}

export function generateTaxOptimizationSuggestions(
  comparison: DeductionComparison,
  adjustedGrossIncome: number,
  filingStatus: string,
  dependents: any[] = []
): string[] {
  const suggestions: string[] = []

  // Deduction method suggestion
  if (comparison.recommendedMethod === 'itemized') {
    suggestions.push(`💡 Itemizing deductions saves you $${comparison.taxSavings.toLocaleString()} compared to the standard deduction`)
  } else if (comparison.taxSavings > 0) {
    suggestions.push(`💡 The standard deduction saves you $${comparison.taxSavings.toLocaleString()} compared to itemizing`)
  } else {
    suggestions.push(`Both deduction methods result in the same tax liability`)
  }

  // Threshold analysis
  const standardDeduction = comparison.standardDeduction
  const itemizedDeduction = comparison.itemizedDeduction
  const threshold = standardDeduction - itemizedDeduction

  if (comparison.recommendedMethod === 'standard' && threshold > 0 && threshold < 5000) {
    suggestions.push(`🔍 You're close to benefiting from itemizing! You need $${threshold.toLocaleString()} more in deductions to break even`)
  }

  // Filing status optimization
  if (filingStatus === 'MARRIED_FILING_SEPARATELY') {
    suggestions.push(`💭 Consider whether filing jointly with your spouse would result in lower combined taxes`)
  }

  // Dependent optimization
  if (dependents.length > 0) {
    const childTaxCreditEligible = dependents.filter(dep => dep.qualifiesForCTC).length
    const eicEligible = dependents.filter(dep => dep.qualifiesForEITC).length
    
    if (childTaxCreditEligible > 0) {
      suggestions.push(`👶 You may qualify for up to $${(childTaxCreditEligible * 2000).toLocaleString()} in Child Tax Credits`)
    }
    
    if (eicEligible > 0) {
      suggestions.push(`💰 You may qualify for Earned Income Credit with ${eicEligible} qualifying children`)
    }
  }

  // Income-based suggestions
  if (adjustedGrossIncome > 100000) {
    suggestions.push(`📊 Consider maximizing retirement contributions to reduce taxable income`)
  }

  if (adjustedGrossIncome < 50000) {
    suggestions.push(`🎯 Look into the Earned Income Tax Credit and other low-income tax benefits`)
  }

  return suggestions
}

export function calculateEnhancedTaxReturn(data: {
  totalIncome: number
  filingStatus: string
  dependents: any[]
  itemizedDeductions: number
  totalWithholdings?: number
}): EnhancedTaxCalculationResult {
  const { totalIncome, filingStatus, dependents, itemizedDeductions, totalWithholdings } = data
  
  // Get basic tax calculation
  const basicResult = calculateTaxReturn(data) as TaxCalculationResult
  
  // Calculate deduction comparison
  const deductionComparison = calculateDeductionComparison(
    basicResult.adjustedGrossIncome,
    filingStatus,
    itemizedDeductions,
    dependents
  )
  
  // Generate optimization suggestions
  const taxOptimizationSuggestions = generateTaxOptimizationSuggestions(
    deductionComparison,
    basicResult.adjustedGrossIncome,
    filingStatus,
    dependents
  )
  
  // Update the basic result with optimized deduction method
  const optimizedDeduction = deductionComparison.recommendedMethod === 'itemized' 
    ? deductionComparison.itemizedDeduction 
    : deductionComparison.standardDeduction
  
  const optimizedTaxableIncome = Math.max(0, basicResult.adjustedGrossIncome - optimizedDeduction)
  const optimizedTaxLiability = calculateTaxLiability(optimizedTaxableIncome, filingStatus)
  const optimizedFinalTax = Math.max(0, optimizedTaxLiability - basicResult.totalCredits)
  
  return {
    ...basicResult,
    taxableIncome: optimizedTaxableIncome,
    taxLiability: optimizedTaxLiability,
    finalTax: optimizedFinalTax,
    standardDeduction: deductionComparison.standardDeduction,
    itemizedDeduction: deductionComparison.itemizedDeduction,
    deductionComparison,
    taxOptimizationSuggestions
  }
}

// Enhanced tax calculation WITH state tax integration - NEW FUNCTION
export function calculateEnhancedTaxReturnWithState(data: {
  totalIncome: number
  filingStatus: string
  dependents: any[]
  itemizedDeductions: number
  totalWithholdings?: number
  stateCode?: string
  stateItemizedDeductions?: number
}): EnhancedTaxCalculationResult {
  const { 
    totalIncome, 
    filingStatus, 
    dependents, 
    itemizedDeductions, 
    totalWithholdings,
    stateCode,
    stateItemizedDeductions 
  } = data
  
  // Get basic federal tax calculation first
  const federalResult = calculateEnhancedTaxReturn({
    totalIncome,
    filingStatus,
    dependents,
    itemizedDeductions,
    totalWithholdings
  })
  
  // If no state code provided, return federal-only result
  if (!stateCode) {
    return federalResult
  }
  
  try {
    // Calculate combined federal + state taxes
    const combinedTaxResult = calculateCombinedTax({
      adjustedGrossIncome: federalResult.adjustedGrossIncome,
      federalTaxableIncome: federalResult.taxableIncome,
      federalTaxLiability: federalResult.taxLiability,
      federalEffectiveRate: federalResult.effectiveRate,
      federalMarginalRate: federalResult.marginalRate,
      filingStatus,
      stateCode,
      stateItemizedDeductions: stateItemizedDeductions || itemizedDeductions,
      dependents,
      totalCredits: federalResult.totalCredits,
      totalWithholdings: federalResult.totalWithholdings
    })
    
    // Update optimization suggestions to include state tax considerations
    const enhancedSuggestions = generateStateTaxOptimizationSuggestions(
      federalResult.taxOptimizationSuggestions,
      combinedTaxResult.stateTax,
      federalResult.deductionComparison
    )
    
    return {
      ...federalResult,
      // Override final calculations with combined results
      finalTax: combinedTaxResult.finalTax,
      refundAmount: combinedTaxResult.refundAmount,
      amountOwed: combinedTaxResult.amountOwed,
      // Add state tax information
      stateTax: combinedTaxResult.stateTax,
      combinedTaxResult,
      taxOptimizationSuggestions: enhancedSuggestions,
    }
    
  } catch (error) {
    console.error('State tax calculation error:', error)
    // Fall back to federal-only result if state calculation fails
    return {
      ...federalResult,
      taxOptimizationSuggestions: [
        ...federalResult.taxOptimizationSuggestions,
        `⚠️ State tax calculation failed for ${stateCode}. Showing federal taxes only.`
      ]
    }
  }
}

// Generate state-specific tax optimization suggestions
function generateStateTaxOptimizationSuggestions(
  federalSuggestions: string[],
  stateTax: StateTaxCalculationResult,
  deductionComparison: DeductionComparison
): string[] {
  const suggestions = [...federalSuggestions]
  
  if (!stateTax.hasIncomeTax) {
    suggestions.unshift(`💰 Great news! ${stateTax.stateName} has no state income tax, saving you money!`)
    return suggestions
  }
  
  // State tax specific suggestions
  if (stateTax.stateTaxLiability > 0) {
    suggestions.push(`📍 ${stateTax.stateName} state tax: $${stateTax.stateTaxLiability.toLocaleString()} (${stateTax.stateEffectiveRate.toFixed(2)}% effective rate)`)
    
    // State deduction optimization
    if (stateTax.stateStandardDeduction > 0 && stateTax.stateItemizedDeduction > stateTax.stateStandardDeduction) {
      const stateSavings = (stateTax.stateItemizedDeduction - stateTax.stateStandardDeduction) * (stateTax.stateMarginalRate / 100)
      if (stateSavings > 100) {
        suggestions.push(`🏛️ Itemizing saves $${stateSavings.toFixed(0)} on ${stateTax.stateName} state taxes`)
      }
    }
    
    // High state tax warning
    if (stateTax.stateEffectiveRate > 5) {
      suggestions.push(`⚡ ${stateTax.stateName} has relatively high state taxes. Consider tax-advantaged retirement contributions.`)
    }
  }
  
  // Cross-deduction optimization
  if (stateTax.stateStandardDeduction !== deductionComparison.standardDeduction) {
    suggestions.push(`🔄 Note: ${stateTax.stateName} has different deduction amounts than federal`)
  }
  
  return suggestions
}

export function calculateTaxImpactScenarios(
  adjustedGrossIncome: number,
  filingStatus: string,
  currentItemizedDeductions: number,
  dependents: any[] = []
): Array<{
  scenario: string
  description: string
  itemizedDeductions: number
  taxLiability: number
  savings: number
}> {
  const baseComparison = calculateDeductionComparison(
    adjustedGrossIncome,
    filingStatus,
    currentItemizedDeductions,
    dependents
  )
  
  const baseTaxLiability = baseComparison.recommendedMethod === 'itemized'
    ? baseComparison.itemizedTaxLiability
    : baseComparison.standardTaxLiability
  
  const scenarios = [
    {
      scenario: 'Current',
      description: 'Your current deductions',
      itemizedDeductions: currentItemizedDeductions,
      taxLiability: baseTaxLiability,
      savings: 0
    }
  ]
  
  // Add scenarios for additional deductions
  const additionalDeductions = [1000, 2500, 5000, 10000]
  
  additionalDeductions.forEach(additional => {
    const newItemizedDeductions = currentItemizedDeductions + additional
    const newComparison = calculateDeductionComparison(
      adjustedGrossIncome,
      filingStatus,
      newItemizedDeductions,
      dependents
    )
    
    const newTaxLiability = newComparison.recommendedMethod === 'itemized'
      ? newComparison.itemizedTaxLiability
      : newComparison.standardTaxLiability
    
    scenarios.push({
      scenario: `+$${additional.toLocaleString()}`,
      description: `With $${additional.toLocaleString()} more in deductions`,
      itemizedDeductions: newItemizedDeductions,
      taxLiability: newTaxLiability,
      savings: baseTaxLiability - newTaxLiability
    })
  })
  
  return scenarios
}
