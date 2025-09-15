

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
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
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    // CRITICAL FIX: Only return income entries from existing, valid documents
    const validIncomeEntries = await prisma.incomeEntry.findMany({
      where: { 
        taxReturnId: params.id,
        // Only include entries that have a valid document reference
        documentId: { not: null },
        // Verify the document actually exists
        document: { isNot: null }
      },
      include: {
        document: {
          select: { 
            id: true, 
            fileName: true, 
            documentType: true, 
            processingStatus: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals from valid entries only
    const totalIncome = validIncomeEntries.reduce((sum, entry) => 
      sum + parseFloat(entry.amount.toString()), 0)

    const totalWithholdings = validIncomeEntries.reduce((sum, entry) => 
      sum + parseFloat((entry.federalTaxWithheld || 0).toString()), 0)

    // Check for orphaned entries (for debugging/cleanup purposes)
    const orphanedEntries = await prisma.incomeEntry.findMany({
      where: { 
        taxReturnId: params.id,
        documentId: null
      }
    })

    const invalidReferenceEntries = await prisma.incomeEntry.findMany({
      where: { 
        taxReturnId: params.id,
        documentId: { not: null }
      },
      include: {
        document: true
      }
    })

    const entriesWithInvalidDocs = invalidReferenceEntries.filter(entry => !entry.document)

    console.log(`📊 [CURRENT-INCOME] Tax return ${params.id}: ${validIncomeEntries.length} valid entries, ${orphanedEntries.length} orphaned, ${entriesWithInvalidDocs.length} with invalid doc refs`)

    return NextResponse.json({
      incomeEntries: validIncomeEntries,
      summary: {
        totalEntries: validIncomeEntries.length,
        totalIncome,
        totalWithholdings,
        orphanedEntriesFound: orphanedEntries.length,
        invalidReferenceEntriesFound: entriesWithInvalidDocs.length,
        needsCleanup: (orphanedEntries.length + entriesWithInvalidDocs.length) > 0
      }
    })

  } catch (error) {
    console.error("💥 [CURRENT-INCOME] Error fetching current income:", error)
    return NextResponse.json(
      { error: "Failed to fetch current income data" },
      { status: 500 }
    )
  }
}
