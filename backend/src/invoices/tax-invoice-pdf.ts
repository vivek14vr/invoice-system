import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

type SettingsMap = Record<string, string>;

type PdfClient = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  country?: string | null;
  vatGstNumber?: string | null;
};

type PdfItem = {
  name: string;
  description?: string | null;
  hsnSac?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
};

type PdfInvoice = {
  invoiceNumber: string;
  isCreditNote?: boolean;
  taxType: 'INTRA_STATE' | 'INTER_STATE';
  issueDate: Date;
  dueDate?: Date | null;
  terms?: string | null;
  notes?: string | null;
  deliveryNote?: string | null;
  referenceNo?: string | null;
  otherReferences?: string | null;
  buyerOrderNo?: string | null;
  buyerOrderDate?: Date | null;
  dispatchDocNo?: string | null;
  deliveryNoteDate?: Date | null;
  dispatchedThrough?: string | null;
  destination?: string | null;
  termsOfDelivery?: string | null;
  consigneeName?: string | null;
  consigneeAddress?: string | null;
  consigneeGstin?: string | null;
  consigneeState?: string | null;
  consigneeStateCode?: string | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  taxLines?: { name: string; rate: number }[];
  total: number;
  client: PdfClient;
  items: PdfItem[];
};

function imageFromDataUrl(value?: string): Buffer | null {
  if (!value) return null;
  const match = value.match(
    /^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  try {
    const image = Buffer.from(match[1], 'base64');
    return image.length > 0 ? image : null;
  } catch {
    return null;
  }
}

function drawImage(
  doc: PDFKit.PDFDocument,
  value: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (value?.startsWith('/')) {
    const imagePath = resolve(
      process.cwd(),
      '../frontend/public',
      value.slice(1),
    );
    if (existsSync(imagePath)) {
      try {
        doc.image(imagePath, x, y, {
          fit: [width, height],
          align: 'center',
          valign: 'center',
        });
        return true;
      } catch {
        return false;
      }
    }
  }
  const image = imageFromDataUrl(value);
  if (!image) return false;
  try {
    doc.image(image, x, y, {
      fit: [width, height],
      align: 'center',
      valign: 'center',
    });
    return true;
  } catch {
    return false;
  }
}

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return tens[t];
  return `${tens[t]}-${ones[o].toLowerCase()}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h && r) return `${ones[h]} Hundred ${twoDigits(r)}`;
  if (h) return `${ones[h]} Hundred`;
  return twoDigits(r);
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount) + 1e-9);
  if (rupees === 0) return 'INR Zero only/-';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} thousand`);
  if (hundred) {
    const h = Math.floor(hundred / 100);
    const r = hundred % 100;
    if (h && r) parts.push(`${ones[h]} hundred ${twoDigits(r)}`);
    else if (h) parts.push(`${ones[h]} hundred`);
    else parts.push(twoDigits(r));
  }

  const text = parts.join(' ');
  return `INR ${text.charAt(0).toUpperCase()}${text.slice(1)} only/-`;
}

function money(n: number) {
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${yy}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function strokeRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.save();
  doc.lineWidth(0.7);
  doc.strokeColor('#000000');
  doc.rect(x, y, w, h).stroke();
  doc.restore();
}

function hLine(doc: PDFKit.PDFDocument, x1: number, x2: number, y: number) {
  doc.save();
  doc.lineWidth(0.7);
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

function vLine(doc: PDFKit.PDFDocument, x: number, y1: number, y2: number) {
  doc.save();
  doc.lineWidth(0.7);
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
  doc.restore();
}

function write(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { size?: number; bold?: boolean } = {},
) {
  const { size = 8, bold = false, ...rest } = opts;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  doc.fillColor('#000000');
  doc.text(value ?? '', x, y, { lineGap: 1, ...rest });
}

function buyerStateCode(state?: string | null) {
  if (!state) return '';
  const map: Record<string, string> = {
    'uttar pradesh': '09',
    up: '09',
    maharashtra: '27',
    mh: '27',
    delhi: '07',
    karnataka: '29',
    ka: '29',
    tamil: '33',
    'tamil nadu': '33',
    tn: '33',
    gujarat: '24',
    gj: '24',
    rajasthan: '08',
    rj: '08',
    haryana: '06',
    hr: '06',
    punjab: '03',
    pb: '03',
    west: '19',
    'west bengal': '19',
    wb: '19',
  };
  return map[state.trim().toLowerCase()] || '';
}

export async function buildTaxInvoicePdf(
  invoice: PdfInvoice,
  settings: SettingsMap,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  // Prevent accidental page breaks from text flow near page edge
  doc.addPage = () => doc;
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const outer = 20;
  const left = outer;
  const width = pageW - outer * 2;
  const bottom = pageH - outer;
  const right = left + width;

  // Outer border for whole invoice
  strokeRect(doc, left, outer, width, bottom - outer);

  let y = outer + 8;
  write(doc, invoice.isCreditNote ? 'CREDIT NOTE' : 'TAX INVOICE', left, y, {
    size: 13,
    bold: true,
    width,
    align: 'center',
  });
  y += 18;
  hLine(doc, left, right, y);

  const companyName = settings.company_name || 'girjasoft pvt ltd';
  const companyAddress = settings.company_address || '';
  const gstin = settings.company_gstin || '';
  const stateName = settings.company_state || '';
  const stateCode = settings.company_state_code || '';
  const email = settings.company_email || '';

  const leftW = Math.floor(width * 0.52);
  const rightW = width - leftW;
  const rx = left + leftW;
  const headerTop = y;
  // Keep enough room for a full consignee address so it cannot overlap Buyer.
  const headerH = 232;
  const sellerH = 70;
  const consigneeH = 80;

  // Left / right vertical split for header
  vLine(doc, rx, headerTop, headerTop + headerH);
  hLine(doc, left, right, headerTop + headerH);

  // ---- Seller (top-left) ----
  const hasLogo = drawImage(
    doc,
    settings.company_logo || '/girjasoft_logo-removebg-preview.png',
    left + 6,
    headerTop + 8,
    56,
    50,
  );
  const sellerTextX = hasLogo ? left + 68 : left + 5;
  const sellerTextWidth = rx - sellerTextX - 5;
  let sy = headerTop + 5;
  write(doc, companyName, sellerTextX, sy, {
    size: 10,
    bold: true,
    width: sellerTextWidth,
  });
  sy += 13;
  if (companyAddress) {
    write(doc, companyAddress, sellerTextX, sy, {
      size: 8,
      width: sellerTextWidth,
    });
    sy += doc.heightOfString(companyAddress, { width: sellerTextWidth }) + 2;
  }
  if (gstin) {
    write(doc, `GSTIN/UIN: ${gstin}`, sellerTextX, sy, {
      size: 8,
      width: sellerTextWidth,
    });
    sy += 11;
  }
  if (stateName) {
    write(
      doc,
      `State Name: ${stateName}, Code: ${stateCode}`,
      sellerTextX,
      sy,
      {
        size: 8,
        width: sellerTextWidth,
      },
    );
    sy += 11;
  }
  if (email) {
    write(doc, `E-Mail: ${email}`, sellerTextX, sy, {
      size: 8,
      width: sellerTextWidth,
    });
    sy += 11;
  }
  if (settings.company_phone) {
    write(doc, `Phone: ${settings.company_phone}`, sellerTextX, sy, {
      size: 8,
      width: sellerTextWidth,
    });
  }
  hLine(doc, left, rx, headerTop + sellerH);

  // ---- Consignee ----
  let cy = headerTop + sellerH + 4;
  write(doc, 'Consignee (Ship to)', left + 5, cy, {
    size: 8,
    bold: true,
    width: leftW - 10,
  });
  cy += 12;
  const consigneeLabel =
    invoice.consigneeName || settings.default_consignee || 'Not Applicable';
  write(doc, consigneeLabel, left + 5, cy, {
    size: 8,
    bold: consigneeLabel !== 'Not Applicable',
    width: leftW - 10,
  });
  cy += 11;
  if (invoice.consigneeAddress) {
    write(doc, invoice.consigneeAddress, left + 5, cy, {
      size: 7,
      width: leftW - 10,
    });
    cy +=
      doc.heightOfString(invoice.consigneeAddress, {
        width: leftW - 10,
      }) + 2;
  }
  if (invoice.consigneeGstin) {
    write(doc, `GSTIN/UIN: ${invoice.consigneeGstin}`, left + 5, cy, {
      size: 7,
      width: leftW - 10,
    });
    cy += 10;
  }
  if (invoice.consigneeState) {
    const code = invoice.consigneeStateCode
      ? `, Code: ${invoice.consigneeStateCode}`
      : '';
    write(doc, `State Name: ${invoice.consigneeState}${code}`, left + 5, cy, {
      size: 7,
      width: leftW - 10,
    });
  }
  hLine(doc, left, rx, headerTop + sellerH + consigneeH);

  // ---- Buyer ----
  let by = headerTop + sellerH + consigneeH + 4;
  write(doc, 'Buyer (Bill to)', left + 5, by, {
    size: 8,
    bold: true,
    width: leftW - 10,
  });
  by += 12;
  const buyerName = invoice.client.company || invoice.client.name;
  write(doc, buyerName, left + 5, by, {
    size: 9,
    bold: true,
    width: leftW - 10,
  });
  by += 12;
  const addr = [
    invoice.client.address,
    invoice.client.addressLine2,
    [invoice.client.city, invoice.client.state, invoice.client.postalCode]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join(', ');
  if (addr) {
    write(doc, addr, left + 5, by, { size: 8, width: leftW - 10 });
    by += doc.heightOfString(addr, { width: leftW - 10 }) + 2;
  }
  if (invoice.client.vatGstNumber) {
    write(doc, `GSTIN/UIN: ${invoice.client.vatGstNumber}`, left + 5, by, {
      size: 8,
      width: leftW - 10,
    });
    by += 11;
  }
  const buyerState = invoice.client.state || '';
  const buyerCode = invoice.client.stateCode || buyerStateCode(buyerState);
  if (buyerState) {
    write(
      doc,
      `State Name: ${buyerState}${buyerCode ? `, Code: ${buyerCode}` : ''}`,
      left + 5,
      by,
      { size: 8, width: leftW - 10 },
    );
  }

  // ---- Right meta grid (Tally style 2x6 + Terms) ----
  const termsH = 28;
  const gridH = headerH - termsH;
  const rows = 6;
  const rowH = gridH / rows;
  const half = rightW / 2;
  const midX = rx + half;

  vLine(doc, midX, headerTop, headerTop + gridH);

  const meta: [string, string, string, string][] = [
    [
      'Invoice No.',
      invoice.invoiceNumber,
      'Dated',
      formatDate(invoice.issueDate),
    ],
    [
      'Delivery Note',
      invoice.deliveryNote || '',
      'Mode/Terms of Payment',
      invoice.terms || '',
    ],
    [
      'Reference No. & Date',
      invoice.referenceNo || '',
      'Other References',
      invoice.otherReferences || '',
    ],
    [
      "Buyer's Order No.",
      invoice.buyerOrderNo || '',
      'Dated',
      invoice.buyerOrderDate ? formatDate(invoice.buyerOrderDate) : '',
    ],
    [
      'Dispatch Doc No.',
      invoice.dispatchDocNo || '',
      'Delivery Note Date',
      invoice.deliveryNoteDate ? formatDate(invoice.deliveryNoteDate) : '',
    ],
    [
      'Dispatched through',
      invoice.dispatchedThrough || '',
      'Destination',
      invoice.destination || '',
    ],
  ];

  for (let i = 0; i < rows; i++) {
    const rowY = headerTop + i * rowH;
    if (i > 0) hLine(doc, rx, right, rowY);

    const [l1, v1, l2, v2] = meta[i];
    write(doc, l1, rx + 3, rowY + 2, { size: 7, width: half - 6 });
    write(doc, v1, rx + 3, rowY + 12, {
      size: 8,
      bold: true,
      width: half - 6,
    });
    write(doc, l2, midX + 3, rowY + 2, { size: 7, width: half - 6 });
    write(doc, v2, midX + 3, rowY + 12, {
      size: 8,
      bold: true,
      width: half - 6,
    });
  }

  hLine(doc, rx, right, headerTop + gridH);
  write(doc, 'Terms of Delivery', rx + 3, headerTop + gridH + 3, {
    size: 7,
    width: rightW - 6,
  });
  const termsDelivery = invoice.termsOfDelivery || invoice.notes || '';
  if (termsDelivery) {
    write(doc, termsDelivery, rx + 3, headerTop + gridH + 13, {
      size: 8,
      width: rightW - 6,
    });
  }

  // ---- Items table ----
  const tableTop = headerTop + headerH;
  const footerReserve = 138;
  const tableBottom = bottom - footerReserve;
  const headerRowH = 16;
  const totalsBlockH = 64;

  const cols = [
    { key: 'sno', w: 28, label: 'SI No.' },
    { key: 'desc', w: 178, label: 'Description of Goods' },
    { key: 'hsn', w: 52, label: 'HSN/SAC' },
    { key: 'qty', w: 48, label: 'Quantity' },
    { key: 'rate', w: 58, label: 'Rate' },
    { key: 'per', w: 36, label: 'per' },
    { key: 'disc', w: 36, label: 'Disc. %' },
    {
      key: 'amt',
      w: width - 28 - 178 - 52 - 48 - 58 - 36 - 36,
      label: 'Amount',
    },
  ];

  // column lines for full table height
  let cx = left;
  for (let i = 0; i < cols.length - 1; i++) {
    cx += cols[i].w;
    vLine(doc, cx, tableTop, tableBottom);
  }
  hLine(doc, left, right, tableTop + headerRowH);
  hLine(doc, left, right, tableBottom - totalsBlockH);
  hLine(doc, left, right, tableBottom);

  // header labels
  cx = left;
  for (const c of cols) {
    write(doc, c.label, cx + 2, tableTop + 5, {
      size: 7,
      bold: true,
      width: c.w - 4,
      align: c.key === 'desc' || c.key === 'sno' ? 'left' : 'center',
    });
    cx += c.w;
  }

  // item rows at top of body
  let iy = tableTop + headerRowH + 4;
  const discountPct = invoice.discountPercent || 0;

  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    const desc = item.description
      ? `${item.name}\n${item.description}`
      : item.name;
    const lineSub = round2(item.quantity * item.unitPrice);
    const values = [
      String(i + 1),
      desc,
      item.hsnSac || '',
      String(item.quantity),
      money(item.unitPrice),
      item.unit || 'Nos',
      discountPct ? money(discountPct) : '',
      money(lineSub),
    ];
    cx = left;
    let rowH = 0;
    values.forEach((val, idx) => {
      const c = cols[idx];
      write(doc, val, cx + 2, iy, {
        size: 8,
        width: c.w - 4,
        align: idx <= 1 ? 'left' : 'right',
      });
      rowH = Math.max(rowH, doc.heightOfString(val, { width: c.w - 4 }) + 4);
      cx += c.w;
    });
    iy += Math.max(rowH, 16);
  }

  // Tax rate from line items (prefer first non-zero), split by place of supply.
  const itemRate =
    invoice.items.find((it) => it.taxRate > 0)?.taxRate ??
    (invoice.taxAmount > 0 && invoice.subtotal > 0
      ? round2((invoice.taxAmount / invoice.subtotal) * 100)
      : 0);
  const halfRate = round2(itemRate / 2);
  const halfTax = round2(invoice.taxAmount / 2);

  // Totals inside bottom of table (Tally style)
  const ty = tableBottom - totalsBlockH + 4;
  const amtColX = left + width - cols[cols.length - 1].w;
  const qtyColX = left + cols[0].w + cols[1].w + cols[2].w;

  write(doc, 'Total', left + cols[0].w + 4, ty + 2, {
    size: 8,
    bold: true,
  });

  const qtyTotal = invoice.items.reduce((s, i) => s + i.quantity, 0);
  const unitLabel =
    invoice.items.length === 1 ? invoice.items[0].unit || '' : '';
  write(
    doc,
    `${qtyTotal}${unitLabel ? ` ${unitLabel}` : ''}`,
    qtyColX + 2,
    ty + 2,
    {
      size: 8,
      bold: true,
      width: cols[3].w + cols[4].w + cols[5].w - 4,
      align: 'right',
    },
  );

  let totY = ty;
  write(doc, money(invoice.subtotal), amtColX + 2, totY, {
    size: 8,
    width: cols[cols.length - 1].w - 4,
    align: 'right',
  });
  totY += 12;

  if (invoice.discountAmount > 0) {
    write(doc, 'Discount', left + cols[0].w + 4, totY, { size: 8 });
    write(doc, money(invoice.discountAmount), amtColX + 2, totY, {
      size: 8,
      width: cols[cols.length - 1].w - 4,
      align: 'right',
    });
    totY += 12;
  }

  if (invoice.taxAmount > 0) {
    const validTaxLines = (invoice.taxLines ?? []).filter(
      (tax): tax is { name: string; rate: number } =>
        typeof tax?.name === 'string' &&
        tax.name.trim().length > 0 &&
        Number.isFinite(Number(tax.rate)) &&
        Number(tax.rate) > 0,
    );
    const taxLineRate = validTaxLines.reduce(
      (sum, tax) => sum + Number(tax.rate),
      0,
    );
    const taxRows =
      validTaxLines.length && taxLineRate > 0
        ? validTaxLines.map(
            (tax) =>
              [
                `${tax.name} ${Number(tax.rate)}%`,
                invoice.taxAmount * (Number(tax.rate) / taxLineRate),
              ] as const,
          )
        : invoice.taxType === 'INTRA_STATE'
          ? ([
              [`${settings.tax_cgst_name || 'CGST'} ${halfRate}%`, halfTax],
              [`${settings.tax_sgst_name || 'SGST'} ${halfRate}%`, halfTax],
            ] as const)
          : ([
              [
                `${settings.tax_igst_name || 'IGST'} ${itemRate}%`,
                invoice.taxAmount,
              ],
            ] as const);
    for (const [label, amount] of taxRows) {
      write(doc, label, left + cols[0].w + 4, totY, { size: 8 });
      write(doc, money(amount), amtColX + 2, totY, {
        size: 8,
        width: cols[cols.length - 1].w - 4,
        align: 'right',
      });
      totY += 12;
    }
    totY += 2;
  }

  write(doc, `Rs ${money(invoice.total)}`, amtColX - 8, tableBottom - 16, {
    size: 10,
    bold: true,
    width: cols[cols.length - 1].w + 6,
    align: 'right',
  });

  // ---- Footer ----
  let fy = tableBottom + 6;
  write(doc, 'Amount Chargeable (in words)', left + 5, fy, {
    size: 8,
    bold: true,
  });
  fy += 12;
  write(doc, amountInWords(invoice.total), left + 5, fy, {
    size: 9,
    bold: true,
    width: width - 10,
  });
  fy += 16;
  hLine(doc, left, right, fy);
  fy += 6;

  if (settings.company_pan) {
    write(doc, `Company's PAN  :  ${settings.company_pan}`, left + 5, fy, {
      size: 8,
      bold: true,
    });
    fy += 14;
  }

  write(doc, "Company's Bank Details", left + 5, fy, {
    size: 8,
    bold: true,
  });
  fy += 12;
  const holder =
    settings.company_bank_holder || settings.company_name || companyName;
  const bankLines = [
    settings.company_bank_name ? `A/c Holder's Name : ${holder}` : null,
    settings.company_bank_name
      ? `Bank Name         : ${settings.company_bank_name}`
      : null,
    settings.company_bank_account
      ? `A/c No.           : ${settings.company_bank_account}`
      : null,
    settings.company_bank_branch || settings.company_bank_ifsc
      ? `Branch & IFS Code : ${[settings.company_bank_branch, settings.company_bank_ifsc].filter(Boolean).join(' / ')}`
      : null,
  ].filter(Boolean) as string[];

  for (const line of bankLines) {
    write(doc, line, left + 5, fy, { size: 8, width: width * 0.55 });
    fy += 11;
  }

  // Signature block bottom-right
  const sigX = left + width * 0.58;
  const sigY = tableBottom + 40;
  write(doc, `for ${companyName}`, sigX, sigY, {
    size: 8,
    bold: true,
    width: width * 0.4,
    align: 'center',
  });
  const stampWidth = 90;
  drawImage(
    doc,
    settings.company_stamp,
    sigX + (width * 0.4 - stampWidth) / 2,
    sigY + 14,
    stampWidth,
    50,
  );
  write(
    doc,
    settings.company_signatory || 'Authorised Signatory',
    sigX,
    bottom - 22,
    {
      size: 8,
      bold: true,
      width: width * 0.4,
      align: 'center',
    },
  );

  if (settings.pdf_footer_text) {
    write(doc, settings.pdf_footer_text, left, bottom - 10, {
      size: 7,
      width,
      align: 'center',
    });
  }

  doc.end();
  return done;
}
