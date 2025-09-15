

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  FolderOpen, 
  Activity,
  Wifi,
  FileText
} from "lucide-react"
import { DocumentRealTimeProcessor } from "@/components/document-real-time-processor"
import { EnhancedDocumentManagement } from "@/components/enhanced-document-management"

interface DashboardDocumentUploadEnhancedProps {
  taxReturnId: string
  onDocumentProcessed: (extractedData: any) => void
}

export function DashboardDocumentUploadEnhanced({ 
  taxReturnId, 
  onDocumentProcessed 
}: DashboardDocumentUploadEnhancedProps) {
  const [activeTab, setActiveTab] = useState<string>("upload")

  const handleDocumentProcessedInternal = (extractedData: any) => {
    console.log('🔄 [Enhanced Upload] Document processed, switching to management view')
    // Switch to management tab to see the processed document
    setActiveTab("manage")
    // Call parent callback
    onDocumentProcessed(extractedData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <span>Enhanced Document Processing</span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Wifi className="h-3 w-3 mr-1" />
            Real-Time
          </Badge>
        </CardTitle>
        <CardDescription>
          Upload and manage tax documents with real-time OCR extraction and processing visibility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Real-Time Upload</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center space-x-2">
              <FolderOpen className="h-4 w-4" />
              <span>Document Management</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-4">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Wifi className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Real-Time Processing Features</h3>
                </div>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Live OCR extraction visibility</li>
                  <li>• Real-time processing status updates</li>
                  <li>• No page refreshes required</li>
                  <li>• Processing stage indicators</li>
                  <li>• Immediate error detection</li>
                </ul>
              </div>
              
              <DocumentRealTimeProcessor
                taxReturnId={taxReturnId}
                onDocumentProcessed={handleDocumentProcessedInternal}
                onUploadMoreRequested={() => setActiveTab("upload")}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="manage" className="mt-4">
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  <h3 className="font-medium text-green-900">Live Document Management</h3>
                </div>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Real-time status monitoring</li>
                  <li>• Live processing indicators</li>
                  <li>• OCR text visibility</li>
                  <li>• Extracted data preview</li>
                  <li>• Connection status tracking</li>
                </ul>
              </div>
              
              <EnhancedDocumentManagement
                taxReturnId={taxReturnId}
                onDocumentProcessed={onDocumentProcessed}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

