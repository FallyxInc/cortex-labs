import { getHomeDisplayNameAdmin, getHomeDisplayNamesAdmin } from "@/lib/homeMappings";
import { extractPdfPages } from "@/lib/utils/pdfUtils";
import { extractExcelText } from "@/lib/utils/excelUtils";

export async function verifyPdfs(pdfs: File[], home: string): Promise<{validity: boolean, message: string}> {
    // get home name
    const homeName = await getHomeDisplayNameAdmin(home);

    for (const pdf of pdfs) {

        // look for home names not in pdf
        const pagesText = await extractPdfPages(Buffer.from(await pdf.arrayBuffer()));
        if (!pagesText.some(text => text.toLowerCase().includes(homeName.toLowerCase()))) {
            const homeNames = await getHomeDisplayNamesAdmin();
            
            // find home names that actually are in the pdf
            const foundNames = homeNames.filter(name => pagesText.some(text => text.toLowerCase().includes(name.toLowerCase())));
            if (foundNames.length === 0) {
                return { validity: false, message: `PDF file ${pdf.name} does not contain the home name ${homeName}.` };
            } else {

                // merge duplicates and format
                const names = [...new Set(foundNames)].map(name => `"${name}"`);
                return { validity: false, message: `PDF file ${pdf.name} does not contain the home name ${homeName}. \n The home names ${names.join(", ")} were found instead.` };
            }
        }
    }
    return { validity: true, message: `PDF files contain the home name ${homeName}.` };
}

export async function verifyExcels(excels: File[], home: string): Promise<{validity: boolean, message: string}> {
    const homeName = await getHomeDisplayNameAdmin(home);

    for (const excel of excels) {
        const sheetsText = await extractExcelText(Buffer.from(await excel.arrayBuffer()));
        
        if (!sheetsText.some(text => text.toLowerCase().includes(homeName.toLowerCase()))) {
            const homeNames = await getHomeDisplayNamesAdmin();

            // find home names that actually are in the excel
            const foundNames = homeNames.filter(name => sheetsText.some(text => text.toLowerCase().includes(name.toLowerCase())));
            if (foundNames.length === 0) {
                return { validity: false, message: `Excel file ${excel.name} does not contain the home name ${homeName}.` };
            } else {
                // merge duplicates and format
                const names = [...new Set(foundNames)].map(name => `"${name}"`);
                return { validity: false, message: `Excel file ${excel.name} does not contain the home name ${homeName}. \n The home names ${names.join(", ")} were found instead.` };
            }
        }
    }
    return { validity: true, message: `Excel files contain the home name ${homeName}.` };
}