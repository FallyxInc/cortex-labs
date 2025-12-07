import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { trackExportButtonClick } from '@/lib/mixpanel';

interface ExportPdfParams {
  tableRef: React.RefObject<HTMLElement>;
  name: string;
  altName: string;
  showFollowUpTable: boolean;
  followUpData: unknown[];
  filteredFollowUpData: unknown[];
  data: unknown[];
  desiredMonth: string;
  desiredYear: number;
  months_backword: Record<string, string>;
  exportClickCountRef: React.MutableRefObject<number>;
  dummyFollowUpData?: unknown[];
}

export const handleSavePDF = async ({
  tableRef,
  name,
  altName,
  showFollowUpTable,
  followUpData,
  filteredFollowUpData,
  data,
  desiredMonth,
  desiredYear,
  months_backword,
  exportClickCountRef,
  dummyFollowUpData = [],
}: ExportPdfParams) => {
  exportClickCountRef.current += 1;
  
  trackExportButtonClick({
    exportType: 'pdf',
    pageName: `dashboard_${name}`,
    section: showFollowUpTable ? 'follow_up' : 'overview',
    homeId: altName,
    dataType: showFollowUpTable ? 'follow_up' : 'behaviours',
    recordCount: showFollowUpTable 
      ? (followUpData.length > 0 ? filteredFollowUpData.length : dummyFollowUpData.length) 
      : data.length,
    clickCount: exportClickCountRef.current,
  });

  if (tableRef.current) {
    interface OriginalStyles {
      overflowX?: string;
      overflowY?: string;
      maxHeight?: string;
      [key: string]: unknown;
    }
    const originalStyles: OriginalStyles = {};
    const originalScrollTop = tableRef.current.scrollTop;
    
    const element = tableRef.current;
    originalStyles.overflowX = element.style.overflowX;
    originalStyles.overflowY = element.style.overflowY;
    originalStyles.maxHeight = element.style.maxHeight;
    
    const expandButtons = element.querySelectorAll('button');
    expandButtons.forEach(button => {
      const buttonText = button.textContent?.trim();
      if (buttonText === 'Show more') {
        button.click();
      }
    });
    
    const tableCells = element.querySelectorAll('td');
    const originalCellStyles: Array<{
      whiteSpace: string;
      overflow: string;
      textOverflow: string;
      maxHeight: string;
    }> = [];
    tableCells.forEach((cell, index) => {
      originalCellStyles[index] = {
        whiteSpace: cell.style.whiteSpace || '',
        overflow: cell.style.overflow || '',
        textOverflow: cell.style.textOverflow || '',
        maxHeight: cell.style.maxHeight || ''
      };
      cell.style.whiteSpace = 'normal';
      cell.style.overflow = 'visible';
      cell.style.textOverflow = 'clip';
      cell.style.maxHeight = 'none';
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    element.scrollTop = 0;
    
    element.style.overflowX = 'visible';
    element.style.overflowY = 'visible';
    element.style.maxHeight = 'none';
    
    element.querySelectorAll('table').forEach(table => {
      let container = table.parentElement;
      while (container && container !== element) {
        const computedStyle = window.getComputedStyle(container);
        const maxHeight = computedStyle.maxHeight;
        if (maxHeight && maxHeight !== 'none' && maxHeight !== '100%') {
          const key = `table-container-${container.offsetTop}-${container.offsetLeft}`;
          if (!originalStyles[key]) {
            originalStyles[key] = {
              element: container,
              maxHeight: container.style.maxHeight || '',
              overflowY: container.style.overflowY || '',
              overflowX: container.style.overflowX || ''
            };
            container.style.maxHeight = 'none';
            container.style.overflowY = 'visible';
            container.style.overflowX = 'visible';
          }
        }
        container = container.parentElement;
      }
    });
    
    const styleId = 'pdf-export-font-reduction';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = `
      #pdf-export-active table {
        font-size: 10pt !important;
      }
      #pdf-export-active th, #pdf-export-active td {
        font-size: 10pt !important;
        padding: 8px 12px !important;
      }
    `;
    
    const originalId = element.id;
    element.id = 'pdf-export-active';
    
    const selectElements = element.querySelectorAll('select');
    const originalSelectStyles: Array<{
      element: HTMLSelectElement;
      textAlign: string;
      textAlignLast: string;
      paddingTop: string;
    }> = [];
    selectElements.forEach((select) => {
      const computedStyle = window.getComputedStyle(select);
      originalSelectStyles.push({
        element: select,
        textAlign: select.style.textAlign || '',
        textAlignLast: select.style.textAlignLast || '',
        paddingTop: select.style.paddingTop || ''
      });
      select.style.textAlign = 'center';
      select.style.textAlignLast = 'center';
      const currentPaddingTop = parseFloat(computedStyle.paddingTop) || 0;
      select.style.paddingTop = `${currentPaddingTop - 2}px`;
    });
    
    const textElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, td, th');
    const originalTextStyles: Array<{
      element: HTMLElement;
      paddingTop: string;
    }> = [];
    textElements.forEach((el) => {
      if (el.tagName === 'BUTTON' || el.tagName === 'SELECT') return;
      
      const htmlEl = el as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlEl);
      const paddingTop = computedStyle.paddingTop;
      if (paddingTop && parseFloat(paddingTop) > 0) {
        originalTextStyles.push({
          element: htmlEl,
          paddingTop: htmlEl.style.paddingTop || ''
        });
        const currentPaddingTop = parseFloat(paddingTop);
        htmlEl.style.paddingTop = `${Math.max(0, currentPaddingTop - 1)}px`;
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4',
    });
    
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const totalHeight = element.scrollHeight;
    const totalWidth = element.scrollWidth;
    
    const widthScale = totalWidth > pageWidth ? pageWidth / totalWidth : 1;
    const scale = Math.min(2, widthScale * 2);
    
    const canvas = await html2canvas(element, {
      scale: scale,
      width: totalWidth,
      height: totalHeight,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let position = 0;

    while (position < imgHeight) {
      pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);

      position += pageHeight;

      if (position < imgHeight) {
        pdf.addPage();
      }
    }
    
    element.style.overflowX = (originalStyles.overflowX as string) || 'auto';
    element.style.overflowY = (originalStyles.overflowY as string) || 'auto';
    element.style.maxHeight = (originalStyles.maxHeight as string) || '';
    element.scrollTop = originalScrollTop;
    element.id = originalId || '';
    
    Object.keys(originalStyles).forEach(key => {
      if (key.startsWith('table-container-')) {
        const styleData = originalStyles[key] as {
          element?: HTMLElement;
          maxHeight?: string;
          overflowY?: string;
          overflowX?: string;
        };
        if (styleData.element) {
          styleData.element.style.maxHeight = styleData.maxHeight || '';
          styleData.element.style.overflowY = styleData.overflowY || '';
          styleData.element.style.overflowX = styleData.overflowX || '';
        }
      }
    });
    
    const restoredTableCells = element.querySelectorAll('td');
    restoredTableCells.forEach((cell, index) => {
      if (originalCellStyles[index]) {
        cell.style.whiteSpace = originalCellStyles[index].whiteSpace;
        cell.style.overflow = originalCellStyles[index].overflow;
        cell.style.textOverflow = originalCellStyles[index].textOverflow;
        cell.style.maxHeight = originalCellStyles[index].maxHeight;
      }
    });
    
    originalSelectStyles.forEach((selectStyle) => {
      if (selectStyle.element) {
        selectStyle.element.style.textAlign = selectStyle.textAlign;
        selectStyle.element.style.textAlignLast = selectStyle.textAlignLast;
        selectStyle.element.style.paddingTop = selectStyle.paddingTop;
      }
    });
    
    originalTextStyles.forEach((textStyle) => {
      if (textStyle.element) {
        textStyle.element.style.paddingTop = textStyle.paddingTop;
      }
    });
    
    if (styleElement) {
      styleElement.remove();
    }
    
    const monthNum = months_backword[desiredMonth];
    const filename = showFollowUpTable 
      ? `${name}_${desiredYear}_${monthNum}_follow_ups.pdf`
      : `${name}_${desiredYear}_${monthNum}_behaviours_data.pdf`;
    
    pdf.save(filename);
  }
};

