'use client';

import { useState, useEffect } from 'react';
import Modal from '../Modal';


export default function HydrationFileUpload() {
  const [carePlanFiles, setCarePlanFiles] = useState<File[]>([]);
  const [hydrationDataFiles, setHydrationDataFiles] = useState<File[]>([]);
  const [ipcDataFiles, setIpcDataFiles] = useState<File[]>([]);
  const [selectedHome, setSelectedHome] = useState('');
  const [homes, setHomes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // Fetch homes from the API
  useEffect(() => {
    const fetchHomes = async () => {
      try {
        setLoadingHomes(true);
        console.log('🏠 [HYDRATION UPLOAD] Fetching homes...');
        
        const response = await fetch('/api/admin/homes');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [HYDRATION UPLOAD] Error response:', response.status, errorText);
          throw new Error(`Failed to fetch homes: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ [HYDRATION UPLOAD] Homes API response:', data.homes);
          setHomes(data.homes);
          
          if (data.homes.length === 0) {
            console.warn('⚠️ [HYDRATION UPLOAD] No homes found');
            setMessage('No homes found. Please ensure homes are configured.');
          }
        } else {
          console.error('❌ [HYDRATION UPLOAD] Error fetching homes:', data.error);
          setMessage(`Error loading homes: ${data.error}`);
        }
      } catch (error) {
        console.error('❌ [HYDRATION UPLOAD] Network error fetching homes:', error);
        setMessage(`Error loading homes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoadingHomes(false);
      }
    };

    fetchHomes();
  }, []);

  const handleCarePlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setCarePlanFiles(files);
    }
  };

  const handleHydrationDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setHydrationDataFiles(files);
    }
  };

  const handleIpcDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setIpcDataFiles(files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setShowSuccess(false);

    console.log('🚀 [HYDRATION UPLOAD] Starting file upload process...');
    console.log('📁 [HYDRATION UPLOAD] Care plan files:', carePlanFiles.map(f => f.name));
    console.log('💧 [HYDRATION UPLOAD] Hydration data files:', hydrationDataFiles.map(f => f.name));
    console.log('🏠 [HYDRATION UPLOAD] Home:', selectedHome);

    if (carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome) {
      setMessage('Please select at least one care plan file, one hydration data file, and a home');
      setLoading(false);
      return;
    }

    await continueSubmission();
  };

  const continueSubmission = async (skipValidation = false) => {
    setLoading(true);

    try {
      // Verify PDFs if not skipping validation
      if (!skipValidation) {
        // Verify care plan PDFs
        for (const file of carePlanFiles) {
          const verifyFormData = new FormData();
          verifyFormData.append('pdf', file);
          verifyFormData.append('home', selectedHome);
          
          const verifyResponse = await fetch('/api/admin/verify-files', {
            method: 'POST',
            body: verifyFormData,
          });
          
          const result = await verifyResponse.json();
          if (!result.pdf.validity) {
            setValidationMessage(result.pdf.message);
            setShowValidationModal(true);
            setLoading(false);
            return;
          }
        }
      }

      const formData = new FormData();
      
      // Append all care plan files
      carePlanFiles.forEach((file, index) => {
        formData.append(`carePlan_${index}`, file);
        console.log(`📄 [HYDRATION UPLOAD] Added care plan file ${index}: ${file.name} (${file.size} bytes)`);
      });
      
      // Append all hydration data files
      hydrationDataFiles.forEach((file, index) => {
        formData.append(`hydrationData_${index}`, file);
        console.log(`💧 [HYDRATION UPLOAD] Added hydration data file ${index}: ${file.name} (${file.size} bytes)`);
      });

      // Append all IPC data files
      ipcDataFiles.forEach((file, index) => {
        formData.append(`ipcData_${index}`, file);
        console.log(`📋 [HYDRATION UPLOAD] Added IPC data file ${index}: ${file.name} (${file.size} bytes)`);
      });
      
      formData.append('homeId', selectedHome);
      formData.append('carePlanCount', carePlanFiles.length.toString());
      formData.append('hydrationDataCount', hydrationDataFiles.length.toString());
      formData.append('ipcDataCount', ipcDataFiles.length.toString());

      console.log('📤 [HYDRATION UPLOAD] Sending request to /api/admin/process-hydration...');

      const response = await fetch('/api/admin/process-hydration', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      console.log('📥 [HYDRATION UPLOAD] Response received:', { status: response.status, ok: response.ok });
      console.log('📊 [HYDRATION UPLOAD] Response data:', result);

      if (response.ok) {
        console.log('✅ [HYDRATION UPLOAD] Files processed successfully!');
        setMessage(`Files processed successfully! Processed ${result.residentsCount || 0} residents across ${result.datesProcessed || 0} dates.`);
        setShowSuccess(true);
        setCarePlanFiles([]);
        setHydrationDataFiles([]);
        setIpcDataFiles([]);
        setSelectedHome('');
        // Reset file inputs
        const carePlanInput = document.getElementById('carePlan') as HTMLInputElement;
        const hydrationDataInput = document.getElementById('hydrationData') as HTMLInputElement;
        const ipcDataInput = document.getElementById('ipcData') as HTMLInputElement;
        if (carePlanInput) carePlanInput.value = '';
        if (hydrationDataInput) hydrationDataInput.value = '';
        if (ipcDataInput) ipcDataInput.value = '';
      } else {
        console.error('❌ [HYDRATION UPLOAD] Error processing files:', result.error);
        setMessage(`Error: ${result.error || result.details || 'Unknown error'}`);
        setShowSuccess(false);
      }
    } catch (error) {
      console.error('💥 [HYDRATION UPLOAD] Network or processing error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowSuccess(false);
    } finally {
      setLoading(false);
      console.log('🏁 [HYDRATION UPLOAD] Upload process completed');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200" style={{ boxShadow: '0 2px 8px rgba(6, 182, 212, 0.08), 0 0 0 1px rgba(6, 182, 212, 0.05)' }}>
      <div className="px-6 py-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Upload Hydration Files
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Care Plan File Upload */}
          <div>
            <label htmlFor="carePlan" className="block text-sm font-medium text-gray-700">
              Care Plan PDF
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="carePlan"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="carePlan"
                      name="carePlan"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handleCarePlanChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {carePlanFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-[#06b6d4] font-medium">Selected {carePlanFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {carePlanFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Hydration Data File Upload */}
          <div>
            <label htmlFor="hydrationData" className="block text-sm font-medium text-gray-700">
              Hydration Data PDF
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="hydrationData"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="hydrationData"
                      name="hydrationData"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handleHydrationDataChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {hydrationDataFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-[#06b6d4] font-medium">Selected {hydrationDataFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {hydrationDataFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* IPC File Upload */}
          <div>
            <label htmlFor="ipcData" className="block text-sm font-medium text-gray-700">
              IPC File CSV (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="ipcData"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: '#0cc7ed' }}
                    onMouseEnter={(e) => (e.target as HTMLLabelElement).style.color = '#0aa8c7'}
                    onMouseLeave={(e) => (e.target as HTMLLabelElement).style.color = '#0cc7ed'}
                  >
                    <span>Upload a file</span>
                    <input
                      id="ipcData"
                      name="ipcData"
                      type="file"
                      accept=".csv"
                      multiple
                      className="sr-only"
                      onChange={handleIpcDataChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">CSV files only</p>
              </div>
            </div>
            {ipcDataFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-[#06b6d4] font-medium">Selected {ipcDataFiles.length} file(s):</p>
                <ul className="mt-1 text-sm text-gray-600">
                  {ipcDataFiles.map((file, index) => (
                    <li key={index} className="truncate">• {file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Home Selection */}
          <div>
            <label htmlFor="home" className="block text-sm font-medium text-gray-700">
              Select Home
            </label>
            <select
              id="home"
              name="home"
              value={selectedHome}
              onChange={(e) => setSelectedHome(e.target.value)}
              disabled={loadingHomes}
              className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ 
                '--tw-ring-color': '#0cc7ed',
                '--tw-border-color': '#0cc7ed'
              } as React.CSSProperties}
              onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#0cc7ed';
                (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(12, 199, 237, 0.1)';
              }}
              onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = '#d1d5db';
                (e.target as HTMLSelectElement).style.boxShadow = 'none';
              }}
            >
              <option value="">
                {loadingHomes ? 'Loading homes...' : 'Select a home...'}
              </option>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.name}
                </option>
              ))}
            </select>
            {homes.length === 0 && !loadingHomes && (
              <p className="mt-1 text-sm text-amber-600">
                No homes found. Please create homes first.
              </p>
            )}
          </div>

          {showSuccess && (
            <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
              <div className="flex items-center">
                <div className="shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    {message || 'Files uploaded successfully!'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {message && !showSuccess && (
            <div
              className={`text-sm ${message.includes('Error') ? 'text-red-600' : message.includes('success') ? 'text-green-600' : ''}`}
              style={
                !message.includes('Error') && !message.includes('success')
                  ? { color: '#06b6d4' }
                  : {}
              }
            >
              {message}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || loadingHomes || carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome}
              className="ml-3 inline-flex items-center justify-center gap-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: '#0cc7ed' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0aa8c7';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#0cc7ed';
                }
              }}
            >
              {loading ? 'Processing...' : 'Process Files'}

              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
            </button>
          </div>
        </form>

        <Modal
          showModal={showValidationModal}
          handleClose={() => {
            setShowValidationModal(false);
            setLoading(false);
          }}
          modalContent={
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">PDF Validation Warning</h2>
              <p className="text-sm text-gray-700 mb-6">{validationMessage}</p>
              <p className="text-sm text-gray-600 mb-6">Do you want to continue?</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowValidationModal(false);
                    setLoading(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  No
                </button>
                <button
                  onClick={() => {
                    setShowValidationModal(false);
                    continueSubmission(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: '#0cc7ed' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0aa8c7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0cc7ed';
                  }}
                >
                  Yes, Continue
                </button>
              </div>
            </div>
          }
          title="PDF Validation Warning"
        />
      </div>
    </div>
  );
}

