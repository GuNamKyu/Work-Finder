import * as XLSX from 'xlsx';

export interface OrganizationInfo {
  id: string;
  orgName: string;
  url: string;
}

export const parseExcelFile = async (file: File): Promise<OrganizationInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("파일을 읽을 수 없습니다.");

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays to find headers intelligently
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length === 0) {
          resolve([]);
          return;
        }

        const orgs: OrganizationInfo[] = [];
        
        // Find which column is name and which is URL by looking at the first row (headers)
        let nameColIdx = -1;
        let urlColIdx = -1;

        // Try to identify headers from the first few rows (sometimes headers are not perfectly on row 0)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;

          row.forEach((cell, idx) => {
            if (typeof cell !== 'string') return;
            const normalized = cell.trim().toLowerCase();
            if (normalized.includes('이름') || normalized.includes('기관') || normalized.includes('회사') || normalized.includes('부서')) {
              nameColIdx = idx;
            }
            if (normalized.includes('링크') || normalized.includes('url') || normalized.includes('홈페이지') || normalized.includes('웹사이트')) {
              urlColIdx = idx;
            }
          });

          if (nameColIdx !== -1 && urlColIdx !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        // If we couldn't confidently find headers, assume column 0 is name and column 1 is url for simplicity
        if (nameColIdx === -1) nameColIdx = 0;
        // It's possible there is no URL column, but instead links are embedded in the name column
        // We will handle this case during extraction

        // Extract data
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;

          const rowOrgs = [];

          let primaryName = row[nameColIdx]?.toString().trim() || "";
          let primaryUrl = "";
          
          if (urlColIdx !== -1 && row[urlColIdx]) {
              primaryUrl = row[urlColIdx].toString().trim();
          }

          // Scan all cells up to 20 for hyperlinks
          for (let c = 0; c < 20; c++) {
              const cellAddress = XLSX.utils.encode_cell({ r: i, c: c });
              const cell = worksheet[cellAddress];
              
              if (cell && cell.l && cell.l.Target) {
                  const linkUrl = cell.l.Target.toString().trim();
                  let linkName = cell.v ? cell.v.toString().trim() : primaryName;
                  
                  if (c === nameColIdx || c === urlColIdx) {
                      primaryUrl = linkUrl;
                  } else {
                      // Completely separate cell with hyperlink - create a new org if valid name
                      if (linkName && linkName !== primaryName && Number.isNaN(Number(linkName))) {
                          rowOrgs.push({
                              id: `${i}-${c}-${linkName.substring(0, 10)}`,
                              orgName: linkName,
                              url: linkUrl
                          });
                      } else if (!primaryUrl) {
                          // If there's a link but it doesn't have a distinct name, assume it's the primary org's link
                          primaryUrl = linkUrl;
                      }
                  }
              }
          }

          // Add primary if valid
          if (primaryName && primaryUrl) {
              if (Number.isNaN(Number(primaryName)) && primaryName.length >= 2) {
                  rowOrgs.push({
                      id: `${i}-primary-${primaryName.substring(0, 10)}`,
                      orgName: primaryName,
                      url: primaryUrl
                  });
              }
          }

          rowOrgs.forEach(o => {
              let finalUrl = o.url;
              if (finalUrl.includes('.') || finalUrl.includes('http')) {
                  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                      finalUrl = `http://${finalUrl}`;
                  }
                  orgs.push({
                      id: o.id,
                      orgName: o.orgName,
                      url: finalUrl
                  });
              }
          });
        }

        resolve(orgs);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
};
