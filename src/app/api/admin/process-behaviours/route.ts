// New TypeScript-based behaviour processing route
// Replaces Python-based processing with native TypeScript

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, unlink, rm } from "fs/promises";
import { join } from "path";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { getFirebaseIdAsync, getHomeNameAsync } from "@/lib/homeMappings";
import { progressStore } from "../process-progress/route";
import { processExcelFiles } from "@/lib/processing/excelProcessor";
import { processPdfFiles } from "@/lib/processing/pdfProcessor";
import { processAllMergedFiles } from "@/lib/processing/behaviourGenerator";
import { processMergedCsvFiles } from "@/lib/processing/firebaseUpdate";
import { processCsvFiles } from "@/lib/processing/firebaseUpload";
import { getChainExtractionConfig } from "@/lib/utils/configUtils";

// Helper function to update progress
async function updateProgress(
  jobId: string,
  percentage: number,
  message: string,
  step: string,
) {
  progressStore.set(jobId, { percentage, message, step });
  console.log(`📊 [PROGRESS ${percentage}%] ${step}: ${message}`);
}

export async function POST(request: NextRequest) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(
    `🚀 [API] Starting behaviour files processing... Job ID: ${jobId}`,
  );

  await updateProgress(
    jobId,
    0,
    "Initializing file processing...",
    "initializing",
  );

  try {
    const formData = await request.formData();
    console.log("Read FormData");

    const home = formData.get("home") as string;
    const pdfCount = parseInt(formData.get("pdfCount") as string) || 0;
    const excelCount = parseInt(formData.get("excelCount") as string) || 0;

    // Get overview metrics
    const antipsychoticsPercentage = formData.get(
      "antipsychoticsPercentage",
    ) as string;
    const antipsychoticsChange = formData.get("antipsychoticsChange") as string;
    const antipsychoticsResidents = formData.get(
      "antipsychoticsResidents",
    ) as string;

    const worsenedPercentage = formData.get("worsenedPercentage") as string;
    const worsenedChange = formData.get("worsenedChange") as string;
    const worsenedResidents = formData.get("worsenedResidents") as string;

    const improvedPercentage = formData.get("improvedPercentage") as string;
    const improvedChange = formData.get("improvedChange") as string;
    const improvedResidents = formData.get("improvedResidents") as string;

    console.log("📊 [API] Request parameters:", {
      home,
      pdfCount,
      excelCount,
      hasMetrics: !!(
        antipsychoticsPercentage ||
        worsenedPercentage ||
        improvedPercentage
      ),
    });

    if (!home) {
      console.error("❌ [API] Missing home");
      await updateProgress(jobId, 0, "Error: Home is required", "error");
      return NextResponse.json(
        { error: "Home is required", jobId },
        { status: 400 },
      );
    }

    await updateProgress(
      jobId,
      2,
      "Validating home configuration...",
      "validating",
    );

    // Get extraction type from chain data
    let chainId: string | null = null;
    try {
      const homeRef = adminDb.ref(`/${home}`);
      const homeSnapshot = await homeRef.once("value");

      if (homeSnapshot.exists()) {
        const homeData = homeSnapshot.val();
        chainId = homeData.chainId;
      }
    } catch (error) {
      console.warn("⚠️ [API] Could not fetch chain info:", error);
    }

    if (chainId == undefined) {
      throw new Error("Chain ID not found");
    }

    const chainConfig = await getChainExtractionConfig(chainId);
    if (!chainConfig) {
      throw new Error(`Chain extraction config not found for ${chainId}`);
    }
    console.log("🔍 [API] Chain config found:", chainId, chainConfig);

    // If no files, we can still save metrics
    const hasFiles = pdfCount > 0 && excelCount > 0;
    const hasMetrics = !!(
      antipsychoticsPercentage ||
      worsenedPercentage ||
      improvedPercentage
    );

    // Save metrics to Firebase if provided
    if (hasMetrics) {
      await updateProgress(
        jobId,
        6,
        "Saving overview metrics to Firebase...",
        "saving_metrics",
      );
      const altName = await getFirebaseIdAsync(home);
      const metricsRef = adminDb.ref(`/${altName}/overviewMetrics`);

      const metricsData: Record<
        string,
        { percentage: number; change: number; residents: string[] }
      > = {};

      if (antipsychoticsPercentage) {
        metricsData.antipsychotics = {
          percentage: parseInt(antipsychoticsPercentage) || 0,
          change: parseInt(antipsychoticsChange || "0") || 0,
          residents: antipsychoticsResidents
            ? antipsychoticsResidents
                .split(",")
                .map((r) => r.trim())
                .filter((r) => r)
            : [],
        };
      }

      if (worsenedPercentage) {
        metricsData.worsened = {
          percentage: parseInt(worsenedPercentage) || 0,
          change: parseInt(worsenedChange || "0") || 0,
          residents: worsenedResidents
            ? worsenedResidents
                .split(",")
                .map((r) => r.trim())
                .filter((r) => r)
            : [],
        };
      }

      if (improvedPercentage) {
        metricsData.improved = {
          percentage: parseInt(improvedPercentage) || 0,
          change: parseInt(improvedChange || "0") || 0,
          residents: improvedResidents
            ? improvedResidents
                .split(",")
                .map((r) => r.trim())
                .filter((r) => r)
            : [],
        };
      }

      // Get existing metrics to preserve values not being updated
      const existingSnapshot = await metricsRef.once("value");
      const existingData = existingSnapshot.exists()
        ? existingSnapshot.val()
        : {};

      const mergedData = { ...existingData, ...metricsData };
      await metricsRef.set(mergedData);

      console.log("✅ [API] Metrics saved to Firebase");
      await updateProgress(
        jobId,
        8,
        "Metrics saved successfully",
        "metrics_saved",
      );
    }

    // If no files, return early after saving metrics
    if (!hasFiles) {
      await updateProgress(
        jobId,
        100,
        hasMetrics
          ? "Processing complete - metrics saved"
          : "No changes made - existing values preserved",
        "complete",
      );
      return NextResponse.json({
        success: true,
        message: hasMetrics
          ? "Metrics saved successfully"
          : "No changes made - existing values preserved",
        metricsSaved: hasMetrics,
        jobId,
      });
    }

    // Extract PDF and Excel files
    const pdfFiles: File[] = [];
    for (let i = 0; i < pdfCount; i++) {
      const file = formData.get(`pdf_${i}`) as File;
      if (file) {
        pdfFiles.push(file);
        console.log(`📄 [API] Extracted PDF file ${i}: ${file.name}`);
      }
    }

    const excelFiles: File[] = [];
    for (let i = 0; i < excelCount; i++) {
      const file = formData.get(`excel_${i}`) as File;
      if (file) {
        excelFiles.push(file);
        console.log(`📊 [API] Extracted Excel file ${i}: ${file.name}`);
      }
    }

    // Extract date from first file (PDF or Excel)
    let year: string | null = null;
    let month: string | null = null;
    let day: string | null = null;

    const firstFile = pdfFiles[0] || excelFiles[0];
    if (firstFile) {
      const dateMatch = firstFile.name.match(/(\d{2})-(\d{2})-(\d{4})/);
      if (dateMatch) {
        month = dateMatch[1];
        day = dateMatch[2];
        year = dateMatch[3];
        console.log(
          `📅 [API] Extracted date from filename: year=${year}, month=${month}, day=${day}`,
        );
      } else {
        console.warn(
          `⚠️ [API] Could not extract date from filename: ${firstFile.name}`,
        );
      }
    }

    // Set up directories
    const chain = "chains/" + chainId;
    const homeNameForPython = await getHomeNameAsync(home);
    const chainDir = join(process.cwd(), "files", chain);
    const downloadsDir = join(chainDir, "downloads");
    const analyzedDir = join(chainDir, "analyzed");

    console.log(
      `🏠 [API] Home mapping - UI: ${home}, Chain: ${chainId}, Home Name: ${homeNameForPython}`,
    );

    await updateProgress(
      jobId,
      10,
      "Creating directories...",
      "creating_directories",
    );
    await mkdir(downloadsDir, { recursive: true });
    await mkdir(analyzedDir, { recursive: true });

    await updateProgress(
      jobId,
      12,
      `Saving ${pdfFiles.length} PDF and ${excelFiles.length} Excel files...`,
      "saving_files",
    );

    const totalFiles = pdfFiles.length + excelFiles.length;
    let filesSaved = 0;

    // Clear downloads directory
    try {
      const existingFiles = await readdir(downloadsDir);
      for (const file of existingFiles) {
        await unlink(join(downloadsDir, file));
      }
      console.log(`✅ [API] Cleared ${existingFiles.length} existing file(s)`);
    } catch {
      console.log("ℹ️ [API] Downloads directory empty or doesn't exist yet");
    }

    // Clear analyzed directory recursively
    try {
      await rm(analyzedDir, { recursive: true, force: true });
      await mkdir(analyzedDir, { recursive: true });
      console.log(`✅ [API] Cleared analyzed directory recursively`);
    } catch {
      console.log("ℹ️ [API] Analyzed directory empty or doesn't exist yet");
    }

    // Save PDF files
    for (const file of pdfFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      filesSaved++;
      const progress = 12 + Math.floor((filesSaved / totalFiles) * 3);
      await updateProgress(
        jobId,
        progress,
        `Saved PDF: ${file.name}`,
        "saving_files",
      );
      console.log(`✅ [API] Saved PDF: ${file.name}`);
    }

    // Save Excel files
    for (const file of excelFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      filesSaved++;
      const progress = 12 + Math.floor((filesSaved / totalFiles) * 3);
      await updateProgress(
        jobId,
        progress,
        `Saved Excel: ${file.name}`,
        "saving_files",
      );
      console.log(`✅ [API] Saved Excel: ${file.name}`);
    }

    await updateProgress(
      jobId,
      15,
      "All files saved successfully",
      "files_saved",
    );

    // Process files using TypeScript processing functions directly
    // Validate that Claude API key is configured (functions use centralized config)
    const { getAIModelConfig } = await import("@/lib/claude-client");
    const aiConfig = getAIModelConfig();
    if (!aiConfig.apiKey) {
      throw new Error("CLAUDE_API_KEY or ANTHROPIC_API_KEY not found in environment variables");
    }
    // Keep apiKey parameter for backward compatibility (functions now use centralized config)
    const openaiApiKey = aiConfig.apiKey;

    console.log("🚀 [PROCESSOR] Starting behaviour files processing...");

    await updateProgress(
      jobId,
      12,
      "Directories prepared",
      "directories_ready",
    );

    // Step 1: Process Excel files
    await updateProgress(
      jobId,
      20,
      "Step 1: Processing Excel data...",
      "processing_excel",
    );
    console.log("📊 [EXCEL] Step 1: Processing Excel data...");
    const excelStartTime = Date.now();

    try {
      await updateProgress(
        jobId,
        22,
        "Executing Excel processing...",
        "processing_excel",
      );
      await processExcelFiles(downloadsDir, analyzedDir, chainId, chainConfig);
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        30,
        `Excel processing completed in ${excelDuration}s`,
        "excel_complete",
      );
      console.log(`✅ [EXCEL] Processing completed in ${excelDuration}s`);
    } catch (error) {
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        30,
        `Excel processing failed after ${excelDuration}s`,
        "error",
      );
      console.error(
        `❌ [EXCEL] Processing failed after ${excelDuration}s:`,
        error,
      );
      throw error;
    }

    // Step 2: Process PDF files
    await updateProgress(
      jobId,
      32,
      "Step 2: Processing PDF data...",
      "processing_pdf",
    );
    console.log("📄 [PDF] Step 2: Processing PDF data...");
    const pdfStartTime = Date.now();

    try {
      await updateProgress(
        jobId,
        40,
        "Extracting text from PDFs and processing with AI...",
        "processing_pdf",
      );
      await processPdfFiles(
        downloadsDir,
        analyzedDir,
        homeNameForPython,
        chainId,
        chainConfig,
      );
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      const pdfDurationMinutes = (parseFloat(pdfDuration) / 60).toFixed(2);
      await updateProgress(
        jobId,
        60,
        `PDF processing completed in ${pdfDuration}s (${pdfDurationMinutes} minutes)`,
        "pdf_complete",
      );
      console.log(
        `✅ [PDF] Processing completed in ${pdfDuration}s (${pdfDurationMinutes} minutes)`,
      );
    } catch (error) {
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        60,
        `PDF processing failed after ${pdfDuration}s`,
        "error",
      );
      console.error(`❌ [PDF] Processing failed after ${pdfDuration}s:`, error);
      throw error;
    }

    // Step 3: Generate behaviour data
    await updateProgress(
      jobId,
      62,
      "Step 3: Generating behaviour data...",
      "generating_behaviour",
    );
    console.log("🔄 [BEHAVIOUR] Step 3: Generating behaviour data...");
    const behaviourStartTime = Date.now();

    try {
      await updateProgress(
        jobId,
        65,
        "Executing behaviour data generation...",
        "generating_behaviour",
      );
      await processAllMergedFiles(
        analyzedDir,
        openaiApiKey,
        homeNameForPython,
        chainId,
        chainConfig,
      );
      const behaviourDuration = (
        (Date.now() - behaviourStartTime) /
        1000
      ).toFixed(2);
      await updateProgress(
        jobId,
        75,
        `Behaviour data generation completed in ${behaviourDuration}s`,
        "behaviour_complete",
      );
      console.log(
        `✅ [BEHAVIOUR] Data generation completed in ${behaviourDuration}s`,
      );
    } catch (error) {
      const behaviourDuration = (
        (Date.now() - behaviourStartTime) /
        1000
      ).toFixed(2);
      await updateProgress(
        jobId,
        75,
        `Behaviour data generation failed after ${behaviourDuration}s`,
        "error",
      );
      console.error(
        `❌ [BEHAVIOUR] Data generation failed after ${behaviourDuration}s:`,
        error,
      );
      throw error;
    }

    // Step 4: Update dashboard
    await updateProgress(
      jobId,
      77,
      "Step 4: Updating dashboard...",
      "updating_dashboard",
    );
    console.log("🔄 [UPDATE] Step 4: Updating dashboard...");
    const updateStartTime = Date.now();

    try {
      await updateProgress(
        jobId,
        80,
        "Executing dashboard update...",
        "updating_dashboard",
      );
      await processMergedCsvFiles(homeNameForPython, chainId);
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        90,
        `Dashboard updated successfully in ${updateDuration}s`,
        "dashboard_updated",
      );
      console.log(
        `✅ [UPDATE] Dashboard updated successfully in ${updateDuration}s`,
      );
    } catch (error) {
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        90,
        `Dashboard update failed after ${updateDuration}s`,
        "error",
      );
      console.error(
        `❌ [UPDATE] Dashboard update failed after ${updateDuration}s:`,
        error,
      );
      throw error;
    }

    // Step 5: Upload to dashboard
    await updateProgress(
      jobId,
      92,
      "Step 5: Uploading to dashboard...",
      "uploading_dashboard",
    );
    console.log("⬆️ [UPLOAD] Step 5: Uploading to dashboard...");
    const uploadStartTime = Date.now();

    try {
      await updateProgress(
        jobId,
        95,
        "Executing dashboard upload...",
        "uploading_dashboard",
      );
      await processCsvFiles(homeNameForPython, chainId);
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        100,
        `Processing completed successfully in ${uploadDuration}s!`,
        "complete",
      );
      console.log(
        `✅ [UPLOAD] Dashboard uploaded successfully in ${uploadDuration}s`,
      );
    } catch (error) {
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        100,
        `Dashboard upload failed after ${uploadDuration}s`,
        "error",
      );
      console.error(
        `❌ [UPLOAD] Dashboard upload failed after ${uploadDuration}s:`,
        error,
      );
      throw error;
    }

    console.log("🎉 [PROCESSOR] File processing completed successfully!");

    return NextResponse.json({
      success: true,
      message:
        "Files processed successfully" +
        (hasMetrics ? " and metrics saved" : ""),
      fileCounts: {
        pdfs: pdfFiles.length,
        excels: excelFiles.length,
      },
      metricsSaved: hasMetrics,
      jobId,
    });
  } catch (error) {
    console.error("Error processing files:", error);
    await updateProgress(
      jobId,
      0,
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error",
    );
    return NextResponse.json(
      {
        error: "Failed to process files",
        details: error instanceof Error ? error.message : "Unknown error",
        jobId,
      },
      { status: 500 },
    );
  }
}
