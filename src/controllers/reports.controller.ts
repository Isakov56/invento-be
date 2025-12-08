import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import PDFDocument from 'pdfkit';

/**
 * Get sales report with date range (TENANT-FILTERED)
 * Only returns sales data for the authenticated user's owner
 */
export const getSalesReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, storeId, groupBy = 'day' } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      type: 'SALE',
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };
    if (storeId) where.storeId = storeId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by day/week/month
    const groupedData: Record<string, { revenue: number; transactions: number; items: number }> = {};

    transactions.forEach((txn) => {
      const date = new Date(txn.createdAt);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = { revenue: 0, transactions: 0, items: 0 };
      }

      groupedData[key].revenue += txn.total;
      groupedData[key].transactions += 1;
      groupedData[key].items += txn.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    const chartData = Object.entries(groupedData).map(([date, data]) => ({
      date,
      revenue: Number(data.revenue.toFixed(2)),
      transactions: data.transactions,
      items: data.items,
    }));

    return sendSuccess(res, chartData, 'Sales report generated successfully');
  } catch (error: any) {
    console.error('Get sales report error:', error);
    return sendError(res, error.message || 'Failed to generate sales report', 500);
  }
};

/**
 * Get top selling products (TENANT-FILTERED)
 * Only returns product sales data for the authenticated user's owner
 */
export const getTopSellingProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, storeId, limit = 10 } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      transaction: {
        type: 'SALE',
        ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      },
    };
    if (storeId) where.transaction.storeId = storeId as string;

    if (startDate || endDate) {
      where.transaction.createdAt = {};
      if (startDate) where.transaction.createdAt.gte = new Date(startDate as string);
      if (endDate) where.transaction.createdAt.lte = new Date(endDate as string);
    }

    const items = await prisma.transactionItem.findMany({
      where,
      include: {
        productVariant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Aggregate by variant
    const variantSales: Record<
      string,
      { variant: any; quantitySold: number; revenue: number }
    > = {};

    items.forEach((item) => {
      const variantId = item.productVariantId;
      if (!variantSales[variantId]) {
        variantSales[variantId] = {
          variant: item.productVariant,
          quantitySold: 0,
          revenue: 0,
        };
      }
      variantSales[variantId].quantitySold += item.quantity;
      variantSales[variantId].revenue += item.subtotal;
    });

    // Sort by quantity sold
    const topProducts = Object.values(variantSales)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, Number(limit))
      .map((item) => ({
        productId: item.variant.product.id,
        productName: item.variant.product.name,
        category: item.variant.product.category?.name,
        imageUrl: item.variant.product.imageUrl,
        sku: item.variant.sku,
        size: item.variant.size,
        color: item.variant.color,
        quantitySold: item.quantitySold,
        revenue: Number(item.revenue.toFixed(2)),
      }));

    return sendSuccess(res, topProducts, 'Top selling products retrieved successfully');
  } catch (error: any) {
    console.error('Get top selling products error:', error);
    return sendError(res, error.message || 'Failed to get top selling products', 500);
  }
};

/**
 * Get payment method breakdown (TENANT-FILTERED)
 * Only returns payment data for the authenticated user's owner
 */
export const getPaymentMethodBreakdown = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { startDate, endDate, storeId } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      type: 'SALE',
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
    };
    if (storeId) where.storeId = storeId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        paymentMethod: true,
        total: true,
      },
    });

    const breakdown: Record<string, { count: number; total: number }> = {};

    transactions.forEach((txn) => {
      if (!breakdown[txn.paymentMethod]) {
        breakdown[txn.paymentMethod] = { count: 0, total: 0 };
      }
      breakdown[txn.paymentMethod].count += 1;
      breakdown[txn.paymentMethod].total += txn.total;
    });

    const data = Object.entries(breakdown).map(([method, stats]) => ({
      method,
      count: stats.count,
      total: Number(stats.total.toFixed(2)),
      percentage: Number(((stats.count / transactions.length) * 100).toFixed(2)),
    }));

    return sendSuccess(res, data, 'Payment method breakdown retrieved successfully');
  } catch (error: any) {
    console.error('Get payment method breakdown error:', error);
    return sendError(res, error.message || 'Failed to get payment method breakdown', 500);
  }
};

/**
 * Get inventory value report (TENANT-FILTERED)
 * Only returns inventory data for the authenticated user's owner
 */
export const getInventoryValueReport = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { storeId } = req.query;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const where: any = {
      product: {
        ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      },
    };
    if (storeId) where.product.storeId = storeId as string;

    const variants = await prisma.productVariant.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    let totalCostValue = 0;
    let totalSellingValue = 0;
    const categoryBreakdown: Record<
      string,
      { costValue: number; sellingValue: number; items: number }
    > = {};

    variants.forEach((variant) => {
      const costValue = variant.costPrice * variant.stockQuantity;
      const sellingValue = variant.sellingPrice * variant.stockQuantity;

      totalCostValue += costValue;
      totalSellingValue += sellingValue;

      const categoryName = variant.product.category?.name || 'Uncategorized';
      if (!categoryBreakdown[categoryName]) {
        categoryBreakdown[categoryName] = { costValue: 0, sellingValue: 0, items: 0 };
      }
      categoryBreakdown[categoryName].costValue += costValue;
      categoryBreakdown[categoryName].sellingValue += sellingValue;
      categoryBreakdown[categoryName].items += variant.stockQuantity;
    });

    const report = {
      totalCostValue: Number(totalCostValue.toFixed(2)),
      totalSellingValue: Number(totalSellingValue.toFixed(2)),
      potentialProfit: Number((totalSellingValue - totalCostValue).toFixed(2)),
      totalItems: variants.reduce((sum, v) => sum + v.stockQuantity, 0),
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]) => ({
        category,
        costValue: Number(data.costValue.toFixed(2)),
        sellingValue: Number(data.sellingValue.toFixed(2)),
        items: data.items,
        potentialProfit: Number((data.sellingValue - data.costValue).toFixed(2)),
      })),
    };

    return sendSuccess(res, report, 'Inventory value report generated successfully');
  } catch (error: any) {
    console.error('Get inventory value report error:', error);
    return sendError(res, error.message || 'Failed to generate inventory value report', 500);
  }
};

/**
 * Export report as CSV (TENANT-FILTERED)
 * Only exports data for the authenticated user's owner
 */
export const exportReportCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId, sections } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized - no tenant context' });
      return;
    }

    // Parse sections (salesData, topProducts, paymentMethods, inventoryValue)
    const includeSections = {
      salesData: sections?.includes('salesData') ?? true,
      topProducts: sections?.includes('topProducts') ?? true,
      paymentMethods: sections?.includes('paymentMethods') ?? true,
      inventoryValue: sections?.includes('inventoryValue') ?? true,
    };

    const rows: string[][] = [];

    // Header
    rows.push(['Sales Report', '', '', '']);
    rows.push(['Date Range:', new Date(startDate).toLocaleDateString(), 'to', new Date(endDate).toLocaleDateString()]);
    rows.push(['Generated:', new Date().toLocaleString()]);
    rows.push([]);

    // Fetch and include Sales Data
    if (includeSections.salesData) {
      const where: any = {
        type: 'SALE',
        ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      };
      if (storeId) where.storeId = storeId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        select: {
          id: true,
          total: true,
          createdAt: true,
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const groupedData: Record<string, { revenue: number; transactions: number; items: number }> = {};
      transactions.forEach((txn) => {
        const key = new Date(txn.createdAt).toISOString().split('T')[0];
        if (!groupedData[key]) {
          groupedData[key] = { revenue: 0, transactions: 0, items: 0 };
        }
        groupedData[key].revenue += txn.total;
        groupedData[key].transactions += 1;
        groupedData[key].items += txn.items.reduce((sum, item) => sum + item.quantity, 0);
      });

      const totals = { revenue: 0, transactions: 0, items: 0 };
      rows.push(['SALES DATA']);
      rows.push(['Date', 'Revenue', 'Transactions', 'Items Sold']);
      Object.entries(groupedData).forEach(([date, data]) => {
        rows.push([date, data.revenue.toFixed(2), data.transactions.toString(), data.items.toString()]);
        totals.revenue += data.revenue;
        totals.transactions += data.transactions;
        totals.items += data.items;
      });
      rows.push(['TOTAL', totals.revenue.toFixed(2), totals.transactions.toString(), totals.items.toString()]);
      rows.push([]);
    }

    // Fetch and include Top Products
    if (includeSections.topProducts) {
      const where: any = {
        transaction: {
          type: 'SALE',
          ownerId: req.ownerId, // TENANT FILTER
        },
      };
      if (storeId) where.transaction.storeId = storeId;
      if (startDate || endDate) {
        where.transaction.createdAt = {};
        if (startDate) where.transaction.createdAt.gte = new Date(startDate);
        if (endDate) where.transaction.createdAt.lte = new Date(endDate);
      }

      const items = await prisma.transactionItem.findMany({
        where,
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  name: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      const variantSales: Record<string, { variant: any; quantitySold: number; revenue: number }> = {};
      items.forEach((item) => {
        const variantId = item.productVariantId;
        if (!variantSales[variantId]) {
          variantSales[variantId] = { variant: item.productVariant, quantitySold: 0, revenue: 0 };
        }
        variantSales[variantId].quantitySold += item.quantity;
        variantSales[variantId].revenue += item.subtotal;
      });

      const topProducts = Object.values(variantSales)
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5);

      rows.push(['TOP SELLING PRODUCTS']);
      rows.push(['Rank', 'Product', 'SKU', 'Category', 'Quantity Sold', 'Revenue']);
      topProducts.forEach((item, index) => {
        rows.push([
          (index + 1).toString(),
          item.variant.product.name,
          item.variant.sku,
          item.variant.product.category?.name || '',
          item.quantitySold.toString(),
          item.revenue.toFixed(2),
        ]);
      });
      rows.push([]);
    }

    // Fetch and include Payment Methods
    if (includeSections.paymentMethods) {
      const where: any = {
        type: 'SALE',
        ownerId: req.ownerId, // TENANT FILTER
      };
      if (storeId) where.storeId = storeId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        select: { paymentMethod: true, total: true },
      });

      const breakdown: Record<string, { count: number; total: number }> = {};
      transactions.forEach((txn) => {
        if (!breakdown[txn.paymentMethod]) {
          breakdown[txn.paymentMethod] = { count: 0, total: 0 };
        }
        breakdown[txn.paymentMethod].count += 1;
        breakdown[txn.paymentMethod].total += txn.total;
      });

      rows.push(['PAYMENT METHODS']);
      rows.push(['Method', 'Count', 'Total', 'Percentage']);
      Object.entries(breakdown).forEach(([method, stats]) => {
        const percentage = ((stats.count / transactions.length) * 100).toFixed(2);
        rows.push([method, stats.count.toString(), stats.total.toFixed(2), percentage + '%']);
      });
      rows.push([]);
    }

    // Fetch and include Inventory Value
    if (includeSections.inventoryValue) {
      const where: any = {
        product: {
          ownerId: req.ownerId, // TENANT FILTER
        },
      };
      if (storeId) where.product.storeId = storeId;

      const variants = await prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
      });

      let totalCostValue = 0;
      let totalSellingValue = 0;
      const categoryBreakdown: Record<string, { costValue: number; sellingValue: number; items: number }> = {};

      variants.forEach((variant) => {
        const costValue = variant.costPrice * variant.stockQuantity;
        const sellingValue = variant.sellingPrice * variant.stockQuantity;
        totalCostValue += costValue;
        totalSellingValue += sellingValue;

        const categoryName = variant.product.category?.name || 'Uncategorized';
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = { costValue: 0, sellingValue: 0, items: 0 };
        }
        categoryBreakdown[categoryName].costValue += costValue;
        categoryBreakdown[categoryName].sellingValue += sellingValue;
        categoryBreakdown[categoryName].items += variant.stockQuantity;
      });

      rows.push(['INVENTORY VALUE']);
      rows.push(['Total Cost Value', totalCostValue.toFixed(2)]);
      rows.push(['Total Selling Value', totalSellingValue.toFixed(2)]);
      rows.push(['Potential Profit', (totalSellingValue - totalCostValue).toFixed(2)]);
      rows.push(['Total Items', variants.reduce((sum, v) => sum + v.stockQuantity, 0).toString()]);
      rows.push([]);
      rows.push(['CATEGORY BREAKDOWN']);
      rows.push(['Category', 'Items', 'Cost Value', 'Selling Value', 'Potential Profit']);
      Object.entries(categoryBreakdown).forEach(([category, data]) => {
        rows.push([
          category,
          data.items.toString(),
          data.costValue.toFixed(2),
          data.sellingValue.toFixed(2),
          (data.sellingValue - data.costValue).toFixed(2),
        ]);
      });
    }

    // Generate CSV content
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Set headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Export CSV error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to export CSV' });
  }
};

/**
 * Export report as PDF (TENANT-FILTERED)
 * Only exports data for the authenticated user's owner
 */
export const exportReportPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId, sections } = req.body;

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized - no tenant context' });
      return;
    }

    // Parse sections
    const includeSections = {
      salesData: sections?.includes('salesData') ?? true,
      topProducts: sections?.includes('topProducts') ?? true,
      paymentMethods: sections?.includes('paymentMethods') ?? true,
      inventoryValue: sections?.includes('inventoryValue') ?? true,
    };

    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica')
      .text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(1.5);

    let yPos = doc.y;

    // Fetch and include Sales Data
    if (includeSections.salesData) {
      const where: any = {
        type: 'SALE',
        ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      };
      if (storeId) where.storeId = storeId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        select: {
          id: true,
          total: true,
          createdAt: true,
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const groupedData: Record<string, { revenue: number; transactions: number; items: number }> = {};
      transactions.forEach((txn) => {
        const key = new Date(txn.createdAt).toISOString().split('T')[0];
        if (!groupedData[key]) {
          groupedData[key] = { revenue: 0, transactions: 0, items: 0 };
        }
        groupedData[key].revenue += txn.total;
        groupedData[key].transactions += 1;
        groupedData[key].items += txn.items.reduce((sum, item) => sum + item.quantity, 0);
      });

      const totals = { revenue: 0, transactions: 0, items: 0 };
      Object.values(groupedData).forEach((data) => {
        totals.revenue += data.revenue;
        totals.transactions += data.transactions;
        totals.items += data.items;
      });

      // Summary boxes
      doc.fontSize(12).font('Helvetica-Bold').text('Summary', 50, yPos);
      yPos += 25;

      const boxWidth = 150;
      doc.fontSize(9).font('Helvetica');

      doc.rect(50, yPos, boxWidth, 40).stroke();
      doc.text('Total Revenue', 55, yPos + 5);
      doc.fontSize(14).font('Helvetica-Bold').text(`$${totals.revenue.toFixed(2)}`, 55, yPos + 20);

      doc.fontSize(9).font('Helvetica');
      doc.rect(220, yPos, boxWidth, 40).stroke();
      doc.text('Transactions', 225, yPos + 5);
      doc.fontSize(14).font('Helvetica-Bold').text(totals.transactions.toString(), 225, yPos + 20);

      doc.fontSize(9).font('Helvetica');
      doc.rect(390, yPos, boxWidth, 40).stroke();
      doc.text('Items Sold', 395, yPos + 5);
      doc.fontSize(14).font('Helvetica-Bold').text(totals.items.toString(), 395, yPos + 20);

      yPos += 60;

      // Sales Data Table
      doc.fontSize(12).font('Helvetica-Bold').text('Sales Data', 50, yPos);
      yPos += 20;

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#3B82F6', '#3B82F6');
      doc.fillColor('#FFFFFF').text('Date', 55, yPos + 5, { width: 120 });
      doc.text('Revenue', 180, yPos + 5, { width: 100 });
      doc.text('Transactions', 285, yPos + 5, { width: 100 });
      doc.text('Items', 390, yPos + 5, { width: 100 });
      yPos += 20;

      // Table rows
      doc.fillColor('#000000').font('Helvetica');
      let rowIndex = 0;
      for (const [date, data] of Object.entries(groupedData)) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const bgColor = rowIndex % 2 === 0 ? '#F3F4F6' : '#FFFFFF';
        doc.rect(50, yPos, 495, 20).fillAndStroke(bgColor, bgColor);
        doc.fillColor('#000000')
          .text(date, 55, yPos + 5, { width: 120 })
          .text(`$${data.revenue.toFixed(2)}`, 180, yPos + 5, { width: 100 })
          .text(data.transactions.toString(), 285, yPos + 5, { width: 100 })
          .text(data.items.toString(), 390, yPos + 5, { width: 100 });
        yPos += 20;
        rowIndex++;
      }

      // Total row
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#D1D5DB', '#D1D5DB');
      doc.fillColor('#000000')
        .text('TOTAL', 55, yPos + 5, { width: 120 })
        .text(`$${totals.revenue.toFixed(2)}`, 180, yPos + 5, { width: 100 })
        .text(totals.transactions.toString(), 285, yPos + 5, { width: 100 })
        .text(totals.items.toString(), 390, yPos + 5, { width: 100 });

      yPos += 40;
    }

    // Fetch and include Top Products
    if (includeSections.topProducts) {
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      const where: any = {
        transaction: {
          type: 'SALE',
          ownerId: req.ownerId, // TENANT FILTER
        },
      };
      if (storeId) where.transaction.storeId = storeId;
      if (startDate || endDate) {
        where.transaction.createdAt = {};
        if (startDate) where.transaction.createdAt.gte = new Date(startDate);
        if (endDate) where.transaction.createdAt.lte = new Date(endDate);
      }

      const items = await prisma.transactionItem.findMany({
        where,
        include: {
          productVariant: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
      });

      const variantSales: Record<string, { variant: any; quantitySold: number; revenue: number }> = {};
      items.forEach((item) => {
        const variantId = item.productVariantId;
        if (!variantSales[variantId]) {
          variantSales[variantId] = { variant: item.productVariant, quantitySold: 0, revenue: 0 };
        }
        variantSales[variantId].quantitySold += item.quantity;
        variantSales[variantId].revenue += item.subtotal;
      });

      const topProducts = Object.values(variantSales)
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5);

      doc.fontSize(12).font('Helvetica-Bold').text('Top Selling Products', 50, yPos);
      yPos += 20;

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#10B981', '#10B981');
      doc.fillColor('#FFFFFF')
        .text('Rank', 55, yPos + 5, { width: 40 })
        .text('Product', 100, yPos + 5, { width: 150 })
        .text('SKU', 255, yPos + 5, { width: 100 })
        .text('Quantity', 360, yPos + 5, { width: 80 })
        .text('Revenue', 445, yPos + 5, { width: 100 });
      yPos += 20;

      // Table rows
      doc.fillColor('#000000').font('Helvetica');
      topProducts.forEach((item, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const bgColor = index % 2 === 0 ? '#F3F4F6' : '#FFFFFF';
        doc.rect(50, yPos, 495, 20).fillAndStroke(bgColor, bgColor);
        doc.fillColor('#000000')
          .text((index + 1).toString(), 55, yPos + 5, { width: 40 })
          .text(item.variant.product.name, 100, yPos + 5, { width: 150 })
          .text(item.variant.sku, 255, yPos + 5, { width: 100 })
          .text(item.quantitySold.toString(), 360, yPos + 5, { width: 80 })
          .text(`$${item.revenue.toFixed(2)}`, 445, yPos + 5, { width: 100 });
        yPos += 20;
      });

      yPos += 20;
    }

    // Fetch and include Payment Methods
    if (includeSections.paymentMethods) {
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      const where: any = {
        type: 'SALE',
        ownerId: req.ownerId, // TENANT FILTER
      };
      if (storeId) where.storeId = storeId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        select: { paymentMethod: true, total: true },
      });

      const breakdown: Record<string, { count: number; total: number }> = {};
      transactions.forEach((txn) => {
        if (!breakdown[txn.paymentMethod]) {
          breakdown[txn.paymentMethod] = { count: 0, total: 0 };
        }
        breakdown[txn.paymentMethod].count += 1;
        breakdown[txn.paymentMethod].total += txn.total;
      });

      doc.fontSize(12).font('Helvetica-Bold').text('Payment Methods', 50, yPos);
      yPos += 20;

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#F59E0B', '#F59E0B');
      doc.fillColor('#FFFFFF')
        .text('Method', 55, yPos + 5, { width: 150 })
        .text('Count', 210, yPos + 5, { width: 100 })
        .text('Total', 315, yPos + 5, { width: 100 })
        .text('Percentage', 420, yPos + 5, { width: 100 });
      yPos += 20;

      // Table rows
      doc.fillColor('#000000').font('Helvetica');
      let rowIndex = 0;
      for (const [method, stats] of Object.entries(breakdown)) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const bgColor = rowIndex % 2 === 0 ? '#F3F4F6' : '#FFFFFF';
        const percentage = ((stats.count / transactions.length) * 100).toFixed(2);
        doc.rect(50, yPos, 495, 20).fillAndStroke(bgColor, bgColor);
        doc.fillColor('#000000')
          .text(method, 55, yPos + 5, { width: 150 })
          .text(stats.count.toString(), 210, yPos + 5, { width: 100 })
          .text(`$${stats.total.toFixed(2)}`, 315, yPos + 5, { width: 100 })
          .text(`${percentage}%`, 420, yPos + 5, { width: 100 });
        yPos += 20;
        rowIndex++;
      }

      yPos += 20;
    }

    // Fetch and include Inventory Value
    if (includeSections.inventoryValue) {
      doc.addPage();
      yPos = 50;

      const where: any = {
        product: {
          ownerId: req.ownerId, // TENANT FILTER
        },
      };
      if (storeId) where.product.storeId = storeId;

      const variants = await prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
      });

      let totalCostValue = 0;
      let totalSellingValue = 0;
      const categoryBreakdown: Record<string, { costValue: number; sellingValue: number; items: number }> = {};

      variants.forEach((variant) => {
        const costValue = variant.costPrice * variant.stockQuantity;
        const sellingValue = variant.sellingPrice * variant.stockQuantity;
        totalCostValue += costValue;
        totalSellingValue += sellingValue;

        const categoryName = variant.product.category?.name || 'Uncategorized';
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = { costValue: 0, sellingValue: 0, items: 0 };
        }
        categoryBreakdown[categoryName].costValue += costValue;
        categoryBreakdown[categoryName].sellingValue += sellingValue;
        categoryBreakdown[categoryName].items += variant.stockQuantity;
      });

      doc.fontSize(12).font('Helvetica-Bold').text('Inventory Value', 50, yPos);
      yPos += 20;

      // Summary table
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#8B5CF6', '#8B5CF6');
      doc.fillColor('#FFFFFF').text('Metric', 55, yPos + 5, { width: 250 });
      doc.text('Value', 310, yPos + 5, { width: 200 });
      yPos += 20;

      const metrics = [
        ['Total Cost Value', `$${totalCostValue.toFixed(2)}`],
        ['Total Selling Value', `$${totalSellingValue.toFixed(2)}`],
        ['Potential Profit', `$${(totalSellingValue - totalCostValue).toFixed(2)}`],
        ['Total Items', variants.reduce((sum, v) => sum + v.stockQuantity, 0).toString()],
      ];

      doc.fillColor('#000000').font('Helvetica');
      metrics.forEach(([metric, value], index) => {
        const bgColor = index % 2 === 0 ? '#F3F4F6' : '#FFFFFF';
        doc.rect(50, yPos, 495, 20).fillAndStroke(bgColor, bgColor);
        doc.fillColor('#000000')
          .text(metric, 55, yPos + 5, { width: 250 })
          .text(value, 310, yPos + 5, { width: 200 });
        yPos += 20;
      });

      yPos += 20;

      // Category breakdown
      doc.fontSize(12).font('Helvetica-Bold').text('Category Breakdown', 50, yPos);
      yPos += 20;

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, yPos, 495, 20).fillAndStroke('#8B5CF6', '#8B5CF6');
      doc.fillColor('#FFFFFF')
        .text('Category', 55, yPos + 5, { width: 120 })
        .text('Items', 180, yPos + 5, { width: 70 })
        .text('Cost Value', 255, yPos + 5, { width: 90 })
        .text('Selling Value', 350, yPos + 5, { width: 90 })
        .text('Profit', 445, yPos + 5, { width: 90 });
      yPos += 20;

      // Table rows
      doc.fillColor('#000000').font('Helvetica');
      let rowIndex = 0;
      for (const [category, data] of Object.entries(categoryBreakdown)) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const bgColor = rowIndex % 2 === 0 ? '#F3F4F6' : '#FFFFFF';
        doc.rect(50, yPos, 495, 20).fillAndStroke(bgColor, bgColor);
        doc.fillColor('#000000')
          .text(category, 55, yPos + 5, { width: 120 })
          .text(data.items.toString(), 180, yPos + 5, { width: 70 })
          .text(`$${data.costValue.toFixed(2)}`, 255, yPos + 5, { width: 90 })
          .text(`$${data.sellingValue.toFixed(2)}`, 350, yPos + 5, { width: 90 })
          .text(`$${(data.sellingValue - data.costValue).toFixed(2)}`, 445, yPos + 5, { width: 90 });
        yPos += 20;
        rowIndex++;
      }
    }

    // Finalize PDF
    doc.end();
  } catch (error: any) {
    console.error('Export PDF error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to export PDF' });
  }
};
