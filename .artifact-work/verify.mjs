import { SpreadsheetFile } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
const p = 'C:/Users/User/Documents/GitHub/amnhmb/rimstackle/outputs/01a0f2cd-bec8-7f11-82fc-0ef38ba66bfe/rimstackle-product-template-fixed.xlsx';
const wb = await SpreadsheetFile.importXlsx(await fs.readFile(p));
console.log(wb.worksheets.items.map(s => s.name).join(','));
