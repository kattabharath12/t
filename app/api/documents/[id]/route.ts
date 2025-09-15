
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id: params.id },
      include: {
        taxReturn: {
          select: { userId: true }
        }
      }
    })

    if (!document || document.taxReturn.userId !== user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id: params.id },
      include: {
        taxReturn: {
          select: { userId: true, id: true }
        },
        incomeEntries: true // Include income entries to track what will be deleted
      }
    })

    if (!document || document.taxReturn.userId !== user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log(`🗑️ [DELETE] Deleting document ${params.id} and ${document.incomeEntries.length} associated income entries`)

    // CRITICAL FIX: Delete all associated data in a transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete all income entries linked to this document
      const deletedIncomeEntries = await tx.incomeEntry.deleteMany({
        where: { documentId: params.id }
      })
      console.log(`✅ [DELETE] Deleted ${deletedIncomeEntries.count} income entries`)

      // Step 2: Delete all document extracted entries
      const deletedExtractedEntries = await tx.documentExtractedEntry.deleteMany({
        where: { documentId: params.id }
      })
      console.log(`✅ [DELETE] Deleted ${deletedExtractedEntries.count} extracted entries`)

      // Step 3: Delete the document
      await tx.document.delete({
        where: { id: params.id }
      })
      console.log(`✅ [DELETE] Deleted document ${params.id}`)

      // Step 4: CRITICAL - Recalculate tax return totals from remaining documents
      const remainingIncomeEntries = await tx.incomeEntry.findMany({
        where: { 
          taxReturnId: document.taxReturn.id,
          documentId: { not: null } // Only include entries with valid document references
        }
      })

      // Calculate new totals from remaining documents only
      const newTotalIncome = remainingIncomeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0)

      const newTotalWithholdings = remainingIncomeEntries.reduce((sum, entry) => 
        sum + parseFloat((entry.federalTaxWithheld || 0).toString()), 0)

      console.log(`📊 [DELETE] Recalculating totals: Income: ${newTotalIncome}, Withholdings: ${newTotalWithholdings}`)

      // Update tax return with recalculated totals - RESET to current documents only
      await tx.taxReturn.update({
        where: { id: document.taxReturn.id },
        data: {
          totalIncome: newTotalIncome,
          totalWithholdings: newTotalWithholdings,
          // Reset calculated fields to trigger recalculation
          adjustedGrossIncome: newTotalIncome, // Will be recalculated properly later
          taxableIncome: 0, // Will be recalculated
          taxLiability: 0, // Will be recalculated  
          stateTaxLiability: 0, // Will be recalculated
          refundAmount: 0, // Will be recalculated
          amountOwed: 0, // Will be recalculated
          lastSavedAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log(`✅ [DELETE] Tax return totals recalculated successfully`)
    })

    console.log(`🎉 [DELETE] Document deletion and cleanup completed successfully`)
    return NextResponse.json({ 
      success: true,
      message: 'Document and all associated data deleted successfully'
    })
  } catch (error) {
    console.error('💥 [DELETE] Error deleting document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
