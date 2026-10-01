import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'C:/Users/User/Documents/GitHub/amnhmb/rimstackle/outputs/01a0f2cd-bec8-7f11-82fc-0ef38ba66bfe';
await fs.mkdir(outputDir, { recursive: true });
const wb = Workbook.create();
const form = wb.worksheets.add('Mobile Form');
const products = wb.worksheets.add('Bulk Import');
const config = wb.worksheets.add('Config');
products.showGridLines = false;
config.showGridLines = false;

const brandRows = [['Brand', 'Short form'], ['Shimano', 'SHI'], ['Daiwa', 'DAI'], ['Megabass', 'MEG'], ['Abu Garcia', 'ABU'], ['Jackall', 'JAC'], ['Evergreen', 'EVE'], ['Others', 'OTH']];
const locationRows = [['Bandar', 'Bahagian', 'Kod', 'Kedai'], ['Tokyo', 'Tokyo 03', 'TKY03', 'Kedai Shibuya'], ['Tokyo', 'Tokyo 03', 'TKY03', 'Kedai Ueno'], ['Osaka', 'Osaka 02', 'OSK02', 'Kedai Namba'], ['Osaka', 'Osaka 02', 'OSK02', 'Kedai Umeda']];
const categoryRows = [['Kategori'], ['Reel'], ['Rod'], ['Lure'], ['Accessories'], ['Spare part']];
const conditionRows = [['Kondisi'], ['Baru'], ['Seperti baru'], ['Terpakai'], ['Vintage']];
const statusRows = [['Status'], ['DRAFT'], ['AVAILABLE'], ['RESERVED'], ['SOLD'], ['EXPIRED']];

config.getRange('A1:B8').values = brandRows;
config.getRange('D1:G5').values = locationRows;
config.getRange('I1:I6').values = categoryRows;
config.getRange('K1:K5').values = conditionRows;
config.getRange('M1:M6').values = statusRows;
for (const header of ['A1:B1', 'D1:G1', 'I1:I1', 'K1:K1', 'M1:M1']) {
  const range = config.getRange(header);
  range.format.fill = '#17352B';
  range.format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
}
config.getRange('A1:M8').format.font = { name: 'Arial', size: 10, color: '#242A26' };
config.getRange('A1:M8').format.verticalAlignment = 'center';
config.getRange('A1:M8').format.borders = { preset: 'all', style: 'thin', color: '#D9DED8' };
config.getRange('A1:A8').format.columnWidth = 18;
config.getRange('B1:B8').format.columnWidth = 14;
config.getRange('D1:G5').format.columnWidth = 18;
config.getRange('I1:I6').format.columnWidth = 16;
config.getRange('K1:K5').format.columnWidth = 16;
config.getRange('M1:M6').format.columnWidth = 16;

form.showGridLines = false;
form.mergeCells('A1:D1');
form.getRange('A1').values = [['RIMSTACKLE · BORANG PRODUK']];
form.getRange('A1:D1').format.font = { name: 'Arial', size: 16, bold: true, color: '#17352B' };
form.getRange('A1:D1').format.rowHeight = 28;
form.mergeCells('A2:D2');
form.getRange('A2').values = [['Isi ruang kuning. Product ID akan dijana automatik selepas Tempat, Brand dan Nombor ID diisi.']];
form.getRange('A2:D2').format.font = { name: 'Arial', size: 10, italic: true, color: '#5C655F' };
form.getRange('A2:D2').format.wrapText = true;
form.getRange('A2:D2').format.rowHeight = 30;
form.getRange('A4:C4').values = [['Medan', 'Isi', 'Nota']];
form.getRange('A4:C4').format.fill = '#17352B';
form.getRange('A4:C4').format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
form.getRange('A5:C21').values = [
  ['Product ID', null, 'Auto daripada tempat + brand + nombor'],
  ['Kod tempat / bahagian', 'TKY03', 'Contoh: TKY03'],
  ['Brand', 'Shimano', 'Pilih daripada senarai'],
  ['Nombor ID', '0125', 'Isi nombor manual'],
  ['Short form brand', null, 'Auto daripada Config'],
  ['Model', 'Antares DC MD', 'Nama model'],
  ['Kategori', 'Reel', 'Pilih kategori'],
  ['Harga jualan (RM)', 1850, 'Nombor sahaja'],
  ['Kedai', 'Kedai Shibuya', 'Pilih kedai'],
  ['Subtajuk', 'Baitcasting · Pemegang kanan', 'Paparan ringkas pada card'],
  ['Harga kedai Jepun (¥)', null, 'Pilihan'],
  ['Kondisi', 'Terpakai', 'Pilih kondisi'],
  ['Skor kondisi', 8, '1 hingga 10'],
  ['Status', 'AVAILABLE', 'Pilih status'],
  ['Weekly Drop', 'drop-0007', 'ID drop'],
  ['Butiran produk', 'Contoh produk untuk rujukan.', 'Penerangan panjang'],
  ['Gambar', null, 'URL gambar, pisahkan dengan |'],
];
form.getRange('A5:C21').format.font = { name: 'Arial', size: 10, color: '#242A26' };
form.getRange('A5:A21').format.font = { name: 'Arial', size: 10, bold: true, color: '#17352B' };
form.getRange('B5:B21').format.fill = '#FFF4CC';
form.getRange('C5:C21').format.font = { name: 'Arial', size: 9, italic: true, color: '#5C655F' };
form.getRange('A5:C21').format.borders = { insideHorizontal: { style: 'thin', color: '#E1E6E0' }, bottom: { style: 'thin', color: '#E1E6E0' } };
form.getRange('B5').formulas = [['=IF(OR(B6="",B9="",B8=""),"",UPPER(B6)&"-"&UPPER(B9)&"-"&B8)']];
form.getRange('B9').formulas = [['=IFERROR(VLOOKUP(B7,Config!$A$2:$B$8,2,FALSE),"")']];
form.getRange('B5').format.fill = '#E4F0E7';
form.getRange('B5').format.font = { name: 'Arial', size: 11, bold: true, color: '#17352B' };
form.getRange('B12').format.numberFormat = '"RM"#,##0.00';
form.getRange('B15').format.numberFormat = '"¥"#,##0';
form.getRange('B17').format.numberFormat = '0';
form.getRange('B8').format.numberFormat = '@';
form.getRange('B6').dataValidation = { rule: { type: 'list', formula1: 'Config!$F$2:$F$5' } };
form.getRange('B7').dataValidation = { rule: { type: 'list', formula1: 'Config!$A$2:$A$8' } };
form.getRange('B11').dataValidation = { rule: { type: 'list', formula1: 'Config!$I$2:$I$6' } };
form.getRange('B13').dataValidation = { rule: { type: 'list', formula1: 'Config!$G$2:$G$5' } };
form.getRange('B16').dataValidation = { rule: { type: 'list', formula1: 'Config!$K$2:$K$5' } };
form.getRange('B18').dataValidation = { rule: { type: 'list', formula1: 'Config!$M$2:$M$6' } };
form.getRange('B17').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 1, formula2: 10 } };
form.getRange('A23:D23').merge();
form.getRange('A23').values = [['Untuk import banyak produk, guna sheet Bulk Import. Selepas siap, simpan sheet itu sebagai CSV UTF-8.']];
form.getRange('A23:D23').format.fill = '#E4F0E7';
form.getRange('A23:D23').format.font = { name: 'Arial', size: 10, italic: true, color: '#17352B' };
form.getRange('A1:A23').format.columnWidth = 25;
form.getRange('B1:B23').format.columnWidth = 34;
form.getRange('C1:C23').format.columnWidth = 34;
form.getRange('D1:D23').format.columnWidth = 4;

products.mergeCells('A1:Q1');
products.getRange('A1').values = [['RIMSTACKLE · TEMPLATE IMPORT PRODUK']];
products.getRange('A1:Q1').format.font = { name: 'Arial', size: 16, bold: true, color: '#17352B' };
products.getRange('A1:Q1').format.rowHeight = 28;
products.mergeCells('A2:Q2');
products.getRange('A2').values = [['Isi ruang kuning. Product ID dijana automatik daripada Kod tempat + Short form brand + Nombor ID. Jangan ubah nama header.']];
products.getRange('A2:Q2').format.font = { name: 'Arial', size: 10, italic: true, color: '#5C655F' };
products.getRange('A2:Q2').format.wrapText = true;
products.getRange('A2:Q2').format.rowHeight = 30;
products.getRange('A4:Q4').values = [['product_id', 'location_code', 'brand', 'brand_code', 'id_number', 'model', 'category', 'price', 'store', 'subtitle', 'japan_price', 'condition', 'grade', 'status', 'drop_id', 'description', 'images']];
products.getRange('A4:Q4').format.fill = '#17352B';
products.getRange('A4:Q4').format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
products.getRange('A4:Q4').format.wrapText = true;
products.getRange('A4:Q4').format.rowHeight = 30;
products.getRange('A5:Q5').values = [['TKY03-SHI-0125', 'TKY03', 'Shimano', 'SHI', '0125', 'Antares DC MD', 'Reel', 1850, 'Kedai Shibuya', 'Baitcasting · Pemegang kanan', null, 'Terpakai', 8, 'AVAILABLE', 'drop-0007', 'Contoh produk untuk rujukan.', '']];
products.getRange('A5:Q5').format.fill = '#FFF4CC';
products.getRange('A5:Q5').format.font = { name: 'Arial', size: 10, color: '#242A26' };
products.getRange('A5:Q5').format.wrapText = true;
products.getRange('A5:Q5').format.rowHeight = 34;
products.getRange('A5:Q105').format.font = { name: 'Arial', size: 10, color: '#242A26' };
products.getRange('A5:Q105').format.verticalAlignment = 'center';
products.getRange('A5:Q105').format.borders = { insideHorizontal: { style: 'thin', color: '#E1E6E0' }, bottom: { style: 'thin', color: '#E1E6E0' } };
products.getRange('B5:C105').format.fill = '#FFF4CC';
products.getRange('E5:E105').format.fill = '#FFF4CC';
products.getRange('F5:Q105').format.fill = '#FFF4CC';
products.getRange('D5').formulasR1C1 = [['=IFERROR(VLOOKUP(RC[-1],Config!R2C1:R8C2,2,FALSE),"")']];
products.getRange('D5:D105').fillDown();
products.getRange('A5').formulasR1C1 = [['=IF(OR(RC[1]="",RC[3]="",RC[4]=""),"",UPPER(RC[1])&"-"&UPPER(RC[3])&"-"&RC[4])']];
products.getRange('A5:A105').fillDown();
products.getRange('H5:H105').format.numberFormat = '"RM"#,##0.00';
products.getRange('K5:K105').format.numberFormat = '"¥"#,##0';
products.getRange('M5:M105').format.numberFormat = '0';
products.getRange('E5:E105').format.numberFormat = '@';
products.getRange('B5:B105').dataValidation = { rule: { type: 'list', formula1: 'Config!$F$2:$F$5' } };
products.getRange('C5:C105').dataValidation = { rule: { type: 'list', formula1: 'Config!$A$2:$A$8' } };
products.getRange('G5:G105').dataValidation = { rule: { type: 'list', formula1: 'Config!$I$2:$I$6' } };
products.getRange('I5:I105').dataValidation = { rule: { type: 'list', formula1: 'Config!$G$2:$G$5' } };
products.getRange('L5:L105').dataValidation = { rule: { type: 'list', formula1: 'Config!$K$2:$K$5' } };
products.getRange('N5:N105').dataValidation = { rule: { type: 'list', formula1: 'Config!$M$2:$M$6' } };
products.getRange('M5:M105').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 1, formula2: 10 } };
products.freezePanes.freezeRows(4);
const widths = { A: 20, B: 15, C: 16, D: 12, E: 12, F: 24, G: 16, H: 13, I: 18, J: 30, K: 14, L: 14, M: 10, N: 14, O: 14, P: 36, Q: 24 };
for (const [column, width] of Object.entries(widths)) products.getRange(`${column}1:${column}105`).format.columnWidth = width;

wb.recalculate();
const check = await wb.inspect({ kind: 'table', sheetId: 'Bulk Import', range: 'A1:Q8', include: 'values,formulas', tableMaxRows: 8, tableMaxCols: 17, maxChars: 4000 });
console.log(check.ndjson);
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(`${outputDir}/rimstackle-product-template-fixed.xlsx`);
