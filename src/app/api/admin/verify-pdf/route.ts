import { NextRequest, NextResponse } from "next/server";
import { verifyPdfs } from "@/lib/utils/verifyPdfs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File;
    const home = formData.get("home") as string;

    if (!pdfFile) {
      return NextResponse.json(
        { validity: false, message: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!home) {
      return NextResponse.json(
        { validity: false, message: "Home is required" },
        { status: 400 }
      );
    }

    const result = await verifyPdfs([pdfFile], home);
    return NextResponse.json(result);
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

