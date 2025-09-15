
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AzureDocumentIntelligenceService } from "@/lib/azure-document-intelligence-service"
import { detectStateFromDocument } from "@/lib/state-detection"
import { W2ToForm1040Mapper } from "@/lib/w2-to-1040-mapping"
import { Form1099ToForm1040Mapper } from "@/lib/1099-to-1040-mapping"
import { DuplicateDetectionService } from "@/lib/duplicate-detection"
import { calculateEnhancedTaxReturnWithState } from "@/lib/enhanced-tax-calculations"
import { DocumentType, ProcessingStatus, IncomeType } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("🔍 [PROCESS] Starting comprehensive document processing for ID:", params.id)
  
  try {
    console.log("🔍 [PROCESS] Step 1: Authentication and user verification...")
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      console.log("❌ [PROCESS] No session or email found")
      return NextResponse.json({ 
        error: "Authentication required. Please log in to process documents." 
      }, { status: 401 })
    }
    console.log("✅ [PROCESS] Session found for email:", session.user.email)

    console.log("🔍 [PROCESS] Step 2: Database verification and document lookup...")
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.log("❌ [PROCESS] User not found in database")
      return NextResponse.json({ 
        error: "User not found. Please contact support." 
      }, { status: 404 })
    }

    const document = await prisma.document.findFirst({
      where: { 
        id: params.id,
        taxReturn: { userId: user.id }
      },
      include: {
        taxReturn: {
          include: {
            documents: {
              where: {
                processingStatus: 'COMPLETED'
              }
            },
            incomeEntries: true,
            dependents: true
          }
        }
      }
    })

    if (!document) {
      console.log("❌ [PROCESS] Document not found or not owned by user")
      return NextResponse.json({ 
        error: "Document not found or access denied" 
      }, { status: 404 })
    }
    console.log("✅ [PROCESS] Document found:", document.id, "Type:", document.documentType)

    console.log("🔍 [PROCESS] Step 3: Processing status validation...")
    if (document.processingStatus === 'COMPLETED') {
      console.log("✅ [PROCESS] Document already processed, returning comprehensive data")
      
      // Return comprehensive data including state tax information
      const responseData = {
        documentId: document.id,
        extractedData: document.extractedData,
        ocrText: document.ocrText,
        processingStatus: document.processingStatus,
        documentType: document.documentType,
        fileName: document.fileName,
        
        // State detection results
        detectedState: document.taxReturn.detectedState,
        stateConfidence: document.taxReturn.stateConfidence,
        stateSource: document.taxReturn.stateSource,
        
        // Tax calculation results
        taxCalculations: {
          totalIncome: parseFloat(document.taxReturn.totalIncome.toString()),
          adjustedGrossIncome: parseFloat(document.taxReturn.adjustedGrossIncome.toString()),
          taxableIncome: parseFloat(document.taxReturn.taxableIncome.toString()),
          taxLiability: parseFloat(document.taxReturn.taxLiability.toString()),
          stateTaxLiability: parseFloat(document.taxReturn.stateTaxLiability.toString()),
          refundAmount: parseFloat(document.taxReturn.refundAmount.toString()),
          amountOwed: parseFloat(document.taxReturn.amountOwed.toString())
        },
        
        // Processing metadata
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }

      return NextResponse.json(responseData)
    }

    if (document.processingStatus === 'PROCESSING') {
      console.log("⚠️ [PROCESS] Document is already being processed")
      return NextResponse.json({ 
        error: "Document is currently being processed. Please wait and try again." 
      }, { status: 409 })
    }

    console.log("🔍 [PROCESS] Step 4: Setting processing status...")
    await prisma.document.update({
      where: { id: document.id },
      data: { 
        processingStatus: 'PROCESSING',
        updatedAt: new Date()
      }
    })

    console.log("🔍 [PROCESS] Step 5: Azure Document Intelligence configuration...")
    const azureConfig = {
      endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!,
      apiKey: process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY!
    }

    if (!azureConfig.endpoint || !azureConfig.apiKey) {
      throw new Error("Azure Document Intelligence credentials not configured. Please contact support.")
    }

    console.log("🔍 [PROCESS] Step 6: Initializing Azure Document Intelligence service...")
    const azureService = new AzureDocumentIntelligenceService(azureConfig)

    console.log("🔍 [PROCESS] Step 7: Extracting document data with Azure DI...")
    let extractedData
    try {
      extractedData = await azureService.extractDataFromDocument(
        document.filePath,
        document.documentType
      )
      console.log("✅ [PROCESS] Document extraction completed successfully")
      
      // Log extraction results for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log("🔍 [PROCESS] Extracted data summary:", {
          hasFullText: !!extractedData.fullText,
          fieldCount: Object.keys(extractedData).length,
          documentTypeCorrection: extractedData.correctedDocumentType,
          mainFields: Object.keys(extractedData).filter(key => 
            !['fullText', 'correctedDocumentType'].includes(key)
          ).slice(0, 10)
        })
      }
    } catch (extractionError: any) {
      console.error("❌ [PROCESS] Document extraction failed:", extractionError)
      throw new Error(`Document extraction failed: ${extractionError.message}`)
    }

    console.log("🔍 [PROCESS] Step 8: Document type validation and correction...")
    let finalDocumentType = document.documentType
    
    if (extractedData.correctedDocumentType) {
      console.log("🔄 [PROCESS] Document type correction detected:", 
        document.documentType, "→", extractedData.correctedDocumentType)
      
      // Update document type in database
      await prisma.document.update({
        where: { id: document.id },
        data: { documentType: extractedData.correctedDocumentType }
      })
      finalDocumentType = extractedData.correctedDocumentType
    }

    console.log("🔍 [PROCESS] Step 9: State detection and analysis...")
    let stateDetectionResult = null
    let detectedStateCode = null
    
    try {
      stateDetectionResult = await detectStateFromDocument({
        documentType: finalDocumentType,
        extractedData
      })
      
      if (stateDetectionResult?.detectedState) {
        detectedStateCode = stateDetectionResult.detectedState
        console.log("✅ [PROCESS] State detection completed:", {
          state: detectedStateCode,
          confidence: stateDetectionResult.confidence,
          source: stateDetectionResult.source
        })
      } else {
        console.log("⚠️ [PROCESS] State detection completed but no state found")
      }
    } catch (stateError: any) {
      console.error("⚠️ [PROCESS] State detection failed:", stateError)
      // Continue processing even if state detection fails
    }

    console.log("🔍 [PROCESS] Step 10: Duplicate detection analysis...")
    let duplicateCheckResult = null
    
    try {
      duplicateCheckResult = await DuplicateDetectionService.checkForDuplicates({
        documentType: finalDocumentType,
        extractedData,
        taxReturnId: document.taxReturnId
      })
      
      if (duplicateCheckResult.isDuplicate) {
        console.log("⚠️ [PROCESS] Potential duplicate detected:", {
          confidence: duplicateCheckResult.confidence,
          matchingDocuments: duplicateCheckResult.matchingDocuments.length
        })
      } else {
        console.log("✅ [PROCESS] No duplicates detected")
      }
    } catch (duplicateError: any) {
      console.error("⚠️ [PROCESS] Duplicate detection failed:", duplicateError)
      // Continue processing even if duplicate detection fails
    }

    console.log("🔍 [PROCESS] Step 11: Form 1040 data mapping...")
    let form1040Mapping = null
    let updatedTaxReturnData = {}
    
    try {
      // Get current tax return data
      const currentTaxReturn = await prisma.taxReturn.findUnique({
        where: { id: document.taxReturnId },
        include: { dependents: true }
      })

      if (!currentTaxReturn) {
        throw new Error("Tax return not found for Form 1040 mapping")
      }

      // Map document data to Form 1040
      if (finalDocumentType === 'W2') {
        console.log("🔍 [PROCESS] Mapping W2 data to Form 1040...")
        form1040Mapping = W2ToForm1040Mapper.mapW2ToForm1040(extractedData)
        
        // Create income entry for W2
        const wagesAmount = parseAmount(extractedData.wages) || 0
        const federalTaxWithheld = parseAmount(extractedData.federalTaxWithheld) || 0
        
        if (wagesAmount > 0) {
          await prisma.incomeEntry.create({
            data: {
              taxReturnId: document.taxReturnId,
              documentId: document.id,
              incomeType: 'W2_WAGES',
              description: `W2 wages from ${extractedData.employerName || 'Employer'}`,
              amount: wagesAmount,
              employerName: String(extractedData.employerName || ''),
              employerEIN: String(extractedData.employerEIN || ''),
              federalTaxWithheld: federalTaxWithheld
            }
          })
        }
        
      } else if (finalDocumentType.startsWith('FORM_1099')) {
        console.log("🔍 [PROCESS] Mapping 1099 data to Form 1040...")
        form1040Mapping = Form1099ToForm1040Mapper.map1099ToForm1040(extractedData)
        
        // Create income entry for 1099
        const incomeAmount = getIncomeAmountFromForm1099(extractedData, finalDocumentType)
        if (incomeAmount > 0) {
          const incomeType = mapDocumentTypeToIncomeType(finalDocumentType)
          
          await prisma.incomeEntry.create({
            data: {
              taxReturnId: document.taxReturnId,
              documentId: document.id,
              incomeType,
              description: `${finalDocumentType} income from ${extractedData.payerName || 'Payer'}`,
              amount: incomeAmount,
              payerName: String(extractedData.payerName || ''),
              payerTIN: String(extractedData.payerTIN || '')
            }
          })
        }
      }

      // Update tax return with mapped data
      if (form1040Mapping) {
        updatedTaxReturnData = {
          firstName: form1040Mapping.firstName || currentTaxReturn.firstName,
          lastName: form1040Mapping.lastName || currentTaxReturn.lastName,
          ssn: form1040Mapping.ssn || currentTaxReturn.ssn,
          address: form1040Mapping.address || currentTaxReturn.address,
          city: form1040Mapping.city || currentTaxReturn.city,
          state: form1040Mapping.state || currentTaxReturn.state,
          zipCode: form1040Mapping.zipCode || currentTaxReturn.zipCode
        }
      }

      console.log("✅ [PROCESS] Form 1040 mapping completed")
    } catch (mappingError: any) {
      console.error("⚠️ [PROCESS] Form 1040 mapping failed:", mappingError)
      // Continue processing even if mapping fails
    }

    console.log("🔍 [PROCESS] Step 12: Tax calculations with state tax integration...")
    let taxCalculationResult = null
    
    try {
      // CRITICAL FIX: Only include income entries from existing documents (not orphaned ones)
      const validIncomeEntries = await prisma.incomeEntry.findMany({
        where: { 
          taxReturnId: document.taxReturnId,
          // Only include entries that have a valid document reference
          documentId: { not: null },
          // Verify the document actually exists
          document: { isNot: null }
        },
        include: {
          document: {
            select: { id: true, processingStatus: true }
          }
        }
      })
      
      console.log(`📊 [PROCESS] Found ${validIncomeEntries.length} valid income entries from existing documents`)
      
      // Cleanup orphaned entries (entries where documentId is null)
      const orphanedEntries = await prisma.incomeEntry.findMany({
        where: { 
          taxReturnId: document.taxReturnId,
          documentId: null
        }
      })
      
      if (orphanedEntries.length > 0) {
        console.log(`🧹 [PROCESS] Cleaning up ${orphanedEntries.length} orphaned income entries`)
        await prisma.incomeEntry.deleteMany({
          where: { 
            taxReturnId: document.taxReturnId,
            documentId: null
          }
        })
      }
      
      const totalIncome = validIncomeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0)
      
      // Get dependents for credit calculations
      const dependents = await prisma.dependent.findMany({
        where: { taxReturnId: document.taxReturnId }
      })

      // Perform enhanced tax calculation with state tax integration
      const taxData = {
        totalIncome,
        filingStatus: document.taxReturn.filingStatus,
        dependents: dependents,
        itemizedDeductions: parseFloat(document.taxReturn.itemizedDeduction.toString()),
        totalWithholdings: parseFloat(document.taxReturn.totalWithholdings.toString()),
        stateCode: detectedStateCode || undefined,
        stateItemizedDeductions: parseFloat(document.taxReturn.stateItemizedDeduction.toString())
      }

      taxCalculationResult = calculateEnhancedTaxReturnWithState(taxData)
      console.log("✅ [PROCESS] Tax calculations completed:", {
        federalTax: taxCalculationResult.taxLiability,
        stateTax: taxCalculationResult.stateTax?.stateTaxLiability || 0,
        totalTax: taxCalculationResult.combinedTaxResult?.totalTaxLiability || taxCalculationResult.taxLiability
      })
      
      // Update tax calculation fields
      updatedTaxReturnData = {
        ...updatedTaxReturnData,
        totalIncome,
        adjustedGrossIncome: taxCalculationResult.adjustedGrossIncome,
        standardDeduction: taxCalculationResult.standardDeduction,
        itemizedDeduction: taxCalculationResult.itemizedDeduction,
        taxableIncome: taxCalculationResult.taxableIncome,
        taxLiability: taxCalculationResult.taxLiability,
        totalCredits: taxCalculationResult.totalCredits,
        totalWithholdings: taxCalculationResult.totalWithholdings,
        refundAmount: taxCalculationResult.refundAmount,
        amountOwed: taxCalculationResult.amountOwed,
        
        // State tax fields
        stateTaxLiability: taxCalculationResult.stateTax?.stateTaxLiability || 0,
        stateStandardDeduction: taxCalculationResult.stateTax?.stateStandardDeduction || 0,
        stateTaxableIncome: taxCalculationResult.stateTax?.stateTaxableIncome || 0,
        stateEffectiveRate: taxCalculationResult.stateTax?.stateEffectiveRate || 0
      }
      
    } catch (calculationError: any) {
      console.error("⚠️ [PROCESS] Tax calculation failed:", calculationError)
      // Continue processing even if tax calculation fails
    }

    console.log("🔍 [PROCESS] Step 13: Database updates and persistence...")
    
    try {
      // Update document with processing results
      const updatedDocument = await prisma.document.update({
        where: { id: document.id },
        data: {
          processingStatus: 'COMPLETED' as ProcessingStatus,
          ocrText: extractedData.fullText || null,
          extractedData: extractedData,
          documentType: finalDocumentType,
          isVerified: false, // Requires manual verification
          updatedAt: new Date()
        }
      })

      // Update tax return with comprehensive data
      let taxReturnUpdateData: any = {
        ...updatedTaxReturnData,
        lastSavedAt: new Date(),
        updatedAt: new Date()
      }

      // Add state detection results if available
      if (stateDetectionResult?.detectedState) {
        const stateSource = mapStateDetectionSourceToEnum(stateDetectionResult.source)
        taxReturnUpdateData = {
          ...taxReturnUpdateData,
          detectedState: stateDetectionResult.detectedState,
          stateConfidence: stateDetectionResult.confidence,
          stateSource,
          state: stateDetectionResult.detectedState // Update personal info state field too
        }
      }

      const updatedTaxReturn = await prisma.taxReturn.update({
        where: { id: document.taxReturnId },
        data: taxReturnUpdateData
      })

      console.log("✅ [PROCESS] Database updates completed successfully")

      console.log("🎉 [PROCESS] Document processing completed successfully!")
      
      // Prepare comprehensive response data
      const responseData = {
        // Document information
        documentId: updatedDocument.id,
        extractedData: updatedDocument.extractedData,
        ocrText: updatedDocument.ocrText,
        processingStatus: updatedDocument.processingStatus,
        documentType: updatedDocument.documentType,
        fileName: updatedDocument.fileName,
        
        // State detection results
        detectedState: updatedTaxReturn.detectedState,
        stateConfidence: updatedTaxReturn.stateConfidence,
        stateSource: updatedTaxReturn.stateSource,
        stateDetectionResult,
        
        // Tax calculation results
        taxCalculations: taxCalculationResult,
        
        // Form 1040 mapping results
        form1040Mapping,
        
        // Duplicate detection results
        duplicateCheck: duplicateCheckResult,
        
        // Processing metadata
        processedAt: new Date(),
        processingTime: Date.now() - new Date(updatedDocument.createdAt).getTime(),
        
        // Validation and next steps
        requiresManualReview: duplicateCheckResult?.isDuplicate || 
                             (stateDetectionResult?.confidence || 0) < 0.8,
        suggestedActions: generateSuggestedActions(
          duplicateCheckResult, 
          stateDetectionResult, 
          taxCalculationResult
        )
      }

      return NextResponse.json(responseData)
      
    } catch (dbError: any) {
      console.error("❌ [PROCESS] Database update failed:", dbError)
      throw new Error(`Database update failed: ${dbError.message}`)
    }
    
  } catch (error: any) {
    console.error("💥 [PROCESS] Document processing error:", error)
    console.error("💥 [PROCESS] Error stack:", error?.stack)

    // Update document status to failed with error details
    try {
      await prisma.document.update({
        where: { id: params.id },
        data: { 
          processingStatus: 'FAILED' as ProcessingStatus,
          updatedAt: new Date()
        }
      })
      console.log("✅ [PROCESS] Document status updated to FAILED")
    } catch (updateError: any) {
      console.error("💥 [PROCESS] Failed to update document status:", updateError)
    }

    // Determine error type for better user experience
    const errorType = categorizeError(error)
    
    // Return appropriate error response based on environment and error type
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        error: "Document processing failed",
        errorType,
        details: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Production error response
    const userFriendlyMessage = getUserFriendlyErrorMessage(errorType)
    return NextResponse.json({
      error: userFriendlyMessage,
      errorType,
      timestamp: new Date().toISOString(),
      supportReference: `PROC-${Date.now()}`
    }, { status: 500 })
  }

}

// Helper function to get income amount from 1099 forms
function getIncomeAmountFromForm1099(extractedData: any, documentType: string): number {
  switch (documentType) {
    case 'FORM_1099_INT':
      return parseAmount(extractedData.interestIncome) || 0
    case 'FORM_1099_DIV':
      return parseAmount(extractedData.ordinaryDividends) || 0
    case 'FORM_1099_MISC':
      return Math.max(
        parseAmount(extractedData.rents) || 0,
        parseAmount(extractedData.royalties) || 0,
        parseAmount(extractedData.otherIncome) || 0,
        parseAmount(extractedData.nonemployeeCompensation) || 0
      )
    case 'FORM_1099_NEC':
      return parseAmount(extractedData.nonemployeeCompensation) || 0
    default:
      return 0
  }
}

// Helper function to map document type to income type
function mapDocumentTypeToIncomeType(documentType: string): IncomeType {
  switch (documentType) {
    case 'FORM_1099_INT':
      return 'INTEREST'
    case 'FORM_1099_DIV':
      return 'DIVIDENDS'
    case 'FORM_1099_MISC':
    case 'FORM_1099_NEC':
      return 'BUSINESS_INCOME'
    default:
      return 'OTHER_INCOME'
  }
}

// Helper function to parse amount values
function parseAmount(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Helper function to map state detection source to enum
function mapStateDetectionSourceToEnum(source: string): 'ADDRESS' | 'EMPLOYER' | 'DOCUMENT_TYPE' | 'MANUAL' | 'UNKNOWN' {
  switch (source) {
    case 'address': return 'ADDRESS'
    case 'employer': return 'EMPLOYER'
    case 'document_type': return 'DOCUMENT_TYPE'
    case 'manual': return 'MANUAL'
    default: return 'UNKNOWN'
  }
}

// Helper function to generate suggested actions
function generateSuggestedActions(
  duplicateResult: any, 
  stateResult: any, 
  taxResult: any
): string[] {
  const actions = []
  
  if (duplicateResult?.isDuplicate) {
    actions.push("Review potential duplicate documents before proceeding")
  }
  
  if ((stateResult?.confidence || 0) < 0.8) {
    actions.push("Verify state information for accurate tax calculations")
  }
  
  if (taxResult?.taxOptimizationSuggestions?.length > 0) {
    actions.push("Review tax optimization suggestions to maximize savings")
  }
  
  if (actions.length === 0) {
    actions.push("Document processed successfully - review extracted data")
  }
  
  return actions
}

// Helper function to categorize errors
function categorizeError(error: any): string {
  const message = error?.message?.toLowerCase() || ''
  
  if (message.includes('azure') || message.includes('document intelligence')) {
    return 'EXTRACTION_ERROR'
  }
  if (message.includes('database') || message.includes('prisma')) {
    return 'DATABASE_ERROR'
  }
  if (message.includes('state detection')) {
    return 'STATE_DETECTION_ERROR'
  }
  if (message.includes('duplicate')) {
    return 'DUPLICATE_DETECTION_ERROR'
  }
  if (message.includes('tax calculation')) {
    return 'CALCULATION_ERROR'
  }
  if (message.includes('mapping')) {
    return 'MAPPING_ERROR'
  }
  if (message.includes('authentication') || message.includes('unauthorized')) {
    return 'AUTH_ERROR'
  }
  
  return 'UNKNOWN_ERROR'
}

// Helper function to get user-friendly error messages
function getUserFriendlyErrorMessage(errorType: string): string {
  switch (errorType) {
    case 'EXTRACTION_ERROR':
      return 'Unable to extract data from document. Please ensure the document is clear and try again.'
    case 'DATABASE_ERROR':
      return 'Database error occurred. Please try again later.'
    case 'STATE_DETECTION_ERROR':
      return 'State detection failed. You may need to manually enter your state information.'
    case 'DUPLICATE_DETECTION_ERROR':
      return 'Error checking for duplicate documents. Processing continued successfully.'
    case 'CALCULATION_ERROR':
      return 'Tax calculation error occurred. Please review your information.'
    case 'MAPPING_ERROR':
      return 'Error mapping document data. Some fields may need manual entry.'
    case 'AUTH_ERROR':
      return 'Authentication error. Please log in again.'
    default:
      return 'Document processing failed. Please try again or contact support.'
  }
}
