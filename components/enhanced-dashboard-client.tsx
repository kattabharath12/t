

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Logo } from "@/components/ui/logo"
import { 
  FileText, 
  Plus, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  Clock,
  User,
  LogOut,
  Upload,
  FolderOpen,
  Wifi,
  Activity
} from "lucide-react"
import { signOut } from "next-auth/react"
import { DashboardDocumentUploadEnhanced } from "@/components/dashboard-document-upload-enhanced"

interface EnhancedDashboardClientProps {
  user: {
    id: string
    name: string | null
    email: string
    taxReturns: {
      id: string
      taxYear: number
      filingStatus: string
      currentStep: number
      isCompleted: boolean
      isFiled: boolean
      refundAmount: any
      amountOwed: any
      createdAt: Date
      updatedAt: Date
    }[]
  }
}

export function EnhancedDashboardClient({ user }: EnhancedDashboardClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [showDocumentUpload, setShowDocumentUpload] = useState(false)
  const [documentsLoading, setDocumentsLoading] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    setDocumentsLoading(true)
    
    try {
      const currentTaxReturn = user.taxReturns.find(tr => tr.taxYear === 2024)
      if (currentTaxReturn) {
        console.log('🔍 [Enhanced Dashboard] Fetching documents for tax return:', currentTaxReturn.id)
        const response = await fetch(`/api/tax-returns/${currentTaxReturn.id}/documents`)
        if (response.ok) {
          const data = await response.json()
          console.log('📄 [Enhanced Dashboard] Documents fetched:', data.length, 'documents')
          setDocuments(data)
        } else {
          console.error('❌ [Enhanced Dashboard] Failed to fetch documents:', response.status)
        }
      }
    } catch (error) {
      console.error("❌ [Enhanced Dashboard] Error fetching documents:", error)
    } finally {
      setDocumentsLoading(false)
    }
  }

  const handleDocumentProcessed = () => {
    console.log('🔄 [Enhanced Dashboard] Document processed, refreshing documents...')
    fetchDocuments() // Refresh documents after processing
  }

  const handleNewReturn = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/tax-returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: "SINGLE", // Default, will be updated in first step
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/tax-filing/${data.id}`)
      }
    } catch (error) {
      console.error("Error creating tax return:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" })
  }

  const currentTaxReturn = user.taxReturns.find(tr => tr.taxYear === 2024)
  const progressPercentage = currentTaxReturn ? (currentTaxReturn.currentStep / 7) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Logo size="md" />
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{user.name || user.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name?.split(" ")[0] || "there"}!
          </h2>
          <p className="text-gray-600">
            Manage your tax returns with real-time document processing and OCR visibility
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tax Year 2024</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentTaxReturn ? 
                  (currentTaxReturn.isCompleted ? "Completed" : "In Progress") : 
                  "Not Started"
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Filing deadline: April 15, 2025
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Refund/Owed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentTaxReturn ? 
                  (Number(currentTaxReturn.refundAmount) > 0 ? 
                    `$${Number(currentTaxReturn.refundAmount).toLocaleString()}` : 
                    Number(currentTaxReturn.amountOwed) > 0 ? 
                      `-$${Number(currentTaxReturn.amountOwed).toLocaleString()}` : 
                      "$0"
                  ) : 
                  "--"
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {currentTaxReturn && Number(currentTaxReturn.refundAmount) > 0 ? "Expected refund" : "Amount owed"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(progressPercentage)}%</div>
              <Progress value={progressPercentage} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Documents Section with Real-Time Processing */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Tax Documents 
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                <Activity className="h-3 w-3 mr-1" />
                Real-Time Processing
              </Badge>
            </h3>
            <Button 
              onClick={() => setShowDocumentUpload(!showDocumentUpload)}
              variant="outline"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              {showDocumentUpload ? 'Hide Upload' : 'Upload Documents'}
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enhanced Document Upload Card */}
            <Card className="border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-blue-500" />
                  <span>Real-Time Document Processing</span>
                </CardTitle>
                <CardDescription>
                  Upload W-2s, 1099s with live OCR extraction visibility and real-time status updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <Wifi className="h-5 w-5 text-blue-500" />
                    <Activity className="h-5 w-5 text-green-500" />
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    See OCR extraction in real-time • Live processing updates • No page refreshes needed
                  </p>
                  <Button 
                    onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {showDocumentUpload ? 'Hide Real-Time Upload' : 'Start Real-Time Upload'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Document Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FolderOpen className="h-5 w-5 text-green-500" />
                  <span>Document Summary</span>
                </CardTitle>
                <CardDescription>
                  Real-time overview of your uploaded tax documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Documents</span>
                    <Badge variant="secondary">{documents.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Processed</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {documents.filter(doc => doc.processingStatus === 'COMPLETED').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Processing</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Activity className="h-3 w-3 mr-1" />
                      {documents.filter(doc => doc.processingStatus === 'PROCESSING').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Failed</span>
                    <Badge variant="destructive">
                      {documents.filter(doc => doc.processingStatus === 'FAILED').length}
                    </Badge>
                  </div>
                  {documents.length > 0 && (
                    <div className="pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setShowDocumentUpload(true)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        View All Documents
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-Time Document Upload Interface */}
          {showDocumentUpload && (
            <Card className="mt-6 border-2 border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-200">
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Real-Time Document Processing</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <Wifi className="h-3 w-3 mr-1" />
                    Live Updates
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Upload and process documents with real-time OCR extraction visibility and live status updates
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {currentTaxReturn ? (
                  <DashboardDocumentUploadEnhanced
                    taxReturnId={currentTaxReturn.id}
                    onDocumentProcessed={handleDocumentProcessed}
                  />
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      To use real-time document processing, you need to start a tax return first.
                    </p>
                    <Button onClick={handleNewReturn} disabled={loading}>
                      <Plus className="mr-2 h-4 w-4" />
                      {loading ? "Creating..." : "Start Tax Return"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Current Tax Return */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Current Tax Return</h3>
            
            {currentTaxReturn ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>2024 Tax Return</span>
                    <Badge variant={currentTaxReturn.isCompleted ? "default" : "secondary"}>
                      {currentTaxReturn.isCompleted ? "Completed" : "In Progress"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Last updated: {new Date(currentTaxReturn.updatedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Step {currentTaxReturn.currentStep} of 7</span>
                        <span>{Math.round(progressPercentage)}%</span>
                      </div>
                      <Progress value={progressPercentage} />
                    </div>
                    
                    <div className="pt-4">
                      <Button 
                        onClick={() => router.push(`/tax-filing/${currentTaxReturn.id}`)}
                        className="w-full"
                      >
                        {currentTaxReturn.isCompleted ? "Review Return" : "Continue Filing"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Start Your 2024 Tax Return</CardTitle>
                  <CardDescription>
                    Get started with real-time document processing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-6">
                      Ready to file your 2024 tax return with advanced OCR processing? We'll guide you through each step.
                    </p>
                    <Button onClick={handleNewReturn} disabled={loading} size="lg">
                      <Plus className="mr-2 h-4 w-4" />
                      {loading ? "Creating..." : "Start New Return"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Returns */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Tax Returns</h3>
            
            <div className="space-y-4">
              {user.taxReturns.length > 0 ? (
                user.taxReturns.map((taxReturn) => (
                  <Card key={taxReturn.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{taxReturn.taxYear} Tax Return</span>
                        <div className="flex items-center space-x-2">
                          {taxReturn.isFiled ? (
                            <Badge variant="default">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Filed
                            </Badge>
                          ) : taxReturn.isCompleted ? (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              Ready to File
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              In Progress
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                      <CardDescription>
                        Filing Status: {taxReturn.filingStatus.replace(/_/g, ' ')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">
                            Created: {new Date(taxReturn.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/tax-filing/${taxReturn.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No tax returns yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

