import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, stat, readdir, unlink, rm } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { adminDb } from "@/lib/firebase-admin";
import {
  getFirebaseIdAsync,
  getHomeNameAsync,
  validateHomeMappingAsync,
  getPythonDirName,
  getHomeName,
} from "@/lib/homeMappings";
import { progressStore } from "../process-progress/route";

const execAsync = promisify(exec);

const PYTHON_PATH = process.env.PYTHON_PATH || "python3";

// Cache zlib path to avoid repeated expensive searches
let cachedZlibPath: string | null = null;

async function getZlibPath(): Promise<string> {
  if (cachedZlibPath !== null) {
    return cachedZlibPath;
  }

  const findZlibCmd =
    'find /nix/store -name "libz.so.1" -exec dirname {} \\; 2>/dev/null | head -1';
  try {
    const { stdout } = await execAsync(findZlibCmd);
    cachedZlibPath = stdout.trim();
    console.log(`📚 [PYTHON] Found zlib at: ${cachedZlibPath}`);
  } catch {
    console.warn("⚠️ [PYTHON] Could not find zlib path, continuing without it");
    cachedZlibPath = "";
  }

  return cachedZlibPath;
}

// Helper function to update progress
async function updateProgress(
  jobId: string,
  percentage: number,
  message: string,
  step: string,
) {
  // Store progress in memory
  progressStore.set(jobId, { percentage, message, step });
  console.log(`📊 [PROGRESS ${percentage}%] ${step}: ${message}`);
}

// Helper function to execute Python script with live output streaming
async function execPythonWithLiveOutput(
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  // Get cached zlib path (only searches once)
  const zlibPath = await getZlibPath();

  // Set LD_LIBRARY_PATH with zlib location
  const env = {
    ...process.env,
    ...options.env,
    LD_LIBRARY_PATH: zlibPath
      ? `${zlibPath}:${process.env.LD_LIBRARY_PATH || ""}`
      : process.env.LD_LIBRARY_PATH || "",
  };

  const fullCommand = `cd ${options.cwd} && ${PYTHON_PATH} ${args.join(" ")}`;
  console.log("🐍 [PYTHON] Executing:", fullCommand);
  try {
    const { stdout, stderr } = await execAsync(fullCommand);
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
    return { stdout, stderr, code: 0 };
  } catch (error: unknown) {
    const errorObj = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const stdout = errorObj.stdout || "";
    const stderr = errorObj.stderr || "";
    console.log(stdout);
    console.error(stderr);
    throw new Error(
      `Process exited with code ${errorObj.code || 0}\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }
}

// Note: getAltName is no longer needed - we use getFirebaseIdAsync directly

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

    // Validate home mapping exists (check Firebase)
    // const validation = await validateHomeMappingAsync(home);
    // if (!validation.valid) {
    //   console.error(`❌ [API] Invalid home mapping for: ${home}`, validation.missing);
    //   await updateProgress(jobId, 0, `Error: Home mapping not configured properly. Missing: ${validation.missing?.join(', ')}`, 'error');
    //   return NextResponse.json({
    //     error: `Home mapping not configured properly. Missing: ${validation.missing?.join(', ')}. Please ensure the home was created through the admin UI.`,
    //     jobId
    //   }, { status: 400 });
    // }

    // await updateProgress(jobId, 5, 'Home validated successfully', 'validated');

    // Get extraction type from chain data
    let extractionType: string | null = null;
    let chainId: string | null = null;
    try {
      // const firebaseId = await getFirebaseIdAsync(home);
      const homeRef = adminDb.ref(`/${home}`);
      const homeSnapshot = await homeRef.once("value");

      if (homeSnapshot.exists()) {
        const homeData = homeSnapshot.val();
        chainId = homeData.chainId;

        if (chainId) {
          const chainRef = adminDb.ref(`/chains/${chainId}`);
          const chainSnapshot = await chainRef.once("value");

          if (chainSnapshot.exists()) {
            const chainData = chainSnapshot.val();
            extractionType = chainData.extractionType || null;
            console.log(
              `📋 [API] Chain: ${chainId}, Extraction Type: ${extractionType || "not set"}`,
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ [API] Could not fetch extraction type from chain:",
        error,
      );
    }
    if (chainId == undefined) {
      chainId = "responsive";
    }

    // If no files, we can still save metrics
    const hasFiles = pdfCount > 0 && excelCount > 0;
    const hasMetrics = !!(
      antipsychoticsPercentage ||
      worsenedPercentage ||
      improvedPercentage
    );

    // If no files and no metrics, that's okay - just return success (preserves existing values)
    if (!hasFiles && !hasMetrics) {
      await updateProgress(
        jobId,
        100,
        "No changes made - existing values preserved",
        "complete",
      );
      return NextResponse.json({
        success: true,
        message: "No changes made - existing values preserved",
        metricsSaved: false,
        jobId,
      });
    }

    // Save metrics to Firebase if provided (if not provided, existing values are preserved)
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

      // Merge existing data with new data (only update provided metrics)
      const mergedData = {
        ...existingData,
        ...metricsData,
      };

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
        "Processing complete - metrics saved",
        "complete",
      );
      return NextResponse.json({
        success: true,
        message: "Metrics saved successfully",
        metricsSaved: true,
        jobId,
      });
    }

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

    // Extract date from first file (PDF or Excel) - format: {home_name}_{month}-{day}-{year}
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

    // Get chain-based Python directory instead of individual home directory
    console.log("🏠 [API] Extraction type: ", extractionType);
    console.log("🏠 [API] Home: ", home);
    const chainPythonDir = "chains/" + chainId;
    const homeNameForPython = await getHomeNameAsync(home);
    const chainDir = join(process.cwd(), "python", chainPythonDir);
    const downloadsDir = join(chainDir, "downloads");

    console.log(
      `🏠 [API] Home mapping - UI: ${home}, Chain Python Dir: ${chainPythonDir}, Home Name: ${homeNameForPython}`,
    );

    await updateProgress(
      jobId,
      10,
      "Creating directories...",
      "creating_directories",
    );
    console.log(`🏠 [API] Creating directories for home: ${home}`);
    await mkdir(downloadsDir, { recursive: true });
    console.log("✅ [API] Directories created");

    await updateProgress(
      jobId,
      12,
      `Saving ${pdfFiles.length} PDF and ${excelFiles.length} Excel files...`,
      "saving_files",
    );
    console.log(
      `💾 [API] Saving ${pdfFiles.length} PDF files and ${excelFiles.length} Excel files`,
    );

    const totalFiles = pdfFiles.length + excelFiles.length;
    let filesSaved = 0;

    // Clear downloads directory before saving new files
    console.log("🧹 [API] Clearing downloads directory...");
    try {
      const existingFiles = await readdir(downloadsDir);
      for (const file of existingFiles) {
        await unlink(join(downloadsDir, file));
      }
      console.log(`✅ [API] Cleared ${existingFiles.length} existing file(s)`);
    } catch (err) {
      // Directory might not exist yet or be empty, which is fine
      console.log("ℹ️ [API] Downloads directory empty or doesn't exist yet");
    }

    // Clear analyze directory before processing
    console.log("🧹 [API] Clearing analyze directory...");
    const analyzeDir = join(chainDir, "analyzed");
    try {
      await mkdir(analyzeDir, { recursive: true });
      const existingAnalyzedFiles = await readdir(analyzeDir, {
        withFileTypes: true,
      });
      for (const entry of existingAnalyzedFiles) {
        const fullPath = join(analyzeDir, entry.name);
        if (entry.isDirectory()) {
          // Recursively remove directory
          await rm(fullPath, { recursive: true, force: true });
        } else {
          await unlink(fullPath);
        }
      }
      console.log(
        `✅ [API] Cleared ${existingAnalyzedFiles.length} item(s) from analyze directory`,
      );
    } catch (err) {
      console.log("ℹ️ [API] Analyze directory empty or doesn't exist yet");
    }

    for (const file of pdfFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      filesSaved++;
      const progress = 12 + Math.floor((filesSaved / totalFiles) * 3); // 12-15%
      await updateProgress(
        jobId,
        progress,
        `Saved PDF: ${file.name}`,
        "saving_files",
      );
      console.log(`✅ [API] Saved PDF: ${file.name}`);
    }

    for (const file of excelFiles) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = join(downloadsDir, file.name);
      await writeFile(path, Buffer.from(bytes));
      filesSaved++;
      const progress = 12 + Math.floor((filesSaved / totalFiles) * 3); // 12-15%
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
    console.log("✅ [API] All files saved successfully");

    // await updateProgress(jobId, 16, 'Installing required Python packages...', 'installing_packages');
    // console.log('🐍 [PYTHON] Installing required packages...');
    // try {
    //   await execAsync(`python3 -m pip install --user --break-system-packages pdfplumber openai pandas python-dotenv openpyxl httpx httpcore --upgrade`, {
    //     cwd: chainDir,
    //     env: { ...process.env, HOME_ID: homeNameForPython }
    //   });
    //   await updateProgress(jobId, 18, 'Packages installed successfully', 'packages_installed');
    //   console.log('✅ [PYTHON] Packages installed successfully');
    // } catch (pipErr) {
    //   await updateProgress(jobId, 18, 'Package installation completed (with warnings)', 'packages_installed');
    //   console.log('⚠️ [PYTHON] Package installation warning:', pipErr);
    // }

    await updateProgress(
      jobId,
      20,
      "Step 1: Processing Excel data...",
      "processing_excel",
    );
    console.log("🐍 [PYTHON] Step 1: Processing Excel data...");
    const excelStartTime = Date.now();
    try {
      // Check for Excel files before processing
      try {
        const excelFiles = await readdir(downloadsDir);
        const xlsFiles = excelFiles.filter(
          (f) => f.endsWith(".xls") || f.endsWith(".xlsx"),
        );
        await updateProgress(
          jobId,
          22,
          `Found ${xlsFiles.length} Excel file(s) to process`,
          "processing_excel",
        );
        console.log(
          `📋 [PYTHON] Found ${xlsFiles.length} Excel file(s) to process:`,
          xlsFiles,
        );
        for (const file of xlsFiles) {
          try {
            const filePath = join(downloadsDir, file);
            const stats = await stat(filePath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   📄 ${file} (${fileSizeMB} MB)`);
          } catch (err) {
            console.log(`   ⚠️ Could not get stats for ${file}`);
          }
        }
      } catch (err) {
        console.log("⚠️ [PYTHON] Could not list Excel files:", err);
      }

      await updateProgress(
        jobId,
        25,
        "Executing Excel processing script...",
        "processing_excel",
      );
      console.log(
        `🔧 [PYTHON] Executing: python3 getExcelInfo.py ${homeNameForPython}`,
      );
      console.log(`📁 [PYTHON] Working directory: ${chainDir}`);
      console.log(`🏠 [PYTHON] Home ID: ${homeNameForPython}`);

      const excelResult = await execPythonWithLiveOutput(
        ["getExcelInfo.py", homeNameForPython],
        {
          cwd: chainDir,
          env: { ...process.env, HOME_ID: homeNameForPython },
        },
      );
      console.log("=".repeat(80));
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        30,
        `Excel processing completed in ${excelDuration}s`,
        "excel_complete",
      );
      console.log(
        `✅ [PYTHON] Excel processing completed in ${excelDuration}s`,
      );
      console.log("📊 [PYTHON] Excel output:", excelResult.stdout);
      if (excelResult.stderr) {
        console.log("⚠️ [PYTHON] Excel warnings:", excelResult.stderr);
      }
    } catch (error) {
      const excelDuration = ((Date.now() - excelStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        30,
        `Excel processing failed after ${excelDuration}s`,
        "error",
      );
      console.error(
        `❌ [PYTHON] Excel processing failed after ${excelDuration}s:`,
        error,
      );
      if (error instanceof Error) {
        console.error("❌ [PYTHON] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }

    await updateProgress(
      jobId,
      32,
      "Step 2: Processing PDF data...",
      "processing_pdf",
    );
    console.log("🐍 [PYTHON] Step 2: Processing PDF data...");
    const pdfStartTime = Date.now();
    try {
      // Check for PDF files before processing
      try {
        const pdfFiles = await readdir(downloadsDir);
        const pdfFileList = pdfFiles.filter((f) => f.endsWith(".pdf"));
        let totalSizeMB = 0;
        for (const file of pdfFileList) {
          try {
            const filePath = join(downloadsDir, file);
            const stats = await stat(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            totalSizeMB += fileSizeMB;
            console.log(`   📄 ${file} (${fileSizeMB.toFixed(2)} MB)`);
          } catch (err) {
            console.log(`   ⚠️ Could not get stats for ${file}`);
          }
        }
        await updateProgress(
          jobId,
          35,
          `Found ${pdfFileList.length} PDF file(s), total size: ${totalSizeMB.toFixed(2)} MB`,
          "processing_pdf",
        );
        console.log(
          `📋 [PYTHON] Found ${pdfFileList.length} PDF file(s) to process:`,
          pdfFileList,
        );
        console.log(`📊 [PYTHON] Total PDF size: ${totalSizeMB.toFixed(2)} MB`);
        console.log(
          `⏱️ [PYTHON] PDF processing can take 1-5 minutes per MB depending on content complexity...`,
        );
      } catch (err) {
        console.log("⚠️ [PYTHON] Could not list PDF files:", err);
      }

      await updateProgress(
        jobId,
        40,
        "Extracting text from PDFs and processing with AI...",
        "processing_pdf",
      );
      console.log(
        `🔧 [PYTHON] Executing: python3 getPdfInfo.py ${homeNameForPython}`,
      );
      console.log(`📁 [PYTHON] Working directory: ${chainDir}`);
      console.log(`🏠 [PYTHON] Home ID: ${homeNameForPython}`);
      console.log(
        `⏳ [PYTHON] Starting PDF processing at ${new Date().toISOString()}...`,
      );
      console.log(
        `💡 [PYTHON] This step involves text extraction and AI processing, which can take several minutes...`,
      );

      const pdfResult = await execPythonWithLiveOutput(
        ["getPdfInfo.py", homeNameForPython],
        {
          cwd: chainDir,
          env: { ...process.env, HOME_ID: homeNameForPython },
        },
      );
      console.log("=".repeat(80));
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      const pdfDurationMinutes = (parseFloat(pdfDuration) / 60).toFixed(2);
      await updateProgress(
        jobId,
        60,
        `PDF processing completed in ${pdfDuration}s (${pdfDurationMinutes} minutes)`,
        "pdf_complete",
      );
      console.log(
        `✅ [PYTHON] PDF processing completed in ${pdfDuration}s (${pdfDurationMinutes} minutes)`,
      );
      console.log(
        `📊 [PYTHON] PDF output (first 1000 chars):`,
        pdfResult.stdout.substring(0, 1000),
      );
      if (pdfResult.stdout.length > 1000) {
        console.log(
          `📊 [PYTHON] ... (output truncated, total length: ${pdfResult.stdout.length} chars)`,
        );
      }
      if (pdfResult.stderr) {
        console.log("⚠️ [PYTHON] PDF warnings/stderr:", pdfResult.stderr);
      }
    } catch (error) {
      const pdfDuration = ((Date.now() - pdfStartTime) / 1000).toFixed(2);
      const pdfDurationMinutes = (parseFloat(pdfDuration) / 60).toFixed(2);
      await updateProgress(
        jobId,
        60,
        `PDF processing failed after ${pdfDuration}s`,
        "error",
      );
      console.error(
        `❌ [PYTHON] PDF processing failed after ${pdfDuration}s (${pdfDurationMinutes} minutes)`,
      );
      if (error instanceof Error) {
        console.error("❌ [PYTHON] Error details:", {
          message: error.message,
          stack: error.stack,
        });
        // Check if it's a timeout or process issue
        if (
          error.message.includes("killed") ||
          error.message.includes("SIGTERM")
        ) {
          console.error(
            "❌ [PYTHON] Process was killed - possible timeout or resource issue",
          );
        }
        if (error.message.includes("ENOENT")) {
          console.error(
            "❌ [PYTHON] File or directory not found - check Python script path",
          );
        }
      }
      throw error;
    }

    await updateProgress(
      jobId,
      62,
      "Step 3: Generating behaviour data...",
      "generating_behaviour",
    );
    console.log("🐍 [PYTHON] Step 3: Generating behaviour data...");
    const behaviourStartTime = Date.now();
    try {
      await updateProgress(
        jobId,
        65,
        "Executing behaviour data generation script...",
        "generating_behaviour",
      );
      console.log(
        `🔧 [PYTHON] Executing: python3 getBe.py ${homeNameForPython}`,
      );

      const behaviourResult = await execPythonWithLiveOutput(
        ["getBe.py", homeNameForPython],
        {
          cwd: chainDir,
          env: { ...process.env, HOME_ID: homeNameForPython },
        },
      );
      console.log("=".repeat(80));
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
        `✅ [PYTHON] Behaviour data generation completed in ${behaviourDuration}s`,
      );
      console.log("📊 [PYTHON] Behaviour output:", behaviourResult.stdout);
      if (behaviourResult.stderr) {
        console.log("⚠️ [PYTHON] Behaviour warnings:", behaviourResult.stderr);
      }
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
        `❌ [PYTHON] Behaviour data generation failed after ${behaviourDuration}s:`,
        error,
      );
      if (error instanceof Error) {
        console.error("❌ [PYTHON] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }

    await updateProgress(
      jobId,
      77,
      "Step 4: Updating dashboard...",
      "updating_dashboard",
    );
    console.log("🐍 [PYTHON] Step 4: Updating dashboard...");
    const updateStartTime = Date.now();
    try {
      await updateProgress(
        jobId,
        80,
        "Executing dashboard update script...",
        "updating_dashboard",
      );
      const updateArgs =
        year && month && day
          ? ["update.py", homeNameForPython, year, month, day]
          : ["update.py", homeNameForPython];
      console.log(`🔧 [PYTHON] Executing: python3 ${updateArgs.join(" ")}`);

      const dashboardResult = await execPythonWithLiveOutput(updateArgs, {
        cwd: chainDir,
        env: { ...process.env, HOME_ID: homeNameForPython },
      });
      console.log("=".repeat(80));
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        90,
        `Dashboard updated successfully in ${updateDuration}s`,
        "dashboard_updated",
      );
      console.log(
        `✅ [PYTHON] Dashboard updated successfully in ${updateDuration}s`,
      );
      console.log("📊 [PYTHON] Dashboard output:", dashboardResult.stdout);
      if (dashboardResult.stderr) {
        console.log("⚠️ [PYTHON] Dashboard warnings:", dashboardResult.stderr);
      }
    } catch (error) {
      const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        90,
        `Dashboard update failed after ${updateDuration}s`,
        "error",
      );
      console.error(
        `❌ [PYTHON] Dashboard update failed after ${updateDuration}s:`,
        error,
      );
      if (error instanceof Error) {
        console.error("❌ [PYTHON] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }

    await updateProgress(
      jobId,
      92,
      "Step 5: Uploading to dashboard...",
      "uploading_dashboard",
    );
    console.log("🐍 [PYTHON] Step 5: Uploading to dashboard...");
    const uploadStartTime = Date.now();
    try {
      await updateProgress(
        jobId,
        95,
        "Executing dashboard upload script...",
        "uploading_dashboard",
      );
      const uploadArgs =
        year && month && day
          ? ["upload_to_dashboard.py", homeNameForPython, year, month, day]
          : ["upload_to_dashboard.py", homeNameForPython];
      console.log(`🔧 [PYTHON] Executing: python3 ${uploadArgs.join(" ")}`);

      const uploadResult = await execPythonWithLiveOutput(uploadArgs, {
        cwd: chainDir,
        env: { ...process.env, HOME_ID: homeNameForPython },
      });
      console.log("=".repeat(80));
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        100,
        `Processing completed successfully in ${uploadDuration}s!`,
        "complete",
      );
      console.log(
        `✅ [PYTHON] Dashboard uploaded successfully in ${uploadDuration}s`,
      );
      console.log("📊 [PYTHON] Dashboard output:", uploadResult.stdout);
      if (uploadResult.stderr) {
        console.log("⚠️ [PYTHON] Dashboard warnings:", uploadResult.stderr);
      }
    } catch (error) {
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      await updateProgress(
        jobId,
        100,
        `Dashboard upload failed after ${uploadDuration}s`,
        "error",
      );
      console.error(
        `❌ [PYTHON] Dashboard upload failed after ${uploadDuration}s:`,
        error,
      );
      if (error instanceof Error) {
        console.error("❌ [PYTHON] Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }

    console.log("🎉 [API] File processing completed successfully!");

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
    const jobId =
      (error as unknown as { jobId: string })?.jobId || `job_${Date.now()}`;
    await updateProgress(
      jobId,
      0,
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error",
    ).catch((error: unknown) => {
      console.error("Error updating progress:", error);
    });
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
