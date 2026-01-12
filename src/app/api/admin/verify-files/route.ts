import { NextRequest, NextResponse } from "next/server";
import { verifyPdfs, verifyExcels } from "@/lib/utils/verifyFiles";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File;
    const excelFile = formData.get("excel") as File;
    const home = formData.get("home") as string;

    if (!pdfFile && !excelFile) {
      return NextResponse.json(
        { validity: false, message: "PDF or Excel file is required" },
        { status: 400 }
      );
    }

    if (!home) {
      return NextResponse.json(
        { validity: false, message: "Home is required" },
        { status: 400 }
      );
    }

    let pdfResult;
    let excelResult;
    if (pdfFile) {
      pdfResult = await verifyPdfs([pdfFile], home);
    }
    if (excelFile) {
      excelResult = await verifyExcels([excelFile], home);
    }

    return NextResponse.json({ pdf: pdfResult || undefined, excel:excelResult || undefined });
  } catch (error) {
    console.error("Error verifying PDF:", error);
    return NextResponse.json(
      {
        validity: false,
        message: `Error verifying PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

