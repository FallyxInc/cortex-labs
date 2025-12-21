'use client';

import { useState, useEffect } from 'react';


export default function HydrationFileUpload() {
  const [carePlanFiles, setCarePlanFiles] = useState<File[]>([]);
  const [hydrationDataFiles, setHydrationDataFiles] = useState<File[]>([]);
  const [ipcDataFiles, setIpcDataFiles] = useState<File[]>([]);
  const [selectedHome, setSelectedHome] = useState('');
  const [homes, setHomes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [message, setMessage] = useState('');

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

    console.log('🚀 [HYDRATION UPLOAD] Starting file upload process...');
    console.log('📁 [HYDRATION UPLOAD] Care plan files:', carePlanFiles.map(f => f.name));
    console.log('💧 [HYDRATION UPLOAD] Hydration data files:', hydrationDataFiles.map(f => f.name));
    console.log('🏠 [HYDRATION UPLOAD] Home:', selectedHome);

    if (carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome) {
      setMessage('Please select at least one care plan file, one hydration data file, and a home');
      setLoading(false);
      return;
    }

    try {
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
      }
    } catch (error) {
      console.error('💥 [HYDRATION UPLOAD] Network or processing error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg font-medium ${
              message.includes('Error')
                ? 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                : 'bg-[#e0f7fa] text-[#0e7490] border border-[#b2ebf2]'
            }`}>
              {message}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || loadingHomes || carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome}
              className="inline-flex justify-center py-2 px-4 text-sm font-medium rounded-md text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: (loading || loadingHomes || carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome)
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)',
                boxShadow: (loading || loadingHomes || carePlanFiles.length === 0 || hydrationDataFiles.length === 0 || !selectedHome)
                  ? 'none'
                  : '0 4px 12px rgba(6, 182, 212, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)';
                }
              }}
            >
              {loading ? 'Processing...' : 'Process Files'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

