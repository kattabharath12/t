

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log("🔍 [STREAM] Starting document status stream for ID:", params.id)
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      console.log("❌ [STREAM] No session found")
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.log("❌ [STREAM] User not found")
      return new NextResponse("User not found", { status: 404 })
    }

    // Verify document access
    const document = await prisma.document.findFirst({
      where: { 
        id: params.id,
        taxReturn: { userId: user.id }
      },
      include: {
        taxReturn: true
      }
    })

    if (!document) {
      console.log("❌ [STREAM] Document not found or access denied")
      return new NextResponse("Document not found", { status: 404 })
    }

    console.log("✅ [STREAM] Document access verified:", document.id)

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        console.log("🚀 [STREAM] Starting status stream")
        
        const encoder = new TextEncoder()
        let pollCount = 0
        const maxPolls = 300 // 10 minutes maximum (2-second intervals)
        
        const sendUpdate = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        const pollDocument = async () => {
          try {
            const currentDoc = await prisma.document.findUnique({
              where: { id: params.id },
              include: {
                taxReturn: {
                  include: {
                    documents: {
                      where: {
                        processingStatus: 'COMPLETED'
                      }
                    }
                  }
                }
              }
            })

            if (!currentDoc) {
              sendUpdate({
                type: 'error',
                message: 'Document not found',
                timestamp: new Date().toISOString()
              })
              controller.close()
              return
            }

            console.log(`📡 [STREAM] Poll ${pollCount + 1}: Status = ${currentDoc.processingStatus}`)

            const updateData: any = {
              type: 'status_update',
              documentId: currentDoc.id,
              status: currentDoc.processingStatus,
              fileName: currentDoc.fileName,
              documentType: currentDoc.documentType,
              pollCount: pollCount + 1,
              timestamp: new Date().toISOString(),
              hasExtractedData: !!currentDoc.extractedData,
              hasOcrText: !!currentDoc.ocrText,
              isVerified: currentDoc.isVerified,
              updatedAt: currentDoc.updatedAt
            }

            // Include OCR and extracted data for transparency
            if (currentDoc.processingStatus === 'COMPLETED') {
              updateData.ocrText = currentDoc.ocrText
              updateData.extractedData = currentDoc.extractedData
              
              // Include processing stages for transparency
              updateData.processingStages = {
                upload: { completed: true, timestamp: currentDoc.createdAt },
                extraction: { completed: true, timestamp: currentDoc.updatedAt },
                processing: { completed: true, timestamp: currentDoc.updatedAt },
                complete: { completed: true, timestamp: currentDoc.updatedAt }
              }
              
              console.log("✅ [STREAM] Document processing completed, sending final update")
              sendUpdate(updateData)
              
              // Send completion event
              sendUpdate({
                type: 'completed',
                message: 'Document processing completed successfully',
                timestamp: new Date().toISOString()
              })
              
              controller.close()
              return
            } else if (currentDoc.processingStatus === 'FAILED') {
              console.log("❌ [STREAM] Document processing failed")
              sendUpdate({
                type: 'error',
                message: 'Document processing failed',
                documentId: currentDoc.id,
                timestamp: new Date().toISOString()
              })
              controller.close()
              return
            } else if (currentDoc.processingStatus === 'PROCESSING') {
              // Calculate processing progress based on elapsed time
              const processingStarted = new Date(currentDoc.updatedAt).getTime()
              const elapsed = Date.now() - processingStarted
              const estimatedDuration = 5 * 60 * 1000 // 5 minutes estimate
              const progress = Math.min(95, Math.floor((elapsed / estimatedDuration) * 100))
              
              updateData.progress = progress
              updateData.elapsedTime = elapsed
              updateData.processingStages = {
                upload: { completed: true, timestamp: currentDoc.createdAt },
                extraction: { 
                  completed: false, 
                  inProgress: true, 
                  message: 'Extracting text and analyzing document structure...' 
                },
                processing: { completed: false },
                complete: { completed: false }
              }
              
              // Provide more detailed progress messages
              if (elapsed < 60000) { // < 1 minute
                updateData.message = 'Starting document analysis with Azure AI...'
              } else if (elapsed < 180000) { // < 3 minutes
                updateData.message = 'Extracting text and identifying form fields...'
              } else if (elapsed < 300000) { // < 5 minutes
                updateData.message = 'Processing tax information and validating data...'
              } else {
                updateData.message = 'Finalizing extraction and performing quality checks...'
              }
              
              sendUpdate(updateData)
            } else {
              // PENDING status
              updateData.processingStages = {
                upload: { completed: true, timestamp: currentDoc.createdAt },
                extraction: { completed: false },
                processing: { completed: false },
                complete: { completed: false }
              }
              
              sendUpdate(updateData)
            }

            pollCount++
            
            // Continue polling if not at maximum
            if (pollCount < maxPolls && 
                currentDoc.processingStatus as string !== 'COMPLETED' && 
                currentDoc.processingStatus as string !== 'FAILED') {
              
              setTimeout(pollDocument, 2000) // Poll every 2 seconds
            } else if (pollCount >= maxPolls) {
              console.warn("⚠️ [STREAM] Maximum polling duration reached")
              sendUpdate({
                type: 'timeout',
                message: 'Processing is taking longer than expected. Please refresh the page to check status.',
                timestamp: new Date().toISOString()
              })
              controller.close()
            }
            
          } catch (error) {
            console.error("❌ [STREAM] Polling error:", error)
            sendUpdate({
              type: 'error',
              message: 'Error checking document status',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
            
            // Retry a few times before giving up
            if (pollCount < 10) {
              setTimeout(pollDocument, 5000) // Wait longer on error
            } else {
              controller.close()
            }
          }
        }

        // Send initial status immediately
        console.log("📡 [STREAM] Sending initial status")
        sendUpdate({
          type: 'connected',
          message: 'Status stream connected',
          documentId: document.id,
          initialStatus: document.processingStatus,
          timestamp: new Date().toISOString()
        })

        // Start polling
        pollDocument()
      },
      
      cancel() {
        console.log("🛑 [STREAM] Status stream cancelled by client")
      }
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    })
    
  } catch (error) {
    console.error("💥 [STREAM] Status stream error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

