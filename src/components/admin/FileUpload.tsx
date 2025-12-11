"use client";

import { useState, useEffect, useRef } from "react";
import { HiOutlineXMark } from 'react-icons/hi2';
import HelpIcon from "./HelpIcon";
import {
  trackFileUpload,
  trackBulkFileProcessing,
  trackFormInteraction,
  trackError,
} from "@/lib/mixpanel";

export default function FileUpload() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [selectedHome, setSelectedHome] = useState("");
  const [homes, setHomes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState({
    percentage: 0,
    message: "",
    step: "",
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Overview metrics state
  const [antipsychoticsPercentage, setAntipsychoticsPercentage] = useState("");
  const [antipsychoticsChange, setAntipsychoticsChange] = useState("");
  const [antipsychoticsResidents, setAntipsychoticsResidents] = useState("");

  const [worsenedPercentage, setWorsenedPercentage] = useState("");
  const [worsenedChange, setWorsenedChange] = useState("");
  const [worsenedResidents, setWorsenedResidents] = useState("");

  const [improvedPercentage, setImprovedPercentage] = useState("");
  const [improvedChange, setImprovedChange] = useState("");
  const [improvedResidents, setImprovedResidents] = useState("");
  const formStartTime = useRef<number>(Date.now());

  // Poll for progress updates
  useEffect(() => {
    if (!jobId) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(
          `/api/admin/process-progress?jobId=${jobId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setProgress({
            percentage: data.percentage || 0,
            message: data.message || "",
            step: data.step || "",
          });

          // Stop polling if complete or error
          if (
            data.percentage >= 100 ||
            data.step === "error" ||
            data.step === "complete"
          ) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            if (data.step === "complete") {
              setMessage("Files uploaded successfully!");
              setShowSuccess(true);
              // Clear success message after 10 seconds
              setTimeout(() => {
                setShowSuccess(false);
                setMessage("");
              }, 10000);
            } else if (data.step === "error") {
              setMessage(`Error: ${data.message}`);
              setShowSuccess(false);
            }
          }
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    };

    // Poll every 500ms
    progressIntervalRef.current = setInterval(pollProgress, 500);
    pollProgress(); // Initial poll

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [jobId]);

  useEffect(() => {
    const fetchHomes = async () => {
      try {
        setLoadingHomes(true);
        const response = await fetch("/api/admin/homes");

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", response.status, errorText);
          throw new Error(`Failed to fetch homes: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          // Convert homes array to format expected by component
          const homesList = data.homes.map(
            (home: { id: string; name: string }) => home.id,
          );
          setHomes(data.homes);

          if (homesList.length === 0) {
            setMessage("No homes found. Please ensure homes are configured.");
          }
        } else {
          setMessage(`Error loading homes: ${data.error}`);
        }
      } catch (error) {
        setMessage(
          `Error loading homes: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setLoadingHomes(false);
      }
    };

    fetchHomes();
  }, []);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPdfFiles(files);
      // Track file selection
      files.forEach((file) => {
        trackFileUpload({
          homeId: selectedHome || "unknown",
          fileType: "pdf",
          fileName: file.name,
          fileSize: file.size,
        });
      });
    }
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setExcelFiles(files);
      // Track file selection
      files.forEach((file) => {
        const fileType = file.name.endsWith(".xlsx") ? "xlsx" : "xls";
        trackFileUpload({
          homeId: selectedHome || "unknown",
          fileType: fileType as "excel" | "xls" | "xlsx",
          fileName: file.name,
          fileSize: file.size,
        });
      });
    }
  };

  const handleDeletePdf = (index: number) => {
    const newFiles = pdfFiles.filter((_, i) => i !== index);
    setPdfFiles(newFiles);
    // Reset file input if all files are removed
    if (newFiles.length === 0) {
      const pdfInput = document.getElementById("pdf") as HTMLInputElement;
      if (pdfInput) pdfInput.value = "";
    }
  };

  const handleDeleteExcel = (index: number) => {
    const newFiles = excelFiles.filter((_, i) => i !== index);
    setExcelFiles(newFiles);
    // Reset file input if all files are removed
    if (newFiles.length === 0) {
      const excelInput = document.getElementById("excel") as HTMLInputElement;
      if (excelInput) excelInput.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setShowSuccess(false);

    const processingStartTime = Date.now();
    formStartTime.current = Date.now();

    // Track form submission
    trackFormInteraction({
      formName: "file_upload",
      action: "submitted",
      homeId: selectedHome,
    });

    // Files are optional - only require home selection
    if (!selectedHome) {
      setMessage("Please select a home");
      setLoading(false);
      trackFormInteraction({
        formName: "file_upload",
        action: "validated",
        validationErrors: ["no_home_selected"],
      });
      return;
    }

    // If files are provided, both PDF and Excel are required
    // If no files, metrics are optional (will keep most recent value if nothing provided)
    if (pdfFiles.length > 0 || excelFiles.length > 0) {
      if (pdfFiles.length === 0 || excelFiles.length === 0) {
        setMessage(
          "Please select both PDF and Excel files, or provide only overview metrics",
        );
        setLoading(false);
        trackFormInteraction({
          formName: "file_upload",
          action: "validated",
          validationErrors: ["mismatched_file_types"],
        });
        return;
      }
    }
    // If no files and no metrics, that's okay - will just keep existing values

    try {
      const formData = new FormData();

      pdfFiles.forEach((file, index) => {
        formData.append(`pdf_${index}`, file);
      });

      excelFiles.forEach((file, index) => {
        formData.append(`excel_${index}`, file);
      });

      formData.append("home", selectedHome);
      formData.append("pdfCount", pdfFiles.length.toString());
      formData.append("excelCount", excelFiles.length.toString());

      // Add overview metrics if provided
      if (antipsychoticsPercentage) {
        formData.append("antipsychoticsPercentage", antipsychoticsPercentage);
        formData.append("antipsychoticsChange", antipsychoticsChange || "0");
        formData.append(
          "antipsychoticsResidents",
          antipsychoticsResidents || "",
        );
      }
      if (worsenedPercentage) {
        formData.append("worsenedPercentage", worsenedPercentage);
        formData.append("worsenedChange", worsenedChange || "0");
        formData.append("worsenedResidents", worsenedResidents || "");
      }
      if (improvedPercentage) {
        formData.append("improvedPercentage", improvedPercentage);
        formData.append("improvedChange", improvedChange || "0");
        formData.append("improvedResidents", improvedResidents || "");
      }

      console.log("Processing behaviour files...");
      const response = await fetch("/api/admin/process-behaviours", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      const processingTime = Date.now() - processingStartTime;

      console.log("result", result);

      // Start tracking progress if jobId is returned
      if (result.jobId) {
        setJobId(result.jobId);
        setProgress({
          percentage: 0,
          message: "Processing started...",
          step: "initializing",
        });
      }

      if (response.ok) {
        console.log("Behaviour files processed successfully!");
        setMessage("Files uploaded successfully!");
        setShowSuccess(true);
        // Clear success message after 10 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setMessage("");
        }, 10000);

        // Track successful bulk processing
        const totalFiles = pdfFiles.length + excelFiles.length;
        const recordsExtracted = result.recordsExtracted || 0;

        trackBulkFileProcessing({
          homeId: selectedHome,
          totalFiles,
          successCount: totalFiles,
          failureCount: 0,
          totalProcessingTime: processingTime,
          totalRecordsExtracted: recordsExtracted,
        });

        trackFormInteraction({
          formName: "file_upload",
          action: "submitted",
          timeToComplete: Date.now() - formStartTime.current,
          homeId: selectedHome,
        });

        setPdfFiles([]);
        setExcelFiles([]);
        setSelectedHome("");
        setAntipsychoticsPercentage("");
        setAntipsychoticsChange("");
        setAntipsychoticsResidents("");
        setWorsenedPercentage("");
        setWorsenedChange("");
        setWorsenedResidents("");
        setImprovedPercentage("");
        setImprovedChange("");
        setImprovedResidents("");
        setJobId(null);
        setProgress({ percentage: 0, message: "", step: "" });
        const pdfInput = document.getElementById("pdf") as HTMLInputElement;
        const excelInput = document.getElementById("excel") as HTMLInputElement;
        if (pdfInput) pdfInput.value = "";
        if (excelInput) excelInput.value = "";
      } else {
        setJobId(null);
        setProgress({ percentage: 0, message: "", step: "" });
        setMessage(`Error: ${result.error}`);
        setShowSuccess(false);

        // Track processing error
        trackBulkFileProcessing({
          homeId: selectedHome,
          totalFiles: pdfFiles.length + excelFiles.length,
          successCount: 0,
          failureCount: pdfFiles.length + excelFiles.length,
          totalProcessingTime: processingTime,
          totalRecordsExtracted: 0,
        });

        trackError({
          errorType: "processing_error",
          errorMessage: result.error || "Unknown error",
          page: "upload",
          homeId: selectedHome,
          context: {
            pdfCount: pdfFiles.length,
            excelCount: excelFiles.length,
          },
        });
      }
    } catch (error: unknown) {
      setJobId(null);
      setProgress({ percentage: 0, message: "", step: "" });
      setMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setShowSuccess(false);

      trackError({
        errorType: "processing_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        page: "upload",
        homeId: selectedHome,
        context: {
          pdfCount: pdfFiles.length,
          excelCount: excelFiles.length,
        },
      });
    } finally {
      // Only set loading to false if we're not tracking progress
      if (!jobId) {
        setLoading(false);
      }
    }
  };

  // Update loading state based on progress
  useEffect(() => {
    if (
      progress.percentage >= 100 ||
      progress.step === "error" ||
      progress.step === "complete"
    ) {
      setLoading(false);
      if (progress.step === "complete") {
        setMessage("Files uploaded successfully!");
        setShowSuccess(true);
        // Clean up progress tracking after a delay, but keep success message visible
        setTimeout(() => {
          setJobId(null);
          setProgress({ percentage: 0, message: "", step: "" });
        }, 3000);
        // Clear success message after 10 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setMessage("");
        }, 10000);
      }
    }
  }, [progress]);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-6">
          <h3 className="text-base leading-6 font-medium text-gray-900">
            Upload Behaviour Files
          </h3>
          <HelpIcon
            title="Upload Behaviour Files"
            content="Upload and process behavioural data files for homes.

• PDF Files: Behaviour notes in PDF format. Upload one or more PDF files.

• Excel Files: Incident reports in Excel format (.xls or .xlsx). Must upload the same number of Excel files as PDF files.

• Overview Metrics: Optional metrics that can be entered manually or will be extracted from files. These include:
  - % of Residents with Potentially Inappropriate Use of Antipsychotics
  - % of Behaviours Worsened
  - % of Behaviours Improved

You can upload files only, enter metrics only, or do both. If no files are uploaded, only metrics will be saved."
          />
        </div>

        {showSuccess && (
          <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
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
                  {message || "Files uploaded successfully!"}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="flex items-center">
              <label
                htmlFor="pdf"
                className="block text-sm font-medium text-gray-700"
              >
                Behaviour Notes PDF
              </label>
              <HelpIcon
                title="Behaviour Notes PDF"
                content="Upload PDF files containing behaviour notes. You can upload multiple PDF files. The system will process these files to extract behavioural data."
              />
            </div>
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
                    htmlFor="pdf"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: "#0cc7ed" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLLabelElement).style.color = "#0aa8c7")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLLabelElement).style.color = "#0cc7ed")
                    }
                  >
                    <span>Upload a file</span>
                    <input
                      id="pdf"
                      name="pdf"
                      type="file"
                      accept=".pdf"
                      multiple
                      className="sr-only"
                      onChange={handlePdfChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>
            {pdfFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium" style={{ color: "#06b6d4" }}>
                  Selected {pdfFiles.length} file(s):
                </p>
                <ul className="mt-1 text-sm text-gray-600 space-y-1">
                  {pdfFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 bg-gray-50 px-2 py-1 rounded">
                      <span className="truncate flex-1">• {file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeletePdf(index)}
                        className="flex-shrink-0 text-red-600 hover:text-red-800 hover:bg-red-50 rounded p-1 transition-colors"
                        title="Remove file"
                        aria-label={`Remove ${file.name}`}
                      >
                        <HiOutlineXMark className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center">
              <label
                htmlFor="excel"
                className="block text-sm font-medium text-gray-700"
              >
                Incident Report Excel
              </label>
              <HelpIcon
                title="Incident Report Excel"
                content="Upload Excel files (.xls or .xlsx) containing incident reports. You must upload the same number of Excel files as PDF files. The system will process these files to extract incident data."
              />
            </div>
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
                    htmlFor="excel"
                    className="relative cursor-pointer bg-white rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2"
                    style={{ color: "#0cc7ed" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLLabelElement).style.color = "#0aa8c7")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLLabelElement).style.color = "#0cc7ed")
                    }
                  >
                    <span>Upload a file</span>
                    <input
                      id="excel"
                      name="excel"
                      type="file"
                      accept=".xls,.xlsx"
                      multiple
                      className="sr-only"
                      onChange={handleExcelChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">Excel files only</p>
              </div>
            </div>
            {excelFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium" style={{ color: "#06b6d4" }}>
                  Selected {excelFiles.length} file(s):
                </p>
                <ul className="mt-1 text-sm text-gray-600 space-y-1">
                  {excelFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 bg-gray-50 px-2 py-1 rounded">
                      <span className="truncate flex-1">• {file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExcel(index)}
                        className="flex-shrink-0 text-red-600 hover:text-red-800 hover:bg-red-50 rounded p-1 transition-colors"
                        title="Remove file"
                        aria-label={`Remove ${file.name}`}
                      >
                        <HiOutlineXMark className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="flex items-center mb-4">
              <h4 className="text-base font-medium text-gray-900">
                Overview Metrics (Optional)
              </h4>
              <HelpIcon
                title="Overview Metrics"
                content="Enter high-level metrics for the behaviours dashboard. These metrics can be entered manually or will be extracted from uploaded files.

• Percentage Value: The main percentage metric
• Change (+ or -): The change from the previous period
• Resident Names: Comma-separated list of residents associated with this metric

If no files are uploaded, these metrics will be saved directly. If files are uploaded, metrics are optional and will supplement the file data."
              />
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter overview metrics for the behaviours dashboard. If no files
              are uploaded, these metrics will be saved. If files are uploaded,
              metrics are optional.
            </p>

            <div className="space-y-6">
              {/* Antipsychotics Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <h5 className="text-sm font-medium text-gray-700">
                    % of Residents with Potentially Inappropriate Use of
                    Antipsychotics
                  </h5>
                  <HelpIcon
                    title="Antipsychotics Metric"
                    content="Track the percentage of residents who have potentially inappropriate use of antipsychotics. Enter the percentage value, change from previous period, and list of affected residents."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Percentage Value
                    </label>
                    <input
                      type="number"
                      value={antipsychoticsPercentage}
                      onChange={(e) =>
                        setAntipsychoticsPercentage(e.target.value)
                      }
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., 15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Change (+ or -)
                    </label>
                    <input
                      type="number"
                      value={antipsychoticsChange}
                      onChange={(e) => setAntipsychoticsChange(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., -3"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Resident Names (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={antipsychoticsResidents}
                    onChange={(e) => setAntipsychoticsResidents(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    placeholder="e.g., John Smith, Mary Johnson"
                  />
                </div>
              </div>

              {/* Worsened Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <h5 className="text-sm font-medium text-gray-700">
                    % of Behaviours Worsened
                  </h5>
                  <HelpIcon
                    title="Behaviours Worsened"
                    content="Track the percentage of behaviours that have worsened. Enter the percentage value, change from previous period, and list of residents whose behaviours worsened."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Percentage Value
                    </label>
                    <input
                      type="number"
                      value={worsenedPercentage}
                      onChange={(e) => setWorsenedPercentage(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., 28"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Change (+ or -)
                    </label>
                    <input
                      type="number"
                      value={worsenedChange}
                      onChange={(e) => setWorsenedChange(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Resident Names (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={worsenedResidents}
                    onChange={(e) => setWorsenedResidents(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    placeholder="e.g., Sarah Wilson, Michael Brown"
                  />
                </div>
              </div>

              {/* Improved Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <h5 className="text-sm font-medium text-gray-700">
                    % of Behaviours Improved
                  </h5>
                  <HelpIcon
                    title="Behaviours Improved"
                    content="Track the percentage of behaviours that have improved. Enter the percentage value, change from previous period, and list of residents whose behaviours improved."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Percentage Value
                    </label>
                    <input
                      type="number"
                      value={improvedPercentage}
                      onChange={(e) => setImprovedPercentage(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., 57"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Change (+ or -)
                    </label>
                    <input
                      type="number"
                      value={improvedChange}
                      onChange={(e) => setImprovedChange(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                      placeholder="e.g., 8"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Resident Names (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={improvedResidents}
                    onChange={(e) => setImprovedResidents(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                    placeholder="e.g., David Miller, Jennifer Taylor"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center">
              <label
                htmlFor="home"
                className="block text-sm font-medium text-gray-700"
              >
                Select Home
              </label>
              <HelpIcon
                title="Select Home"
                content="Select the home (care facility) that these files and metrics belong to. The data will be associated with this home in the dashboard."
              />
            </div>
            <select
              id="home"
              name="home"
              value={selectedHome}
              onChange={(e) => setSelectedHome(e.target.value)}
              disabled={loadingHomes}
              className="mt-1 block w-full px-4 py-3 text-gray-900 border-gray-300 rounded-md shadow-sm text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={
                {
                  "--tw-ring-color": "#0cc7ed",
                  "--tw-border-color": "#0cc7ed",
                } as React.CSSProperties
              }
              onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = "#0cc7ed";
                (e.target as HTMLSelectElement).style.boxShadow =
                  "0 0 0 3px rgba(12, 199, 237, 0.1)";
              }}
              onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = "#d1d5db";
                (e.target as HTMLSelectElement).style.boxShadow = "none";
              }}
            >
              <option value="">
                {loadingHomes ? "Loading homes..." : "Select a home..."}
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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || loadingHomes || !selectedHome}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: "#0cc7ed" }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "#0aa8c7";
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "#0cc7ed";
                }
              }}
            >
              {loading ? "Processing..." : "Process Files"}
            </button>
          </div>

          {message && !showSuccess && (
            <div
              className={`text-sm ${message.includes("Error") ? "text-red-600" : message.includes("success") ? "text-green-600" : ""}`}
              style={
                !message.includes("Error") && !message.includes("success")
                  ? { color: "#06b6d4" }
                  : {}
              }
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
