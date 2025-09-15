

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Eye, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RefreshCw,
  FolderOpen
} from "lucide-react"

interface DocumentManagementProps {
  taxReturnId: string
  onDocumentProcessed?: (extractedData: any) => void
}

interface Document {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  documentType: string
  processingStatus: string
  isVerified: boolean
  ocrText?: string
  extractedData?: any
  createdAt: string
  updatedAt: string
}

export function DocumentManagement({ taxReturnId, onDocumentProcessed }: DocumentManagementProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const fetchDocuments = useCallback(async (retryCount = 0) => {
    try {
      console.log('🔍 Fetching documents for taxReturnId:', taxReturnId, `(attempt ${retryCount + 1})`)
      const response = await fetch(`/api/tax-returns/${taxReturnId}/documents`)
      if (response.ok) {
        const data = await response.json()
        console.log('📄 Documents fetched:', data.length, 'documents')
        
        // Log status changes for debugging
        const processingDocs = data.filter((doc: Document) => doc.processingStatus === 'PROCESSING')
        const completedDocs = data.filter((doc: Document) => doc.processingStatus === 'COMPLETED')
        console.log('📊 Document status:', { 
          processing: processingDocs.length, 
          completed: completedDocs.length,
          total: data.length 
        })
        
        // State preservation strategy: Only update if we get valid data OR this is the first successful fetch
        if (data.length > 0 || documents.length === 0 || retryCount === 0) {
          setDocuments(data)
        } else if (data.length === 0 && documents.length > 0) {
          // If API returns empty array but we had documents before, this might be a temporary issue
          // Keep existing documents to prevent UI flashing - ACTUALLY preserve state by returning early
          console.warn('⚠️ API returned empty documents array, preserving existing documents to prevent UI flashing')
          return // EXIT EARLY to preserve existing state
        }
        
        // Trigger callback for processed documents
        if (onDocumentProcessed && completedDocs.length > 0) {
          completedDocs.forEach((doc: Document) => {
            if (doc.extractedData) {
              onDocumentProcessed(doc.extractedData)
            }
          })
        }
      } else {
        console.error('❌ Failed to fetch documents:', response.status, response.statusText)
        // Only retry a few times to avoid infinite loops
        if (retryCount < 3) {
          console.log('🔄 Retrying fetch in 5 seconds...', `(retry ${retryCount + 1}/3)`)
          setTimeout(() => fetchDocuments(retryCount + 1), 5000)
        } else {
          console.error('❌ Max retries reached for fetching documents')
        }
      }
    } catch (error) {
      console.error("❌ Error fetching documents:", error)
      // Only retry a few times to avoid infinite loops  
      if (retryCount < 3) {
        console.log('🔄 Retrying fetch due to error in 5 seconds...', `(retry ${retryCount + 1}/3)`)
        setTimeout(() => fetchDocuments(retryCount + 1), 5000)
      } else {
        console.error('❌ Max retries reached for fetching documents due to error')
      }
    } finally {
      // Only set loading to false on the first attempt
      if (retryCount === 0) {
        setLoading(false)
      }
    }
  }, [taxReturnId, onDocumentProcessed, documents.length])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Enhanced polling logic - more robust with better error handling and longer duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    let pollStartTime = Date.now()
    const maxPollDuration = 12 * 60 * 1000 // 12 minutes max polling - extended for very complex Azure DI processing
    
    const startPolling = () => {
      if (interval) clearInterval(interval)
      
      interval = setInterval(async () => {
        try {
          // Check if we've been polling too long
          const pollDurationMs = Date.now() - pollStartTime
          if (pollDurationMs > maxPollDuration) {
            const pollDurationMinutes = Math.round(pollDurationMs / 60000)
            console.log(`🛑 Stopping polling after max duration reached (${pollDurationMinutes} minutes)`)
            if (interval) {
              clearInterval(interval)
              interval = null
            }
            return
          }
          
          // More generous polling criteria - continue if processing docs, recent docs, or during initial load
          const hasProcessingDocs = documents.some(doc => doc.processingStatus === 'PROCESSING')
          const hasRecentDocs = documents.some(doc => {
            const updatedTime = new Date(doc.updatedAt).getTime()
            const now = new Date().getTime()
            return (now - updatedTime) < 180000 // 3 minutes for better coverage - further extended
          })
          
          // Only continue polling for empty state during initial load phase (first 2 minutes)
          // This prevents infinite polling when legitimately no documents exist
          const isInitialLoadPhase = (Date.now() - pollStartTime) < 120000 // 2 minutes
          const shouldPollForEmptyState = documents.length === 0 && isInitialLoadPhase
          
          const shouldContinuePolling = hasProcessingDocs || hasRecentDocs || shouldPollForEmptyState
          
          const pollDurationSeconds = Math.round((Date.now() - pollStartTime) / 1000)
          console.log('🔄 Polling check:', { 
            hasProcessingDocs, 
            hasRecentDocs,
            shouldPollForEmptyState,
            documentsCount: documents.length,
            shouldContinuePolling,
            pollDuration: `${Math.floor(pollDurationSeconds / 60)}m ${pollDurationSeconds % 60}s`,
            timestamp: new Date().toISOString()
          })
          
          if (shouldContinuePolling) {
            console.log('📡 Fetching documents due to active processing or recent activity...')
            await fetchDocuments()
          } else {
            // No need to poll anymore, all documents are in final states
            console.log('✅ Stopping polling - all documents in stable state')
            
            // Final state validation: Check if we have any documents that are genuinely failed
            const failedDocs = documents.filter(doc => doc.processingStatus === 'FAILED')
            if (failedDocs.length > 0) {
              console.warn('⚠️ Some documents failed processing:', failedDocs.map(doc => doc.id))
            }
            
            if (interval) {
              clearInterval(interval)
              interval = null
            }
          }
        } catch (error) {
          console.error('❌ Polling error:', error)
          // Don't stop polling on error, just log it and continue - this ensures robustness
        }
      }, 3000) // Poll every 3 seconds for stable updates
    }

    // More lenient criteria for starting polling - extended timeframes
    const hasProcessingDocs = documents.some(doc => doc.processingStatus === 'PROCESSING')
    const hasRecentActivity = documents.some(doc => {
      const updatedTime = new Date(doc.updatedAt).getTime()
      const now = new Date().getTime()
      return (now - updatedTime) < 120000 // 2 minutes - further extended for better coverage
    })
    
    // Start polling if we have processing docs, recent activity, or initial empty state
    const shouldStartPolling = hasProcessingDocs || hasRecentActivity || (documents.length === 0 && loading)
    
    if (shouldStartPolling) {
      console.log('🚀 Starting document polling...', { 
        hasProcessingDocs, 
        hasRecentActivity, 
        documentsLength: documents.length,
        isInitialLoad: loading,
        maxPollDurationMinutes: Math.round(maxPollDuration / 60000)
      })
      pollStartTime = Date.now()
      startPolling()
    }

    return () => {
      console.log('🛑 Cleaning up polling interval')
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
  }, [documents.length, documents.map(doc => `${doc.id}-${doc.processingStatus}-${doc.updatedAt}`).join('|'), fetchDocuments])

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId))
        if (selectedDocument?.id === documentId) {
          setSelectedDocument(null)
        }
      }
    } catch (error) {
      console.error("Error deleting document:", error)
    }
  }

  const handleReprocessDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchDocuments() // Refresh the documents list
      }
    } catch (error) {
      console.error("Error reprocessing document:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Processing</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'PENDING':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getDocumentTypeLabel = (documentType: string) => {
    const labels: Record<string, string> = {
      'W2': 'W-2 Form',
      'FORM_1099_INT': '1099-INT Form',
      'FORM_1099_DIV': '1099-DIV Form',
      'FORM_1099_MISC': '1099-MISC Form',
      'FORM_1099_NEC': '1099-NEC Form',
      'FORM_1099_R': '1099-R Form',
      'FORM_1099_G': '1099-G Form',
      'OTHER_TAX_DOCUMENT': 'Other Tax Document'
    }
    return labels[documentType] || documentType
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5" />
            <span>Document Management</span>
          </CardTitle>
          <CardDescription>
            View and manage all uploaded tax documents and their processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No documents uploaded yet</p>
              <p className="text-sm text-gray-400">Upload your tax documents to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedDocument?.id === document.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDocument(document)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{document.fileName}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getDocumentTypeLabel(document.documentType)}
                          </Badge>
                          {getStatusBadge(document.processingStatus)}
                          {document.isVerified && (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{formatFileSize(document.fileSize)}</span>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDocument(document)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {document.processingStatus === 'FAILED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReprocessDocument(document.id)
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteDocument(document.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocument && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{selectedDocument.fileName}</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(selectedDocument.processingStatus)}
                <Badge variant="outline">
                  {getDocumentTypeLabel(selectedDocument.documentType)}
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Document details and extracted information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">File Type</p>
                  <p className="text-gray-600">{selectedDocument.fileType}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">File Size</p>
                  <p className="text-gray-600">{formatFileSize(selectedDocument.fileSize)}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Uploaded</p>
                  <p className="text-gray-600">{new Date(selectedDocument.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Last Updated</p>
                  <p className="text-gray-600">{new Date(selectedDocument.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedDocument.processingStatus === 'COMPLETED' && selectedDocument.extractedData && (
                <Tabs defaultValue="extracted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                    <TabsTrigger value="ocr">OCR Text</TabsTrigger>
                  </TabsList>
                  <TabsContent value="extracted" className="mt-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedDocument.extractedData, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="ocr" className="mt-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm font-mono whitespace-pre-wrap">
                        {selectedDocument.ocrText || 'No OCR text available'}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {selectedDocument.processingStatus === 'FAILED' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Document processing failed. You can try reprocessing it or upload a different version.
                  </AlertDescription>
                </Alert>
              )}

              {selectedDocument.processingStatus === 'PROCESSING' && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Document is currently being processed. This may take a few moments.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

