

"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileUpload, FileUploadProgress } from "@/components/ui/file-upload"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  FileText, 
  Eye, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Plus, 
  Clock, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react"
import { DuplicateWarningDialog } from "@/components/duplicate-warning-dialog"

interface DocumentRealTimeProcessorProps {
  taxReturnId: string
  onDocumentProcessed: (extractedData: any) => void
  onDocumentUploaded?: (document: any) => void
  onUploadMoreRequested?: () => void
}

interface ProcessingState {
  files: File[]
  processedDocuments: ProcessedDocument[]
  currentlyProcessing: number | null
  progress: number
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  message: string
}

interface ProcessedDocument {
  file: File
  document: any | null
  extractedData: any | null
  ocrText?: string | null
  status: 'pending' | 'uploading' | 'processing' | 'extraction' | 'completed' | 'error' | 'duplicate_warning'
  message: string
  progress: number
  duplicateDetection?: any
  processingStages?: {
    [key: string]: { 
      completed: boolean; 
      inProgress?: boolean; 
      message?: string; 
      timestamp?: string 
    }
  }
  streamConnection?: EventSource | null
  realTimeUpdates?: boolean
}

export function DocumentRealTimeProcessor({ 
  taxReturnId, 
  onDocumentProcessed, 
  onDocumentUploaded,
  onUploadMoreRequested
}: DocumentRealTimeProcessorProps) {
  const [state, setState] = useState<ProcessingState>({
    files: [],
    processedDocuments: [],
    currentlyProcessing: null,
    progress: 0,
    status: 'idle',
    message: ''
  })

  const [duplicateWarning, setDuplicateWarning] = useState<{
    open: boolean;
    documentIndex: number | null;
    documentData: any;
  }>({
    open: false,
    documentIndex: null,
    documentData: null
  })

  const eventSourceRefs = useRef<{ [key: number]: EventSource }>({})

  // Cleanup function to close all EventSource connections
  const cleanupConnections = () => {
    Object.values(eventSourceRefs.current).forEach(eventSource => {
      if (eventSource?.readyState !== EventSource.CLOSED) {
        eventSource.close()
      }
    })
    eventSourceRefs.current = {}
  }

  // Cleanup on unmount
  useEffect(() => {
    return cleanupConnections
  }, [])

  const handleDuplicateAction = async (action: 'proceed' | 'cancel' | 'replace', replacementDocumentId?: string) => {
    if (duplicateWarning.documentIndex === null || !duplicateWarning.documentData) return;

    const index = duplicateWarning.documentIndex;
    const document = duplicateWarning.documentData.document;

    const updateDocumentState = (updates: Partial<ProcessedDocument>) => {
      setState(prev => ({
        ...prev,
        processedDocuments: prev.processedDocuments.map((doc, i) => 
          i === index ? { ...doc, ...updates } : doc
        )
      }))
    }

    try {
      updateDocumentState({ 
        status: 'processing', 
        message: 'Processing duplicate action...' 
      })

      const response = await fetch(`/api/documents/${document.id}/duplicate-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          replacementDocumentId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to process duplicate action')
      }

      const result = await response.json()
      
      if (action === 'cancel') {
        updateDocumentState({
          status: 'error',
          message: 'Import cancelled due to duplicate warning'
        })
      } else {
        // For 'proceed' or 'replace', complete the document processing
        updateDocumentState({
          status: 'completed',
          progress: 100,
          message: action === 'replace' ? 'Document replaced successfully' : 'Document imported despite duplicate warning',
          extractedData: duplicateWarning.documentData.extractedData
        })
        onDocumentProcessed(duplicateWarning.documentData.extractedData)
      }

      // Close the dialog
      setDuplicateWarning({
        open: false,
        documentIndex: null,
        documentData: null
      })

    } catch (error) {
      console.error('Error handling duplicate action:', error)
      updateDocumentState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to process duplicate action'
      })
    }
  }

  const handleFileSelect = (file: File) => {
    setState(prev => ({
      ...prev,
      files: [...prev.files, file],
      status: 'idle',
      message: 'Files selected for upload'
    }))
  }

  const handleFileRemove = (index?: number) => {
    if (index !== undefined) {
      // Remove specific file
      setState(prev => ({
        ...prev,
        files: prev.files.filter((_, i) => i !== index)
      }))
    } else {
      // Remove all files and cleanup connections
      cleanupConnections()
      setState(prev => ({
        ...prev,
        files: [],
        processedDocuments: [],
        currentlyProcessing: null,
        status: 'idle',
        message: ''
      }))
    }
  }

  const handleRemoveProcessedDocument = (index: number) => {
    // Close EventSource connection for this document
    const eventSource = eventSourceRefs.current[index]
    if (eventSource?.readyState !== EventSource.CLOSED) {
      eventSource.close()
    }
    delete eventSourceRefs.current[index]

    setState(prev => ({
      ...prev,
      processedDocuments: prev.processedDocuments.filter((_, i) => i !== index)
    }))
  }

  const processAllDocuments = async () => {
    if (state.files.length === 0) return

    setState(prev => ({ ...prev, status: 'processing', message: 'Starting document processing...' }))

    // Initialize processed documents array
    const initialProcessedDocs: ProcessedDocument[] = state.files.map(file => ({
      file,
      document: null,
      extractedData: null,
      ocrText: null,
      status: 'pending',
      message: 'Waiting to process...',
      progress: 0,
      realTimeUpdates: true,
      streamConnection: null
    }))

    setState(prev => ({ 
      ...prev, 
      processedDocuments: initialProcessedDocs,
      files: [] // Clear the pending files queue
    }))

    // Process documents one by one
    for (let i = 0; i < initialProcessedDocs.length; i++) {
      await processSingleDocument(i, initialProcessedDocs[i].file)
    }

    setState(prev => ({ 
      ...prev, 
      status: 'completed',
      currentlyProcessing: null,
      message: 'All documents processed successfully!'
    }))
  }

  const processSingleDocument = async (index: number, file: File) => {
    setState(prev => ({ 
      ...prev, 
      currentlyProcessing: index,
      message: `Processing document ${index + 1} of ${prev.processedDocuments.length}...`
    }))

    const updateDocumentState = (updates: Partial<ProcessedDocument>) => {
      setState(prev => ({
        ...prev,
        processedDocuments: prev.processedDocuments.map((doc, i) => 
          i === index ? { ...doc, ...updates } : doc
        )
      }))
    }

    try {
      // Upload phase
      updateDocumentState({ 
        status: 'uploading', 
        message: 'Uploading document...', 
        progress: 10,
        processingStages: {
          upload: { completed: false },
          extraction: { completed: false },
          processing: { completed: false },
          complete: { completed: false }
        }
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('taxReturnId', taxReturnId)

      updateDocumentState({ progress: 30, message: 'Uploading to server...' })

      const uploadResponse = await fetch(`/api/documents/upload`, {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Failed to upload document: ${errorData.error || 'Server error'}`)
      }

      const document = await uploadResponse.json()
      updateDocumentState({ 
        document,
        status: 'processing',
        progress: 50,
        message: 'Document uploaded successfully. Starting real-time processing...',
        processingStages: {
          upload: { completed: true, timestamp: new Date().toISOString() },
          extraction: { completed: false },
          processing: { completed: false },
          complete: { completed: false }
        }
      })

      onDocumentUploaded?.(document)

      // Start real-time status monitoring using Server-Sent Events
      await startRealTimeMonitoring(index, document.id, updateDocumentState)

    } catch (error) {
      console.error('Document processing error:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during processing'
      
      updateDocumentState({
        status: 'error',
        progress: 0,
        message: errorMessage
      })
    }
  }

  const startRealTimeMonitoring = (
    index: number, 
    documentId: string, 
    updateDocumentState: (updates: Partial<ProcessedDocument>) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log(`🔄 [RTM] Starting real-time monitoring for document ${documentId}`)
      
      // Close any existing connection for this index
      if (eventSourceRefs.current[index]?.readyState !== EventSource.CLOSED) {
        eventSourceRefs.current[index].close()
      }

      const eventSource = new EventSource(`/api/documents/${documentId}/status-stream`)
      eventSourceRefs.current[index] = eventSource
      
      updateDocumentState({
        streamConnection: eventSource,
        realTimeUpdates: true
      })

      eventSource.onopen = () => {
        console.log(`✅ [RTM] Connected to status stream for document ${documentId}`)
        updateDocumentState({
          message: 'Connected to real-time updates...',
          processingStages: {
            upload: { completed: true, timestamp: new Date().toISOString() },
            extraction: { completed: false, inProgress: true, message: 'Connecting to processing stream...' },
            processing: { completed: false },
            complete: { completed: false }
          }
        })
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log(`📡 [RTM] Received update for document ${documentId}:`, data.type, data.status)

          switch (data.type) {
            case 'connected':
              updateDocumentState({
                message: 'Real-time monitoring connected',
                progress: 55
              })
              break

            case 'status_update':
              let statusUpdate: Partial<ProcessedDocument> = {
                progress: data.progress || 60,
                message: data.message || `Status: ${data.status}`,
                processingStages: data.processingStages
              }

              if (data.status === 'PROCESSING') {
                statusUpdate = {
                  ...statusUpdate,
                  status: 'extraction',
                  message: data.message || 'Extracting and analyzing document...'
                }
              } else if (data.status === 'COMPLETED') {
                statusUpdate = {
                  ...statusUpdate,
                  status: 'completed',
                  progress: 100,
                  message: 'Document processing completed!',
                  extractedData: data.extractedData,
                  ocrText: data.ocrText
                }
                
                // Trigger callback for processed document
                if (data.extractedData) {
                  onDocumentProcessed(data.extractedData)
                }
              }

              updateDocumentState(statusUpdate)
              break

            case 'completed':
              console.log(`✅ [RTM] Document ${documentId} processing completed`)
              updateDocumentState({
                status: 'completed',
                progress: 100,
                message: 'Processing completed successfully!'
              })
              eventSource.close()
              resolve()
              break

            case 'error':
              console.error(`❌ [RTM] Error for document ${documentId}:`, data.message)
              updateDocumentState({
                status: 'error',
                progress: 0,
                message: data.message || 'Processing failed',
                realTimeUpdates: false
              })
              eventSource.close()
              reject(new Error(data.message || 'Processing failed'))
              break

            case 'timeout':
              console.warn(`⚠️ [RTM] Timeout for document ${documentId}`)
              updateDocumentState({
                status: 'error',
                progress: 90,
                message: data.message || 'Processing timeout - please refresh to check status',
                realTimeUpdates: false
              })
              eventSource.close()
              resolve() // Don't reject on timeout, let user handle it
              break

            default:
              console.log(`ℹ️ [RTM] Unknown message type: ${data.type}`)
              break
          }
        } catch (parseError) {
          console.error('Failed to parse SSE data:', parseError, event.data)
        }
      }

      eventSource.onerror = (error) => {
        console.error(`💥 [RTM] EventSource error for document ${documentId}:`, error)
        updateDocumentState({
          status: 'error',
          message: 'Connection to real-time updates lost. Processing may continue in background.',
          realTimeUpdates: false
        })
        eventSource.close()
        
        // Don't immediately reject - the processing might still complete
        // Instead, fall back to periodic polling
        setTimeout(() => resolve(), 1000)
      }

      // Initialize processing on the backend
      fetch(`/api/documents/${documentId}/process`, {
        method: 'POST'
      }).catch(error => {
        console.error('Failed to start document processing:', error)
        updateDocumentState({
          status: 'error',
          message: 'Failed to start document processing'
        })
        eventSource.close()
        reject(error)
      })
    })
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
      'FORM_1099_GENERIC': '1099 Form (Auto-Detected)',
      'OTHER_TAX_DOCUMENT': 'Other Tax Document'
    }
    return labels[documentType] || documentType
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'duplicate_warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />
      case 'extraction':
      case 'processing':
      case 'uploading':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Tax Documents</span>
          </CardTitle>
          <CardDescription>
            Upload multiple W-2, 1099, or other tax documents with real-time processing and OCR visibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileSelect={handleFileSelect}
            onMultipleFileSelect={(files) => {
              files.forEach(file => handleFileSelect(file))
            }}
            onFileRemove={() => handleFileRemove()}
            selectedFile={null}
            disabled={state.status === 'processing'}
            acceptedTypes={['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']}
            maxSize={10}
            multiple={true}
          />

          {/* Show selected files queue */}
          {state.files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Selected Files ({state.files.length}):</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {state.files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileRemove(index)}
                      disabled={state.status === 'processing'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.files.length > 0 && state.status === 'idle' && (
            <div className="mt-4">
              <Button 
                onClick={processAllDocuments}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Process {state.files.length} Document{state.files.length > 1 ? 's' : ''} with Real-Time Updates
              </Button>
            </div>
          )}

          {state.status === 'processing' && (
            <div className="mt-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Wifi className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {state.message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {state.status === 'completed' && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All documents processed successfully with real-time monitoring! Review the extracted data below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Show processing status for each document with enhanced visibility */}
      {state.processedDocuments.length > 0 && (
        <div className="space-y-4">
          {state.processedDocuments.map((processedDoc, index) => (
            <Card key={index} className={`${
              processedDoc.status === 'completed' ? 'border-green-200 bg-green-50/50' :
              processedDoc.status === 'error' ? 'border-red-200 bg-red-50/50' :
              processedDoc.status === 'duplicate_warning' ? 'border-amber-200 bg-amber-50/50' :
              processedDoc.status === 'extraction' || processedDoc.status === 'processing' || processedDoc.status === 'uploading' ? 'border-blue-200 bg-blue-50/50' :
              'border-gray-200'
            }`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(processedDoc.status)}
                    <span className="text-base">{processedDoc.file.name}</span>
                    {processedDoc.realTimeUpdates && processedDoc.status !== 'completed' && processedDoc.status !== 'error' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        <Wifi className="h-3 w-3 mr-1" />
                        Live Updates
                      </Badge>
                    )}
                    {(!processedDoc.realTimeUpdates && processedDoc.status !== 'completed' && processedDoc.status !== 'error') && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Offline Mode
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {processedDoc.document && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {getDocumentTypeLabel(processedDoc.document.documentType)}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProcessedDocument(index)}
                      disabled={state.status === 'processing' && state.currentlyProcessing === index}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Status: {processedDoc.message}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Processing Progress */}
                {(processedDoc.status === 'uploading' || processedDoc.status === 'processing' || processedDoc.status === 'extraction') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{processedDoc.progress}%</span>
                      </div>
                      <Progress value={processedDoc.progress} className="w-full" />
                    </div>
                    
                    {/* Processing Stages Visualization */}
                    {processedDoc.processingStages && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Processing Stages:</h4>
                        <div className="space-y-2">
                          {Object.entries(processedDoc.processingStages).map(([stage, info]) => (
                            <div key={stage} className="flex items-center space-x-2 text-sm">
                              {info.completed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : info.inProgress ? (
                                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-400" />
                              )}
                              <span className={`capitalize ${info.completed ? 'text-green-700' : info.inProgress ? 'text-blue-700' : 'text-gray-500'}`}>
                                {stage === 'extraction' ? 'OCR Extraction' : stage}
                              </span>
                              {info.message && (
                                <span className="text-gray-600 text-xs">- {info.message}</span>
                              )}
                              {info.timestamp && (
                                <span className="text-gray-400 text-xs ml-auto">
                                  {new Date(info.timestamp).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {processedDoc.status === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{processedDoc.message}</AlertDescription>
                  </Alert>
                )}

                {processedDoc.status === 'duplicate_warning' && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Potential duplicate detected!</strong> This document appears similar to existing documents. 
                      Please review the duplicate warning dialog to decide how to proceed.
                      {processedDoc.duplicateDetection && (
                        <div className="mt-2 text-sm">
                          Confidence: {Math.round(processedDoc.duplicateDetection.confidence * 100)}% similarity with {processedDoc.duplicateDetection.matchingDocuments.length} document(s)
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {processedDoc.status === 'completed' && processedDoc.extractedData && (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Extraction completed!</strong> The data has been validated and added to your tax return.
                      </AlertDescription>
                    </Alert>
                    
                    <Tabs defaultValue="preview" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="preview">Key Information</TabsTrigger>
                        <TabsTrigger value="ocr">OCR Text</TabsTrigger>
                        <TabsTrigger value="raw">All Extracted Data</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="preview" className="mt-4">
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-lg border">
                            <h4 className="font-medium text-sm text-gray-700 mb-3">Key Information Extracted:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {processedDoc.extractedData?.extractedData?.wages && (
                                <div>
                                  <span className="text-gray-600">Wages:</span>
                                  <span className="font-medium ml-2">${parseFloat(processedDoc.extractedData.extractedData.wages || '0').toLocaleString()}</span>
                                </div>
                              )}
                              {processedDoc.extractedData?.extractedData?.interestIncome && (
                                <div>
                                  <span className="text-gray-600">Interest Income:</span>
                                  <span className="font-medium ml-2">${parseFloat(processedDoc.extractedData.extractedData.interestIncome || '0').toLocaleString()}</span>
                                </div>
                              )}
                              {processedDoc.extractedData?.extractedData?.ordinaryDividends && (
                                <div>
                                  <span className="text-gray-600">Dividends:</span>
                                  <span className="font-medium ml-2">${parseFloat(processedDoc.extractedData.extractedData.ordinaryDividends || '0').toLocaleString()}</span>
                                </div>
                              )}
                              {processedDoc.extractedData?.extractedData?.employerName && (
                                <div>
                                  <span className="text-gray-600">Employer:</span>
                                  <span className="font-medium ml-2">{processedDoc.extractedData.extractedData.employerName}</span>
                                </div>
                              )}
                              {processedDoc.extractedData?.extractedData?.payerName && (
                                <div>
                                  <span className="text-gray-600">Payer:</span>
                                  <span className="font-medium ml-2">{processedDoc.extractedData.extractedData.payerName}</span>
                                </div>
                              )}
                              {(processedDoc.extractedData?.extractedData?.employeeName || processedDoc.extractedData?.extractedData?.recipientName) && (
                                <div>
                                  <span className="text-gray-600">Name on Document:</span>
                                  <span className="font-medium ml-2">{processedDoc.extractedData.extractedData.employeeName || processedDoc.extractedData.extractedData.recipientName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="ocr" className="mt-4">
                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                            <h4 className="font-medium text-sm text-gray-700 mb-2">Raw OCR Text:</h4>
                            <p className="text-sm font-mono whitespace-pre-wrap">
                              {processedDoc.ocrText || processedDoc.document?.ocrText || 'No OCR text available'}
                            </p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="raw" className="mt-4">
                        <div className="space-y-4">
                          <details className="mt-4">
                            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                              View complete extracted data (JSON)
                            </summary>
                            <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-4 rounded-lg mt-2 overflow-x-auto">
                              {JSON.stringify(processedDoc.extractedData, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add more documents button */}
      {state.processedDocuments.length > 0 && state.status !== 'processing' && (
        <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
          <CardContent className="text-center py-8">
            <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 mb-4">Need to upload more documents?</p>
            <Button 
              variant="outline"
              onClick={() => {
                // Reset to upload mode - keep existing processed documents
                setState(prev => ({ 
                  ...prev, 
                  status: 'idle',
                  message: 'Ready to upload more documents',
                  // Don't clear processedDocuments to maintain document history
                  files: [], // Clear only the pending files
                  currentlyProcessing: null,
                  progress: 0
                }))
                
                // Notify parent component to reset its state
                if (onUploadMoreRequested) {
                  onUploadMoreRequested()
                }
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload More Documents
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Warning Dialog */}
      <DuplicateWarningDialog
        open={duplicateWarning.open}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateWarning({
              open: false,
              documentIndex: null,
              documentData: null
            })
          }
        }}
        documentFileName={duplicateWarning.documentData?.file.name || ''}
        duplicateDetection={duplicateWarning.documentData?.extractedData?.duplicateDetection || {
          isDuplicate: false,
          confidence: 0,
          matchingDocuments: [],
          matchCriteria: {
            documentType: false,
            employerInfo: false,
            recipientInfo: false,
            amountSimilarity: false,
            nameSimilarity: false
          }
        }}
        onAction={handleDuplicateAction}
      />
    </div>
  )
}
