import { getHomeDisplayNameAdmin, getHomeDisplayNamesAdmin, getHomeName, getHomeNameAdmin } from "@/lib/homeMappings";
import { extractPdfPages } from "@/lib/utils/pdfUtils";

type VerifyBehaviourPdfsResult = {
    validity: boolean;
    message: string;
}
type VerifyBehaviourExcelsResult = {
    validity: boolean;
    message: string;
}

export async function verifyPdfs(pdfs: File[], home: string): Promise<VerifyBehaviourPdfsResult> {
    // get home name
    const homeName = await getHomeDisplayNameAdmin(home);

    for (const pdf of pdfs) {
        // process pdf
        const pagesText = await extractPdfPages(Buffer.from(await pdf.arrayBuffer()));
        if (!pagesText.some(text => text.toLowerCase().includes(homeName.toLowerCase()))) {
            // find what home name it does contain?
            const homeNames = await getHomeDisplayNamesAdmin();
            // console.log(`Home names: ${homeNames}`);
            const foundNames = homeNames.filter(name => pagesText.some(text => text.toLowerCase().includes(name.toLowerCase())));
            if (foundNames.length === 0) {
                return { validity: false, message: `PDF file ${pdf.name} does not contain the home name ${homeName}.` };
            } else {
                // merge duplicates
                const names = [...new Set(foundNames)].map(name => `"${name}"`);
                return { validity: false, message: `PDF file ${pdf.name} does not contain the home name ${homeName}. \n The home names ${names.join(", ")} were found instead.` };
            }
        }
    }
    return { validity: true, message: `PDF files contain the home name ${homeName}.` };
}

export async function verifyBehaviourExcels(excels: File[], home: string): Promise<VerifyBehaviourExcelsResult> {
    // get home name
    const homeName = await getHomeName(home);
  for (const excel of excels) {
    if (!excel.name.includes(home)) {
      return { validity: false, message: `Excel file ${excel.name} does not contain the home name ${homeName}.` };
    }
  }
  return { validity: false, message: `Excel files do not contain the home name ${homeName}.` };
}