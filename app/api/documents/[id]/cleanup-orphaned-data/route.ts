

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { calculateEnhancedTaxReturnWithState } from "@/lib/enhanced-tax-calculations"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: params.id,
        userId: user.id 
      },
      include: {
        dependents: true
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    console.log(`🧹 [CLEANUP] Starting orphaned data cleanup for tax return ${params.id}`)

    const cleanupResult = await prisma.$transaction(async (tx) => {
      // Step 1: Find and delete orphaned income entries (documentId is null)
      const orphanedIncomeEntries = await tx.incomeEntry.findMany({
        where: { 
          taxReturnId: params.id,
          documentId: null
        }
      })

      if (orphanedIncomeEntries.length > 0) {
        await tx.incomeEntry.deleteMany({
          where: { 
            taxReturnId: params.id,
            documentId: null
          }
        })
        console.log(`✅ [CLEANUP] Deleted ${orphanedIncomeEntries.length} orphaned income entries`)
      }

      // Step 2: Find income entries with invalid document references
      const incomeEntriesWithInvalidDocs = await tx.incomeEntry.findMany({
        where: { 
          taxReturnId: params.id,
          documentId: { not: null }
        },
        include: {
          document: true
        }
      })

      const invalidEntries = incomeEntriesWithInvalidDocs.filter(entry => !entry.document)
      if (invalidEntries.length > 0) {
        await tx.incomeEntry.deleteMany({
          where: { 
            id: { in: invalidEntries.map(entry => entry.id) }
          }
        })
        console.log(`✅ [CLEANUP] Deleted ${invalidEntries.length} income entries with invalid document references`)
      }

      // Step 3: Recalculate totals from valid remaining entries only
      const validIncomeEntries = await tx.incomeEntry.findMany({
        where: { 
          taxReturnId: params.id,
          documentId: { not: null },
          document: { isNot: null }
        },
        include: {
          document: {
            select: { id: true, processingStatus: true }
          }
        }
      })

      // Calculate correct totals from valid entries only
      const newTotalIncome = validIncomeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0)

      const newTotalWithholdings = validIncomeEntries.reduce((sum, entry) => 
        sum + parseFloat((entry.federalTaxWithheld || 0).toString()), 0)

      console.log(`📊 [CLEANUP] Recalculated totals from ${validIncomeEntries.length} valid entries: Income: $${newTotalIncome}, Withholdings: $${newTotalWithholdings}`)

      // Step 4: Perform full tax recalculation with correct data
      let taxCalculationResult = null
      try {
        const taxData = {
          totalIncome: newTotalIncome,
          filingStatus: taxReturn.filingStatus,
          dependents: taxReturn.dependents,
          itemizedDeductions: parseFloat(taxReturn.itemizedDeduction.toString()),
          totalWithholdings: newTotalWithholdings,
          stateCode: taxReturn.detectedState || undefined,
          stateItemizedDeductions: parseFloat(taxReturn.stateItemizedDeduction.toString())
        }

        taxCalculationResult = calculateEnhancedTaxReturnWithState(taxData)
        console.log(`✅ [CLEANUP] Tax recalculation completed`)
      } catch (calcError) {
        console.error('⚠️ [CLEANUP] Tax calculation failed:', calcError)
        // Continue with basic updates even if tax calculation fails
      }

      // Step 5: Update tax return with cleaned and recalculated data
      const updateData: any = {
        totalIncome: newTotalIncome,
        totalWithholdings: newTotalWithholdings,
        adjustedGrossIncome: newTotalIncome,
        lastSavedAt: new Date(),
        updatedAt: new Date()
      }

      if (taxCalculationResult) {
        updateData.taxableIncome = taxCalculationResult.taxableIncome
        updateData.taxLiability = taxCalculationResult.taxLiability
        updateData.totalCredits = taxCalculationResult.totalCredits
        updateData.refundAmount = taxCalculationResult.refundAmount
        updateData.amountOwed = taxCalculationResult.amountOwed
        updateData.standardDeduction = taxCalculationResult.standardDeduction
        updateData.itemizedDeduction = taxCalculationResult.itemizedDeduction

        // State tax updates if available
        if (taxCalculationResult.stateTax) {
          updateData.stateTaxLiability = taxCalculationResult.stateTax.stateTaxLiability
          updateData.stateStandardDeduction = taxCalculationResult.stateTax.stateStandardDeduction
          updateData.stateTaxableIncome = taxCalculationResult.stateTax.stateTaxableIncome
          updateData.stateEffectiveRate = taxCalculationResult.stateTax.stateEffectiveRate
        } else {
          updateData.stateTaxLiability = 0
          updateData.stateStandardDeduction = 0
          updateData.stateTaxableIncome = 0
          updateData.stateEffectiveRate = 0
        }
      } else {
        // Reset tax calculations if calculation failed
        updateData.taxableIncome = 0
        updateData.taxLiability = 0
        updateData.stateTaxLiability = 0
        updateData.refundAmount = 0
        updateData.amountOwed = 0
      }

      await tx.taxReturn.update({
        where: { id: params.id },
        data: updateData
      })

      return {
        orphanedIncomeEntriesDeleted: orphanedIncomeEntries.length,
        invalidDocumentEntriesDeleted: invalidEntries.length,
        validIncomeEntriesRemaining: validIncomeEntries.length,
        newTotalIncome,
        newTotalWithholdings,
        taxCalculationResult
      }
    })

    console.log(`🎉 [CLEANUP] Orphaned data cleanup completed successfully`)

    return NextResponse.json({
      success: true,
      message: "Orphaned data cleanup completed successfully",
      cleanupSummary: cleanupResult
    })

  } catch (error) {
    console.error("💥 [CLEANUP] Error during orphaned data cleanup:", error)
    return NextResponse.json(
      { error: "Failed to cleanup orphaned data" },
      { status: 500 }
    )
  }
}

