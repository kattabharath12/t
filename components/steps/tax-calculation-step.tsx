
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calculator, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Minus, MapPin } from "lucide-react"
import { calculateTaxReturn } from "@/lib/tax-calculations"
import { calculateEnhancedTaxReturnWithState } from "@/lib/enhanced-tax-calculations"
import { getStateInfo } from "@/lib/state-tax-data"

interface TaxCalculationStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  loading: boolean
  saving: boolean
}

export function TaxCalculationStep({ taxReturn, onUpdate, onNext, onPrev, loading, saving }: TaxCalculationStepProps) {
  const [calculation, setCalculation] = useState<any>(null)

  useEffect(() => {
    // Calculate tax return based on current data
    const totalIncome = Number(taxReturn.totalIncome) || 0
    const itemizedDeductions = taxReturn.deductionEntries?.reduce((sum: number, entry: any) => 
      sum + parseFloat(entry.amount || 0), 0
    ) || 0
    
    // Calculate total withholdings from income entries (primarily W-2s)
    const totalWithholdings = taxReturn.incomeEntries?.reduce((sum: number, entry: any) => 
      sum + parseFloat(entry.federalTaxWithheld || 0), 0
    ) || 0
    
    // Use enhanced calculation with state tax if state is detected
    const stateCode = taxReturn.detectedState || taxReturn.state
    
    if (stateCode) {
      console.log('🏛️ [TAX CALC] Calculating with state taxes for:', stateCode)
      const result = calculateEnhancedTaxReturnWithState({
        totalIncome,
        filingStatus: taxReturn.filingStatus,
        dependents: taxReturn.dependents || [],
        itemizedDeductions,
        totalWithholdings,
        stateCode,
        stateItemizedDeductions: itemizedDeductions, // Use same deductions for state
      })
      setCalculation(result)
    } else {
      console.log('🏛️ [TAX CALC] Calculating federal taxes only')
      const result = calculateTaxReturn({
        totalIncome,
        filingStatus: taxReturn.filingStatus,
        dependents: taxReturn.dependents || [],
        itemizedDeductions,
        totalWithholdings,
      })
      setCalculation(result)
    }
  }, [taxReturn])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!calculation) return
    
    // Prepare update data with both federal and state tax information
    const updateData: any = {
      totalIncome: calculation.grossIncome,
      adjustedGrossIncome: calculation.adjustedGrossIncome,
      standardDeduction: calculation.standardDeduction,
      itemizedDeduction: calculation.itemizedDeduction,
      taxableIncome: calculation.taxableIncome,
      taxLiability: calculation.taxLiability,
      totalCredits: calculation.totalCredits,
      totalWithholdings: calculation.totalWithholdings,
      refundAmount: calculation.refundAmount,
      amountOwed: calculation.amountOwed,
    }
    
    // Add state tax data if available
    if (calculation.stateTax) {
      updateData.stateTaxLiability = calculation.stateTax.stateTaxLiability
      updateData.stateStandardDeduction = calculation.stateTax.stateStandardDeduction
      updateData.stateTaxableIncome = calculation.stateTax.stateTaxableIncome
      updateData.stateEffectiveRate = calculation.stateTax.stateEffectiveRate
      updateData.stateItemizedDeduction = calculation.stateTax.stateItemizedDeduction
    }
    
    await onUpdate(updateData)
    onNext()
  }

  if (!calculation) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Calculating your taxes...</p>
        </div>
      </div>
    )
  }

  const isRefund = calculation.refundAmount > 0
  const amount = isRefund ? calculation.refundAmount : calculation.amountOwed
  const stateCode = taxReturn.detectedState || taxReturn.state
  const stateInfo = stateCode ? getStateInfo(stateCode) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Calculator className="h-4 w-4" />
          <AlertDescription>
            Based on your income, deductions, and credits, here's your calculated tax liability
            {stateInfo && (
              <>
                {" "} (including {stateInfo.hasIncomeTax ? `${stateInfo.stateName} state taxes` : `no state taxes for ${stateInfo.stateName}`})
              </>
            )}.
          </AlertDescription>
        </Alert>

        {/* State Detection Status */}
        {stateCode && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              {taxReturn.detectedState ? (
                <>
                  Automatically detected state: <strong>{stateInfo?.stateName}</strong>
                  {taxReturn.stateConfidence && (
                    <span className="text-sm text-gray-500 ml-2">
                      (confidence: {Math.round(taxReturn.stateConfidence * 100)}%)
                    </span>
                  )}
                </>
              ) : (
                <>
                  Using state: <strong>{stateInfo?.stateName}</strong>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Tax Calculation Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Your Tax Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className={`text-4xl font-bold mb-4 ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                {isRefund ? (
                  <div className="flex items-center justify-center space-x-2">
                    <TrendingUp className="h-8 w-8" />
                    <span>${amount.toLocaleString()}</span>
                  </div>
                ) : amount > 0 ? (
                  <div className="flex items-center justify-center space-x-2">
                    <TrendingDown className="h-8 w-8" />
                    <span>${amount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Minus className="h-8 w-8" />
                    <span>$0</span>
                  </div>
                )}
              </div>
              <Badge variant={isRefund ? "default" : "destructive"} className="text-lg px-4 py-2">
                {isRefund ? "Expected Refund" : amount > 0 ? "Amount Owed" : "No Tax Due"}
              </Badge>
              <p className="text-gray-600 mt-4">
                {isRefund 
                  ? "You've overpaid your taxes and should receive a refund"
                  : amount > 0
                  ? "You owe additional taxes"
                  : "Your tax liability is exactly covered by withholdings"
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Calculation Breakdown</CardTitle>
            <CardDescription>
              Here's how we calculated your tax liability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Gross Income</span>
                <span className="font-medium">${calculation.grossIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Adjusted Gross Income</span>
                <span className="font-medium">${calculation.adjustedGrossIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">
                  {calculation.itemizedDeduction > 0 ? "Itemized" : "Standard"} Deduction
                </span>
                <span className="font-medium">
                  -${Math.max(calculation.standardDeduction, calculation.itemizedDeduction).toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b font-medium">
                <span>Taxable Income</span>
                <span>${calculation.taxableIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Federal Tax Liability</span>
                <span className="font-medium">${calculation.taxLiability.toLocaleString()}</span>
              </div>
              
              {/* State Tax Information */}
              {calculation.stateTax && (
                <>
                  {calculation.stateTax.hasIncomeTax ? (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600">{calculation.stateTax.stateName} State Tax</span>
                      <span className="font-medium">${calculation.stateTax.stateTaxLiability.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600">{calculation.stateTax.stateName} State Tax</span>
                      <span className="font-medium text-green-600">$0 (No state income tax)</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center py-2 border-b font-medium">
                    <span>Combined Tax Liability</span>
                    <span>${(calculation.taxLiability + calculation.stateTax.stateTaxLiability).toLocaleString()}</span>
                  </div>
                </>
              )}
              
              {calculation.childTaxCredit > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Child Tax Credit</span>
                  <span className="font-medium text-green-600">
                    -${calculation.childTaxCredit.toLocaleString()}
                  </span>
                </div>
              )}
              
              {calculation.earnedIncomeCredit > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Earned Income Credit</span>
                  <span className="font-medium text-green-600">
                    -${calculation.earnedIncomeCredit.toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b font-medium">
                <span>Total Credits</span>
                <span className="text-green-600">
                  -${calculation.totalCredits.toLocaleString()}
                </span>
              </div>
              
              {calculation.totalWithholdings > 0 && (
                <div className="flex justify-between items-center py-2 border-b font-medium">
                  <span>Federal Tax Withheld</span>
                  <span className="text-blue-600">
                    -${calculation.totalWithholdings.toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-4 font-bold text-lg">
                <span>{isRefund ? "Expected Refund" : amount > 0 ? "Amount Owed" : "Balance Due"}</span>
                <span className={isRefund ? 'text-green-600' : amount > 0 ? 'text-red-600' : 'text-gray-600'}>
                  ${amount.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Rate Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${calculation.stateTax ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {calculation.effectiveRate.toFixed(2)}%
                </div>
                <p className="text-sm text-blue-800">Federal Effective Rate</p>
                <p className="text-xs text-gray-600 mt-1">
                  Federal tax as % of income
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {calculation.marginalRate.toFixed(0)}%
                </div>
                <p className="text-sm text-purple-800">Federal Marginal Rate</p>
                <p className="text-xs text-gray-600 mt-1">
                  Federal rate on last dollar
                </p>
              </div>
              
              {/* State Tax Rates */}
              {calculation.stateTax && (
                <>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {calculation.stateTax.stateEffectiveRate.toFixed(2)}%
                    </div>
                    <p className="text-sm text-green-800">State Effective Rate</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {calculation.stateTax.stateName} tax as % of income
                    </p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {calculation.combinedTaxResult?.totalEffectiveRate?.toFixed(2) || 
                       (calculation.effectiveRate + calculation.stateTax.stateEffectiveRate).toFixed(2)}%
                    </div>
                    <p className="text-sm text-orange-800">Combined Effective Rate</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Total tax as % of income
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onPrev}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}
