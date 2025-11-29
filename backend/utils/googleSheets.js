const { google } = require('googleapis');

// Initialize Google Sheets API
const getGoogleSheetsClient = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
  
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

// Format date for display
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Sync orders to Google Sheets
const syncOrdersToSheet = async (orders, date) => {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Google Sheet ID not configured');
  }

  // Format date header
  const dateStr = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Get existing data to find where to append
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A:A',
  });

  const lastRow = existingData.data.values ? existingData.data.values.length : 0;
  const startRow = lastRow > 0 ? lastRow + 3 : 1; // Leave 2 blank rows between entries

  // Prepare data rows
  const rows = [];
  
  // Add date header
  rows.push([`📅 Orders for ${dateStr}`]);
  rows.push([]); // Empty row
  
  // Add column headers
  rows.push([
    'Order ID',
    'Customer Name',
    'Phone',
    'Items',
    'Total Amount',
    'Payment Mode',
    'Payment Status',
    'Paid By',
    'Delivery Status',
    'Delivered By',
    'Delivered At',
    'Address',
  ]);

  // Add order data
  for (const order of orders) {
    const items = order.items?.map(i => `${i.name} x${i.quantity}`).join(', ') || '';
    const address = order.deliveryAddress 
      ? `${order.deliveryAddress.addressLine || ''}, ${order.deliveryAddress.city || ''}`
      : '';

    rows.push([
      order.orderId || '',
      order.customerName || '',
      order.customerPhone || '',
      items,
      order.totalAmount || 0,
      order.paymentMode || '',
      order.paymentStatus || '',
      order.actualPaymentMethod || order.paymentMode || '',
      order.deliveryStatus || '',
      order.assignedDeliveryBoy?.name || '',
      formatDate(order.deliveredAt),
      address,
    ]);
  }

  // Add summary row
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const deliveredCount = orders.filter(o => o.deliveryStatus === 'Delivered').length;
  rows.push([]); // Empty row
  rows.push([
    'TOTAL',
    `${orders.length} Orders`,
    '',
    '',
    totalRevenue,
    '',
    '',
    '',
    `${deliveredCount} Delivered`,
    '',
    '',
    '',
  ]);

  // Append to sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `Sheet1!A${startRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows,
    },
  });

  return {
    rowsAdded: rows.length,
    startRow,
    ordersCount: orders.length,
  };
};

module.exports = { syncOrdersToSheet };
