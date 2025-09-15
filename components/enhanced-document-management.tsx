

"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
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
  FolderOpen,
  Wifi,
  WifiOff,
  Activity,
  Loader2
} from "lucide-react"

interface EnhancedDocumentManagementProps {
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
  realTimeConnection?: EventSource | null
  lastStatusUpdate?: string
}

export function EnhancedDocumentManagement({ taxReturnId, onDocumentProcessed }: EnhancedDocumentManagementProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [realTimeConnections, setRealTimeConnections] = useState<{[key: string]: EventSource}>({})
  
  const connectionRefs = useRef<{[key: string]: EventSource}>({})

  const fetchDocuments = async () => {
    try {
      console.log('🔍 [Enhanced Doc Mgmt] Fetching documents for taxReturnId:', taxReturnId)
      const response = await fetch(`/api/tax-returns/${taxReturnId}/documents`)
      if (response.ok) {
        const data = await response.json()
        console.log('📄 [Enhanced Doc Mgmt] Documents fetched:', data.length, 'documents')
        
        // Update documents and start real-time monitoring for processing documents
        setDocuments(prevDocs => {
          const updatedDocs = data.map((doc: Document) => {
            const existingDoc = prevDocs.find(d => d.id === doc.id)
            return {
              ...doc,
              realTimeConnection: existingDoc?.realTimeConnection || null,
              lastStatusUpdate: existingDoc?.lastStatusUpdate || new Date().toISOString()
            }
          })
          
          // Start real-time monitoring for documents that are processing
          updatedDocs.forEach((doc: Document) => {
            if (doc.processingStatus === 'PROCESSING' && !connectionRefs.current[doc.id]) {
              startRealTimeMonitoring(doc.id)
            }
          })
          
          return updatedDocs
        })
        
        // Trigger callback for processed documents
        if (onDocumentProcessed) {
          const completedDocs = data.filter((doc: Document) => doc.processingStatus === 'COMPLETED')
          completedDocs.forEach((doc: Document) => {
            if (doc.extractedData) {
              onDocumentProcessed(doc.extractedData)
            }
          })
        }
      } else {
        console.error('❌ [Enhanced Doc Mgmt] Failed to fetch documents:', response.status)
      }
    } catch (error) {
      console.error("❌ [Enhanced Doc Mgmt] Error fetching documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const startRealTimeMonitoring = (documentId: string) => {
    if (connectionRefs.current[documentId]) {
      console.log(`🔄 [RT Monitor] Connection already exists for document ${documentId}`)
      return
    }

    console.log(`🚀 [RT Monitor] Starting real-time monitoring for document ${documentId}`)
    
    const eventSource = new EventSource(`/api/documents/${documentId}/status-stream`)
    connectionRefs.current[documentId] = eventSource
    
    // Update document with connection info
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId 
        ? { ...doc, realTimeConnection: eventSource, lastStatusUpdate: new Date().toISOString() }
        : doc
    ))

    eventSource.onopen = () => {
      console.log(`✅ [RT Monitor] Connected to status stream for document ${documentId}`)
      setRealTimeConnections(prev => ({ ...prev, [documentId]: eventSource }))
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`📡 [RT Monitor] Received update for document ${documentId}:`, data.type, data.status)

        setDocuments(prev => prev.map(doc => {
          if (doc.id === documentId) {
            let updatedDoc = { 
              ...doc, 
              lastStatusUpdate: new Date().toISOString() 
            }

            switch (data.type) {
              case 'status_update':
                updatedDoc = {
                  ...updatedDoc,
                  processingStatus: data.status,
                  updatedAt: data.updatedAt || updatedDoc.updatedAt,
                  extractedData: data.extractedData || updatedDoc.extractedData,
                  ocrText: data.ocrText || updatedDoc.ocrText
                }
                break
              
              case 'completed':
                updatedDoc = {
                  ...updatedDoc,
                  processingStatus: 'COMPLETED'
                }
                
                // Clean up connection
                eventSource.close()
                delete connectionRefs.current[documentId]
                setRealTimeConnections(prev => {
                  const updated = { ...prev }
                  delete updated[documentId]
                  return updated
                })
                break

              case 'error':
                updatedDoc = {
                  ...updatedDoc,
                  processingStatus: 'FAILED'
                }
                
                // Clean up connection
                eventSource.close()
                delete connectionRefs.current[documentId]
                setRealTimeConnections(prev => {
                  const updated = { ...prev }
                  delete updated[documentId]
                  return updated
                })
                break
            }

            return updatedDoc
          }
          return doc
        }))

      } catch (parseError) {
        console.error('Failed to parse SSE data:', parseError)
      }
    }

    eventSource.onerror = (error) => {
      console.error(`💥 [RT Monitor] EventSource error for document ${documentId}:`, error)
      
      // Clean up connection
      eventSource.close()
      delete connectionRefs.current[documentId]
      setRealTimeConnections(prev => {
        const updated = { ...prev }
        delete updated[documentId]
        return updated
      })
      
      // Update document to show connection lost
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, realTimeConnection: null, lastStatusUpdate: new Date().toISOString() }
          : doc
      ))
    }
  }

  const cleanupConnections = () => {
    Object.values(connectionRefs.current).forEach(eventSource => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close()
      }
    })
    connectionRefs.current = {}
    setRealTimeConnections({})
  }

  useEffect(() => {
    fetchDocuments()
    return cleanupConnections
  }, [taxReturnId])

  const handleDeleteDocument = async (documentId: string) => {
    try {
      // Close real-time connection if exists
      const connection = connectionRefs.current[documentId]
      if (connection) {
        connection.close()
        delete connectionRefs.current[documentId]
      }

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
        // Start real-time monitoring for reprocessing
        startRealTimeMonitoring(documentId)
        fetchDocuments() // Refresh the documents list
      }
    } catch (error) {
      console.error("Error reprocessing document:", error)
    }
  }

  const getStatusBadge = (document: Document) => {
    const hasRealTimeConnection = !!realTimeConnections[document.id]
    
    switch (document.processingStatus) {
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'PROCESSING':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
            {hasRealTimeConnection && <Wifi className="h-3 w-3 ml-1" />}
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="secondary">{document.processingStatus}</Badge>
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
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const activeConnections = Object.keys(realTimeConnections).length
  const processingDocuments = documents.filter(doc => doc.processingStatus === 'PROCESSING').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-5 w-5" />
              <span>Enhanced Document Management</span>
            </div>
            <div className="flex items-center space-x-2">
              {activeConnections > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Activity className="h-3 w-3 mr-1" />
                  {activeConnections} Live
                </Badge>
              )}
              {processingDocuments > 0 && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {processingDocuments} Processing
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            View and manage all uploaded tax documents with real-time processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No documents uploaded yet</p>
              <p className="text-sm text-gray-400">Upload your tax documents to get started with real-time processing</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => {
                const hasRealTimeConnection = !!realTimeConnections[document.id]
                return (
                  <div
                    key={document.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedDocument?.id === document.id
                        ? 'border-primary bg-primary/5'
                        : hasRealTimeConnection
                        ? 'border-blue-300 bg-blue-50/50'
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
                            {getStatusBadge(document)}
                            {document.isVerified && (
                              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            {hasRealTimeConnection && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                <Wifi className="h-3 w-3 mr-1" />
                                Live
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
                )
              })}
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
                {getStatusBadge(selectedDocument)}
                <Badge variant="outline">
                  {getDocumentTypeLabel(selectedDocument.documentType)}
                </Badge>
                {realTimeConnections[selectedDocument.id] && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Wifi className="h-3 w-3 mr-1" />
                    Real-time Updates
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Document details and extracted information with real-time processing visibility
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
                  <div className="flex items-center space-x-1">
                    <p className="text-gray-600">{new Date(selectedDocument.updatedAt).toLocaleDateString()}</p>
                    {realTimeConnections[selectedDocument.id] && (
                      <Activity className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Real-time Processing Status */}
              {selectedDocument.processingStatus === 'PROCESSING' && (
                <Alert className="border-blue-200 bg-blue-50">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="flex items-center justify-between">
                      <span>Document is being processed with Azure AI...</span>
                      {realTimeConnections[selectedDocument.id] ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Wifi className="h-3 w-3 mr-1" />
                          Live Updates
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          <WifiOff className="h-3 w-3 mr-1" />
                          Offline Mode
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      OCR extraction and data analysis in progress. Updates will appear automatically.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {selectedDocument.processingStatus === 'COMPLETED' && selectedDocument.extractedData && (
                <Tabs defaultValue="extracted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                    <TabsTrigger value="ocr">OCR Text</TabsTrigger>
                  </TabsList>
                  <TabsContent value="extracted" className="mt-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-700 mb-3">Successfully Extracted:</h4>
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedDocument.extractedData, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="ocr" className="mt-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-700 mb-3">Raw OCR Text:</h4>
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
                    {realTimeConnections[selectedDocument.id] && (
                      <div className="mt-2 text-sm">
                        Real-time monitoring was active during processing.
                      </div>
                    )}
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

