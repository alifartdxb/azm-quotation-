import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SalesInvoice, Customer, Product, QuoteItem } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrintInvoice } from '../components/PrintInvoice';
import { Save, Printer, Plus, Trash2, ArrowLeft, Edit, Download, Search, X, Image as ImageIcon, ChevronDown, DollarSign } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency, parseDate, cleanFirestoreData } from '../lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProducts, getSalesInvoice, saveSalesInvoice, generateNextInvoiceNumber, logActivity, getAppSettings } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { SmartProductSelect } from '../components/SmartProductSelect';

function InvoiceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);

  const [invoice, setInvoice] = useState<Partial<SalesInvoice>>({
    customer: {
      customerName: '',
      companyName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      trn: '',
      projectName: '',
      siteLocation: '',
      address: '',
      reference: ''
    },
    subject: '',
    items: [],
    status: 'Draft',
    salesperson: 'Sabeer',
    preparedBy: 'Ali G',
    paymentStatus: 'Unpaid',
    paidAmount: 0,
    outstandingBalance: 0,
    remarks: ''
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Record<string, string>>({});
  const [appSettings, setAppSettings] = useState<any>(null);

  // Search references
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);

  const [loadingPhase, setLoadingPhase] = useState<'initial' | 'settings' | 'products' | 'invoice' | 'done'>('initial');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoadingPhase('settings');
        const settings = await getAppSettings();
        setAppSettings(settings);

        setLoadingPhase('products');
        const prods = await getProducts();
        setProducts(prods);

        if (id) {
          setLoadingPhase('invoice');
          const data = await getSalesInvoice(id);
          if (data) {
            const sanitizedItems = (data.items || []).map((item: any) => ({
              ...item,
              id: item.id || uuidv4()
            }));
            setInvoice({
              ...data,
              items: sanitizedItems
            });
          } else {
            alert("Location payload: Invoice not found.");
            navigate('/invoices');
          }
        } else {
          try {
            const nextInvoiceNo = await generateNextInvoiceNumber();
            setInvoice(prev => ({
              ...prev,
              invoiceNo: nextInvoiceNo,
              invoiceDate: new Date().toISOString()
            }));
          } catch(err) {
            console.error("Failed to generate next invoice number:", err);
          }
        }
        setLoadingPhase('done');
      } catch (err) {
        console.error("Critical loader bootstrap failure:", err);
        setLoadingPhase('done');
      }
    };
    bootstrap();
  }, [id, navigate]);

  // Recalculate totals periodically when items edit
  useEffect(() => {
    recalculateTotals();
  }, [invoice.items, invoice.discountPercentage, invoice.paidAmount]);

  const recalculateTotals = () => {
    const items = invoice.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const discountPercent = invoice.discountPercentage || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const netTotal = subtotal - discountAmount;
    const vatAmount = netTotal * 0.05;
    const grandTotal = netTotal + vatAmount;

    const paidAmt = invoice.paidAmount || 0;
    const outstanding = Math.max(0, grandTotal - paidAmt);
    let paymentStat: SalesInvoice['paymentStatus'] = 'Unpaid';
    if (paidAmt >= grandTotal && grandTotal > 0) {
      paymentStat = 'Paid';
    } else if (paidAmt > 0) {
      paymentStat = 'Partially Paid';
    }

    setInvoice(prev => {
      // Avoid infinite loop by shallow comparisons
      if (
        prev.subtotal === subtotal &&
        prev.discountAmount === discountAmount &&
        prev.netTotal === netTotal &&
        prev.vatAmount === vatAmount &&
        prev.grandTotal === grandTotal &&
        prev.outstandingBalance === outstanding &&
        prev.paymentStatus === paymentStat
      ) {
        return prev;
      }
      return {
        ...prev,
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount: Math.round(discountAmount * 100) / 100,
        netTotal: Math.round(netTotal * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
        outstandingBalance: Math.round(outstanding * 100) / 100,
        paymentStatus: paymentStat
      };
    });
  };

  const convertImgToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve('');
        return;
      }
      if (url.startsWith('data:image/')) {
        resolve(url);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
          } else {
            resolve('');
          }
        } catch (err) {
          resolve('');
        }
      };
      img.onerror = () => {
        resolve('');
      };
      img.src = url;
    });
  };

  const handleDownloadPdf = async () => {
    if (!invoice?.items || invoice.items.length === 0) {
      alert("Error: Items list is empty.");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const preloaded: Record<string, string> = {};
      
      // Load optional images like stamp, logo, if needed. (QuotationBuilder handles this via addPdfImage gracefully)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const safeCustomer = invoice.customer || {
        customerName: '',
        companyName: '',
        contactPerson: '',
        mobile: '',
        email: '',
        trn: '',
        projectName: '',
        siteLocation: '',
        address: '',
        reference: ''
      };

      const safeItems = invoice.items || [];
      const safeSubtotal = invoice.subtotal || 0;
      const safeVatAmount = invoice.vatAmount || 0;
      const safeGrandTotal = invoice.grandTotal || 0;
      const safeInvoiceNo = invoice.invoiceNo || 'Draft';
      const safeSalesperson = invoice.salesperson || 'Sabeer';
      const safeDueDate = invoice.createdAt ? format(new Date(new Date(invoice.createdAt).getTime() + (appSettings?.defaultValidity || 30) * 24 * 60 * 60 * 1000), 'dd MMM yyyy') : 'Current Date';
      const safeSubject = invoice.subject || '';
      const safePaymentStatus = invoice.paymentStatus || 'Unpaid';

      const totalPagesExp = '{total_pages_count_string}';

      const addPdfImage = (doc: any, dataUrl: string, x: number, y: number, w: number, h?: number) => {
        try {
          if (!dataUrl) return;
          const typeMatch = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
          let formatStr = 'JPEG';
          if (typeMatch && typeMatch[1]) {
             formatStr = typeMatch[1].toUpperCase();
             if (formatStr === 'JPG') formatStr = 'JPEG';
          }
          
          let drawHeight = h;
          if (!drawHeight) {
             const props = doc.getImageProperties(dataUrl);
             drawHeight = (w / props.width) * props.height;
          }
          
          doc.addImage(dataUrl, formatStr, x, y, w, drawHeight);
        } catch (e) {
          console.warn("PDF AddImage failed", e);
        }
      };

      let headerHeight = 28;
      if (appSettings?.headerImage) {
          const props = pdf.getImageProperties(appSettings.headerImage);
          headerHeight = (194 / props.width) * props.height;
      }
      
      let footerHeight = 16;
      if (appSettings?.footerImage) {
          const props = pdf.getImageProperties(appSettings.footerImage);
          footerHeight = (194 / props.width) * props.height;
      }

      const drawHeaderAndFooter = (pageNum: number) => {
        // --- HEADER ---
        if (appSettings?.headerImage) {
          addPdfImage(pdf, appSettings.headerImage, 8, 0, 194, headerHeight);
        } else {
          pdf.setFillColor(233, 243, 246);
          pdf.rect(8, 5, 194, 18, 'F'); 

          const companyEn = appSettings?.companyNameEn || 'Al Zahra Al Malakia\nBuilding Materials Trading L.L.C';
          const parts = companyEn.split('\n');
          
          pdf.setTextColor(83, 144, 154);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.text(parts[0] || "Al Zahra Al Malakia", 12, 12);
          pdf.setTextColor(60, 120, 130);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.text(parts[1] || "Building Materials Trading L.L.C", 12, 18);

          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(83, 144, 154);
          pdf.setLineWidth(0.5);
          
          pdf.rect(98, 4, 14, 20, 'FD'); 
          pdf.setTextColor(26, 58, 92);
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text("AZM", 105, 15, { align: 'center' });

          pdf.setTextColor(83, 144, 154);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          const companyAr = appSettings?.companyNameAr || 'الزهرة الملكية\nلتجارة مواد البناء ذ.م.م';
          const partsAr = companyAr.split('\n');
          
          pdf.text(partsAr[0] || "الزهرة الملكية", 192, 12, { align: 'right' });
          pdf.setTextColor(60, 120, 130);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.text(partsAr[1] || "لتجارة مواد البناء ذ.م.م", 192, 18, { align: 'right' });

          pdf.setTextColor(83, 144, 154);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'normal');
          
          const phone = appSettings?.phone || '+971 4 28 444 52';
          const address = appSettings?.address || 'Shop No. 12, Building Materials Mall, Dubai, U.A.E';
          
          pdf.text(`Tel: ${phone}  |  Add.: ${address}  |  Email: office@alzahrabm.com`, 105, 29, { align: 'center' });
        }

        // --- FOOTER ---
        const pageHeight = 297;
        const bannerStartY = pageHeight - 12;
        
        if (appSettings?.footerImage) {
          addPdfImage(pdf, appSettings.footerImage, 8, pageHeight - footerHeight, 194, footerHeight);
          
          pdf.setTextColor(150, 150, 150);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`Page ${pageNum} of ${totalPagesExp}`, 105, pageHeight - 3, { align: 'center' });
        } else {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 58, 138);

          const brands = ["VADO", "Jaquar", "ITALIAN STANDARDS", "NOURK", "SANIT", "KLUDI RAK", "SONET"];
          const spacing = 194 / (brands.length - 1);
          brands.forEach((brand, idx) => {
            pdf.text(brand, 8 + idx * spacing, pageHeight - 17, { align: idx === 0 ? 'left' : idx === brands.length - 1 ? 'right' : 'center' });
          });

          pdf.setFillColor(83, 144, 154); // Teal
          pdf.rect(0, bannerStartY, 70, 12, 'F');
          pdf.setFillColor(26, 58, 92); // Navy
          pdf.rect(70, bannerStartY, 140, 12, 'F');
          
          pdf.setFillColor(26, 58, 92);
          pdf.triangle(63, bannerStartY + 12, 70, bannerStartY, 70, bannerStartY + 12, 'F');

          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text("www.alzahrabm.com", 15, bannerStartY + 7.5);
          pdf.text("Empowering Projects. Shaping spaces.", 195, bannerStartY + 7.5, { align: 'right' });
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`Page ${pageNum} of ${totalPagesExp}`, 105, bannerStartY + 7.5, { align: 'center' });
        }
      };

      let currentPage = 1;
      drawHeaderAndFooter(currentPage);

      const tablesStartY = appSettings?.headerImage ? headerHeight + 5 : 35;

      // Draw Left Info table (CUSTOMER INFORMATION)
      autoTable(pdf, {
        startY: tablesStartY,
        margin: { left: 8 },
        tableWidth: 95,
        theme: 'grid',
        styles: { fontSize: 8.8, cellPadding: { top: 1.5, bottom: 1.5, left: 4, right: 4 }, font: 'helvetica', textColor: [15, 23, 42] },
        headStyles: { fontSize: 11, fillColor: [80, 158, 159], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, // Teal
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: 'auto', textColor: [15, 23, 42] }
        },
        head: [[{ content: 'CUSTOMER INFORMATION', colSpan: 2 }]],
        body: [
          [
            'Customer Name:', 
            { content: safeCustomer.companyName || safeCustomer.customerName || '-', styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
          ],
          ['Contact No.:', safeCustomer.mobile || '-'],
          ['Address:', safeCustomer.address || '-'],
          ['L.P.O NO.', safeCustomer.reference || '-'],
          ['Subject:', safeSubject || '-'],
          ['Customer TRN:', safeCustomer.trn || '-']
        ]
      });

      // Draw Right Info table (TAX INVOICE)
      autoTable(pdf, {
        startY: tablesStartY,
        margin: { left: 107 },
        tableWidth: 95,
        theme: 'grid',
        styles: { fontSize: 8.8, cellPadding: { top: 1.5, bottom: 1.5, left: 4, right: 4 }, font: 'helvetica', textColor: [15, 23, 42] },
        headStyles: { fontSize: 11, fillColor: [80, 158, 159], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, // Teal
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: 'auto', textColor: [15, 23, 42] }
        },
        head: [[{ content: 'TAX INVOICE', colSpan: 2 }]],
        body: [
          [
            { content: 'No.:', styles: { fontSize: 8.8, fontStyle: 'bold', textColor: [26, 58, 92] } },
            { content: safeInvoiceNo, styles: { fontSize: 10.2, fontStyle: 'bold', textColor: [26, 58, 92] } }
          ],
          ['Date:', invoice.createdAt ? format(parseDate(invoice.createdAt), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')],
          ['Due Date:', safeDueDate],
          ['TRN:', appSettings?.trn || '1002 5994 2900 003'],
          ['Salesperson:', safeSalesperson],
          ['Payment Status:', safePaymentStatus]
        ]
      });

      const tableRows = safeItems.map((item, index) => {
        let itemDesc = '';
        if (item.productId === 'MANUAL') {
          itemDesc = item.product?.name || 'Manual Item';
        } else {
          itemDesc = `${item.product?.sku || ''}\n${item.product?.name || ''}`;
        }
        
        return [
          index + 1,
          itemDesc,
          item.qty || 0,
          item.product?.unit || 'Pcs',
          formatCurrency(item.unitPrice || 0),
          formatCurrency(item.total || 0)
        ];
      });

      const headFinalY = (pdf as any).lastAutoTable.finalY + 8;
      const bottomMargin = appSettings?.footerImage ? footerHeight + 5 : 20;

      // Draw Main Items table
      autoTable(pdf, {
        startY: headFinalY,
        margin: { left: 8, right: 8, top: tablesStartY, bottom: bottomMargin },
        theme: 'grid',
        styles: { valign: 'middle', fontSize: 8.5, cellPadding: 1.5, font: 'helvetica', textColor: [15, 23, 42] },
        headStyles: { fillColor: [80, 158, 159], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [203, 213, 225], minCellHeight: 10 },
        bodyStyles: { minCellHeight: 10, lineColor: [203, 213, 225], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 13.58, halign: 'center' }, // Sr. No. (7%)
          1: { cellWidth: 90, halign: 'left' },      // Item Description (~46%)
          2: { cellWidth: 16.40, halign: 'center' }, // Quantity (10%)
          3: { cellWidth: 16.40, halign: 'center' }, // Unit (10%)
          4: { cellWidth: 27.16, halign: 'right' },  // Unit Price (14%)
          5: { cellWidth: 30.46, halign: 'right' }   // Total Amount (17%)
        },
        head: [
          ['Sr. No.', 'Item Description', 'Qty', 'Unit', 'Unit Price\n(AED)', 'Total Amount\n(AED)']
        ],
        body: tableRows,
        didDrawPage: (data: any) => {
          if (data.pageNumber > 1) {
            drawHeaderAndFooter(data.pageNumber);
          }
          currentPage = data.pageNumber;
        }
      });

      // Determine bottom position and page breaks for signature areas
      let finalY = (pdf as any).lastAutoTable.finalY || 106;
      const requiredFooterHeight = 65; // Reduced required height since bank details attach
      
      if (finalY + requiredFooterHeight > 297 - bottomMargin) {
        pdf.addPage();
        currentPage++;
        drawHeaderAndFooter(currentPage);
        finalY = tablesStartY;
      }

      const footerStartY = finalY;

      // Draw Bank Details block on the left
      pdf.setFillColor(255, 255, 255);
      pdf.rect(8, footerStartY, 123.86, 28, 'F');
      pdf.setDrawColor(203, 213, 225); // Match table border color
      pdf.setLineWidth(0.1); // Match table line width
      pdf.rect(8, footerStartY, 123.86, 28, 'D');

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.text("Bank Details:", 12, footerStartY + 6);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text("Bank Name:", 12, footerStartY + 11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(appSettings?.bankName || "National Bank Of Ras Al Khaimah", 35, footerStartY + 11);

      pdf.setFont('helvetica', 'normal');
      pdf.text("Account Name:", 12, footerStartY + 15);
      pdf.setFont('helvetica', 'bold');
      pdf.text(appSettings?.accountName || "Al Zahra Al Malakia Building Materials Trading L.L.C.", 35, footerStartY + 15);

      pdf.setFont('helvetica', 'normal');
      pdf.text("Account Number:", 12, footerStartY + 19);
      pdf.setFont('helvetica', 'bold');
      pdf.text(appSettings?.accountNumber || "83621 5391 5902", 35, footerStartY + 19);

      pdf.setFont('helvetica', 'normal');
      pdf.text("IBAN Number:", 12, footerStartY + 23);
      pdf.setFont('helvetica', 'bold');
      pdf.text(appSettings?.iban || "AE39 0400 0083 6215 3915 902", 35, footerStartY + 23);

      // Draw Totals side-table on the right
      const totalsBody: string[][] = [
        ['Sub Total', formatCurrency(safeSubtotal)]
      ];
      
      const discountPercentage = invoice.discountPercentage || 0;
      if (discountPercentage > 0) {
        totalsBody.push([`Discount (${discountPercentage}%)`, `-${formatCurrency(invoice.discountAmount || 0)}`]);
        totalsBody.push(['Net Total', formatCurrency(invoice.netTotal || safeSubtotal)]);
      }
      
      totalsBody.push(['VAT 5%', formatCurrency(safeVatAmount)]);
      totalsBody.push(['Grand Total', formatCurrency(safeGrandTotal)]);
      
      const paidAmt = invoice.paidAmount || 0;
      const outstanding = Math.max(0, safeGrandTotal - paidAmt);
      totalsBody.push(['Paid Amount', formatCurrency(paidAmt)]);
      totalsBody.push(['Due Amount', formatCurrency(outstanding)]);

      autoTable(pdf, {
        startY: footerStartY,
        margin: { left: 141.86 },
        tableWidth: 60.14,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 27.16, halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252], lineColor: [203, 213, 225], lineWidth: 0.1 },
          1: { cellWidth: 32.98, halign: 'right', fontStyle: 'bold', lineColor: [203, 213, 225], lineWidth: 0.1 }
        },
        body: totalsBody,
        didParseCell: (data: any) => {
          if (data.row.index === totalsBody.length - 3) { // Grand Total
            if (data.column.index === 0) {
              data.cell.styles.fillColor = [80, 158, 159]; // Teal Background
              data.cell.styles.textColor = [255, 255, 255];
            } else {
              data.cell.styles.fillColor = [80, 158, 159]; 
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontSize = 8.5;
            }
          } else if (data.row.index === totalsBody.length - 2) { // Paid Amount
            if (data.column.index === 0) {
              data.cell.styles.fillColor = [240, 253, 244]; // Light green bg-green-50
              data.cell.styles.textColor = [22, 101, 52]; // text-green-800
            } else {
              data.cell.styles.fillColor = [240, 253, 244];
              data.cell.styles.textColor = [22, 101, 52];
              data.cell.styles.fontStyle = 'bold';
            }
          } else if (data.row.index === totalsBody.length - 1) { // Due Amount
            if (data.column.index === 0) {
              data.cell.styles.fillColor = [254, 242, 242]; // Light red bg-red-50
              data.cell.styles.textColor = [185, 28, 28]; // text-red-700
            } else {
              data.cell.styles.fillColor = [254, 242, 242];
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          } else if (discountPercentage > 0 && data.row.index === 1 && data.column.index === 1) {
            data.cell.styles.textColor = [5, 150, 105]; // Emerald 600
          }
        }
      });

      // Terms & Conditions / Declaration
      const termsStartY = (pdf as any).lastAutoTable.finalY + 14.0;

      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'normal');
      pdf.text("Declaration", 8, termsStartY);

      const declarationText = appSettings?.invoiceDeclaration || "We declare that this invoice shows the actual price of the goods\ndescribed and that all particulars are true and correct.\nReceived the above goods in good order and condition";
      
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42); 
      
      let termY = termsStartY + 4;
      const decLines = declarationText.split('\n');
      decLines.forEach((line: string) => {
        pdf.text(line, 8, termY);
        termY += 4;
      });

      // Signatures
      const sigY = termY + 25;
      
      // Stamp
      if (appSettings?.companyStamp) {
         addPdfImage(pdf, appSettings.companyStamp, 140, termY - 5, 45);
      }

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      pdf.setDrawColor(203, 213, 225);
      pdf.line(10, sigY, 60, sigY);
      pdf.text("Customer's Signature", 35, sigY + 5, { align: 'center' });

      pdf.line(135, sigY, 195, sigY);
      pdf.text("Authorised Signature", 165, sigY + 5, { align: 'center' });

      if (typeof pdf.putTotalPages === 'function') {
        pdf.putTotalPages(totalPagesExp);
      }

      pdf.save(`Invoice_${invoice.invoiceNo}_${safeCustomer.companyName || 'AZM'}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error creating PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!invoice.customer?.customerName) return alert("Please enter Customer Name");
    setIsSaving(true);
    try {
      const invoiceNo = invoice.invoiceNo || await generateNextInvoiceNumber();
      const invoiceToSave = {
        ...invoice,
        invoiceNo,
        createdAt: invoice.createdAt || new Date().toISOString()
      };

      const docId = await saveSalesInvoice(invoiceToSave);
      setIsEditing(false);
      navigate(`/invoices/${docId}`);
    } catch (err) {
      console.error(err);
      alert("Error saving Invoice");
    } finally {
      setIsSaving(false);
    }
  };

  // Items manipulation
  const handleAddItem = () => {
    const newItem: QuoteItem = {
      id: uuidv4(),
      product: {
        id: '',
        sku: 'MANUAL',
        name: '',
        brand: '',
        price: 0,
        unit: 'Pcs',
        category: 'Miscellaneous'
      },
      qty: 1,
      unitPrice: 0,
      total: 0
    };
    setInvoice(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const handleRemoveItem = (id: string) => {
    setInvoice(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.id !== id)
    }));
  };

  const handleItemProductSelect = (index: number, product: Product) => {
    setInvoice(prev => {
      const items = [...(prev.items || [])];
      items[index] = {
        ...items[index],
        productId: product.id,
        product: product,
        unitPrice: product.price,
        total: items[index].qty * product.price
      };
      return { ...prev, items };
    });
    setShowProductDropdown(null);
  };

  const handleItemPropertyChange = (index: number, field: string, value: any) => {
    setInvoice(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[index] };
      
      if (field === 'qty') {
        item.qty = Number(value);
      } else if (field === 'unitPrice') {
        item.unitPrice = Number(value);
      } else if (field === 'discountAmt') {
        item.discountAmt = value ? Number(value) : undefined;
      } else if (field === 'name') {
        item.product = { ...item.product, name: value };
      } else if (field === 'sku') {
        item.product = { ...item.product, sku: value };
      } else if (field === 'brand') {
        item.product = { ...item.product, brand: value };
      } else if (field === 'unit') {
        item.product = { ...item.product, unit: value };
      }

      // Calculate localized row total
      const discountRatio = item.discountAmt ? (1 - item.discountAmt / 100) : 1;
      item.total = item.qty * item.unitPrice * discountRatio;
      items[index] = item;

      return { ...prev, items };
    });
  };

  if (loadingPhase !== 'done') {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-6"></div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight text-center animate-pulse">Initializing Invoice Engine</h2>
        <div className="space-y-3 w-full max-w-xs text-xs text-slate-400">
          <p className="flex justify-between">Settings bootstrap: <span>{loadingPhase === 'settings' ? 'Loading' : 'OK'}</span></p>
          <p className="flex justify-between">Product collection index: <span>{loadingPhase === 'products' ? 'Loading' : 'OK'}</span></p>
          <p className="flex justify-between">Invoices storage path: <span>{loadingPhase === 'invoice' ? 'Loading' : 'OK'}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/invoices')} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all rounded-lg text-slate-500 shadow-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-cyan-50 text-[#1B6B72] px-2.5 py-1 text-[10px] font-black uppercase rounded tracking-wider border border-cyan-100 font-mono">
                Sales Invoice Engine
              </span>
              {invoice.invoiceNo && (
                <span className="text-sm font-mono font-bold text-slate-700">{invoice.invoiceNo}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-950 mt-1">
              {id ? `Invoice Details: ${invoice.invoiceNo}` : 'New Billing Invoice Builder'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95">
              <Edit className="w-4 h-4" />
              <span>Edit Invoice Details</span>
            </button>
          )}

          {isEditing && (
            <button disabled={isSaving} onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Invoice...' : 'Save Invoice'}</span>
            </button>
          )}

          {id && !isEditing && (
            <>
              {/* Send WhatsApp Share Button */}
              <button 
                onClick={() => {
                  const baseMsg = `Dear ${invoice.customer?.customerName || 'Customer'},\n\nPlease find attached Invoice No. ${invoice.invoiceNo || 'Draft'} against Quotation ${invoice.quotationNo || '-'}.\n\nThank you for your business and continued trust in Al Zahra Al Malakia (AZM Group).\n\nBest Regards,\n${invoice.preparedBy || 'Ali G'}`;
                  const msg = encodeURIComponent(baseMsg);
                  const mobile = invoice.customer?.mobile || '';
                  const mobileClean = mobile.replace(/\D/g, '');
                  const url = mobileClean 
                    ? `https://wa.me/${mobileClean}?text=${msg}` 
                    : `https://wa.me/?text=${msg}`;
                  window.open(url, '_blank');
                }}
                className="bg-[#25D366] hover:bg-[#20b858] text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <span>Send via WhatsApp</span>
              </button>
              <button 
                disabled={isDownloadingPdf}
                onClick={handleDownloadPdf}
                className="bg-[#1A3A5C] hover:bg-slate-850 text-[#C9A96E] border border-[#C9A96E]/20 px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Invoice PDF'}</span>
              </button>
              <button onClick={() => handlePrint()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95">
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            
            {/* Document details section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Invoice Logistics</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.subject || ''} onChange={e => setInvoice({...invoice, subject: e.target.value})} placeholder="Subject" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Salesperson</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.salesperson || ''} onChange={e => setInvoice({...invoice, salesperson: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prepared By</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.preparedBy || ''} onChange={e => setInvoice({...invoice, preparedBy: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ref Quotation Number</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.quotationNo || ''} onChange={e => setInvoice({...invoice, quotationNo: e.target.value})} placeholder="QTN-2026-XXXXXX" />
                </div>
              </div>
            </div>

            {/* Client profile */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight border-b border-slate-100 pb-3 mb-4">Customer Segment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Client Company</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold" 
                    value={invoice.customer?.companyName || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), companyName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact Officer</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.customer?.customerName || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), customerName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">TRN Registration</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold" 
                    value={invoice.customer?.trn || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), trn: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono">Mobile (WhatsApp link enabled)</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.customer?.mobile || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), mobile: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact Email</label>
                  <input type="email" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.customer?.email || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), email: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Delivery Address</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                    value={invoice.customer?.address || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), address: e.target.value}})} />
                </div>
              </div>
            </div>

            {/* Payment tracker configuration */}
            <div className="bg-amber-50/50 rounded-xl shadow-sm border border-amber-200 p-6">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-tight border-b border-amber-200/40 pb-3 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>Payment Tracking Configurations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Amount Paid (AED)</label>
                  <input type="number" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-emerald-700" 
                    value={invoice.paidAmount || 0} onChange={e => setInvoice({...invoice, paidAmount: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Payment Date</label>
                  <input type="date" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.paymentDate || ''} onChange={e => setInvoice({...invoice, paymentDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Payment Option</label>
                  <select className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.paymentMethod || 'Bank Transfer'} onChange={e => setInvoice({...invoice, paymentMethod: e.target.value})}>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online Link">Online Payment Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 font-mono">Cheque Number / Ref Code</label>
                  <input type="text" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.chequeNo || ''} onChange={e => setInvoice({...invoice, chequeNo: e.target.value})} placeholder="e.g. CHQ-930210" />
                </div>
              </div>
            </div>

            {/* Product items table builder */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Active Invoiced Line Items</h3>
                <button onClick={handleAddItem} className="bg-[#1B6B72] hover:bg-[#16565c] text-white px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-sm active:scale-95">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert Manual Row</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left col-table border-collapse">
                  <thead className="bg-[#1B6B72] text-white text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 min-w-[200px]">Product / Assembly Description</th>
                      <th className="px-4 py-3 w-28">Unit</th>
                      <th className="px-4 py-3 w-24">Price (AED)</th>
                      <th className="px-4 py-3 w-20">Qty</th>
                      <th className="px-4 py-3 w-20">Disc (%)</th>
                      <th className="px-4 py-3 w-32 text-right">Row Net total</th>
                      <th className="px-4 py-3 w-16 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoice.items || []).map((item, index) => (
                      <tr key={item.id || `invoice-item-${index}`} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 space-y-2">
                          <div className="space-y-2">
                            <SmartProductSelect
                              products={products}
                              value={item.productId === 'MANUAL' ? null : (products.find(p => p.id === item.productId) || item.product || null)}
                              onChange={(p) => {
                                handleItemProductSelect(index, p);
                                setTimeout(() => {
                                  document.getElementById(`invoice-qty-${index}`)?.focus();
                                }, 50);
                              }}
                              placeholder="Search warehouse products..."
                            />
                            <textarea 
                              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none font-semibold text-slate-800 resize-none h-16"
                              value={item.product?.name || ''}
                              onChange={e => handleItemPropertyChange(index, 'name', e.target.value)}
                              placeholder="Product details or custom marble cutting specs"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <input 
                              type="text" 
                              className="border border-slate-200 bg-white rounded-lg p-1.5 font-mono"
                              placeholder="SKU"
                              value={item.product?.sku || ''}
                              onChange={e => handleItemPropertyChange(index, 'sku', e.target.value)}
                            />
                            <input 
                              type="text" 
                              className="border border-slate-200 bg-white rounded-lg p-1.5"
                              placeholder="Brand"
                              value={item.product?.brand || ''}
                              onChange={e => handleItemPropertyChange(index, 'brand', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center"
                            value={item.product?.unit || 'Pcs'}
                            onChange={e => handleItemPropertyChange(index, 'unit', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none font-mono"
                            value={item.unitPrice || 0}
                            onChange={e => handleItemPropertyChange(index, 'unitPrice', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            id={`invoice-qty-${index}`}
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center font-mono font-semibold"
                            value={item.qty || 1}
                            onChange={e => handleItemPropertyChange(index, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center font-mono text-slate-500"
                            value={item.discountAmt || ''}
                            onChange={e => handleItemPropertyChange(index, 'discountAmt', e.target.value)}
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 leading-3 text-sm">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-red-650 transition-colors focus:outline-none">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!invoice.items || invoice.items.length === 0) && (
                      <tr key="empty-state">
                        <td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">
                          No items added. Click insert manual row to compile invoice breakdown.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary calculations block */}
              <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="text-xs text-slate-400 font-medium">
                  VAT calculated at standard Gulf Regional limit of 5%.
                </div>
                <div className="w-full md:w-80 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(invoice.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 gap-4">
                    <span>Discount Percentage %:</span>
                    <input 
                      type="number" 
                      className="w-20 border border-slate-200 bg-white rounded p-1 text-center font-mono text-xs" 
                      value={invoice.discountPercentage || 0}
                      onChange={e => setInvoice({...invoice, discountPercentage: Number(e.target.value)})}
                    />
                  </div>
                  {invoice.discountAmount ? invoice.discountAmount > 0 : false && (
                    <div className="flex justify-between text-rose-650 font-semibold text-xs">
                      <span>Discount Amount:</span>
                      <span className="font-mono">-{formatCurrency(invoice.discountAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 font-bold border-t border-slate-200 pt-2 text-xs">
                    <span>Net Total:</span>
                    <span className="font-mono font-black">{formatCurrency(invoice.netTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>VAT (5%):</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.vatAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black border-t-2 border-slate-300 pt-2.5 text-base text-[#1B6B72]">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatCurrency(invoice.grandTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-650 font-black border-t border-slate-200 pt-1 text-xs">
                    <span>Outstanding Due:</span>
                    <span className="font-mono">{formatCurrency(invoice.outstandingBalance || 0)}</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* View PDF/Web Layout block when not editing */}
      {!isEditing && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <PrintInvoice invoice={invoice as SalesInvoice} appSettings={appSettings} />
        </div>
      )}
    </div>
  );
}

export default InvoiceBuilder;
