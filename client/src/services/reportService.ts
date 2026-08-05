import * as XLSX from 'xlsx';
import { formatDate } from '../utils/dateUtils';
import { getPositionArea, getPositionCost, normalizePositioning } from '../utils/positioning';

export function exportOrdersToExcel(orders: any[], t: (key: string, options?: any) => string): void {
  // One row per customisation position, so quantities, sizes and costs stay
  // readable per position. Items without positions still get a single row.
  const rows = orders.flatMap(order =>
    (order.subOrders || []).flatMap((sub: any) => {
      const createdDate = order.createdAt?.toDate ? order.createdAt.toDate() : null;

      let deliveryFormatted = '';
      if (sub.deliveryTime) {
        const dt = new Date(sub.deliveryTime);
        deliveryFormatted = `${formatDate(dt)} ${dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
      }

      const baseRow = {
        [t('report.orderId')]: order.id.substring(0, 8).toUpperCase(),
        [t('report.orderName')]: order.orderName || '',
        [t('report.clientCompany')]: order.clientCompany || '',
        [t('report.clientName')]: order.clientName || '',
        [t('report.clientEmail')]: order.clientEmail || '',
        [t('report.clientPhone')]: order.clientPhone || order.contactPhone || '',
        [t('report.productType')]: sub.productTypeName || sub.productType || '',
        [t('report.quantity')]: sub.quantity || 0,
      };

      const tailRow = {
        [t('report.department')]: sub.departmentName || '',
        [t('report.description')]: sub.description || '',
        [t('report.notes')]: sub.notes || order.notes || '',
        [t('report.deliveryTime')]: deliveryFormatted,
        [t('report.designFile')]: sub.designFileUrl || sub.designFile || '',
        [t('report.orderStatus')]: getStatusTranslation(order.status, t),
        [t('report.itemStatus')]: getStatusTranslation(sub.status || order.status, t),
        [t('report.createdDate')]: createdDate ? `${formatDate(createdDate)} ${createdDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}` : '',
      };

      const positions = normalizePositioning(sub.positioning, sub);

      if (positions.length === 0) {
        return [{
          ...baseRow,
          [t('report.positioning')]: '',
          [t('report.length')]: '',
          [t('report.width')]: '',
          [t('report.area')]: '',
          [t('report.cmp')]: '',
          [t('report.positionCost')]: '',
          ...tailRow,
        }];
      }

      return positions.map(pos => {
        const area = getPositionArea(pos);
        const cost = getPositionCost(pos);

        return {
          ...baseRow,
          [t('report.positioning')]: pos.name,
          [t('report.quantity')]: pos.quantity ?? sub.quantity ?? 0,
          [t('report.length')]: pos.length ?? '',
          [t('report.width')]: pos.width ?? '',
          [t('report.area')]: area ?? '',
          [t('report.cmp')]: pos.cmp ?? '',
          [t('report.positionCost')]: cost ?? '',
          ...tailRow,
        };
      });
    })
  );

  if (rows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 10 },  // Order ID
    { wch: 25 },  // Order Name
    { wch: 20 },  // Client Company
    { wch: 20 },  // Client Name
    { wch: 25 },  // Client Email
    { wch: 15 },  // Client Phone
    { wch: 18 },  // Product Type
    { wch: 10 },  // Quantity
    { wch: 20 },  // Positioning
    { wch: 10 },  // Length
    { wch: 10 },  // Width
    { wch: 10 },  // Area
    { wch: 12 },  // Cost/unit
    { wch: 14 },  // Position cost
    { wch: 15 },  // Department
    { wch: 30 },  // Description
    { wch: 25 },  // Notes
    { wch: 18 },  // Delivery Time
    { wch: 30 },  // Design File
    { wch: 18 },  // Order Status
    { wch: 18 },  // Item Status
    { wch: 18 },  // Created Date
  ];
  ws['!cols'] = colWidths;

  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `Orders_Export_${timestamp}.xlsx`);
}

function getStatusTranslation(status: string, t: (key: string) => string): string {
  switch (status) {
    case 'pending_confirmation':
      return t('dashboard.orderModal.statuses.pendingConfirmation');
    case 'pending':
      return t('dashboard.orderModal.statuses.confirmed');
    case 'in_progress':
      return t('dashboard.orderModal.statuses.inProduction');
    case 'completed':
      return t('dashboard.orderModal.statuses.completed');
    case 'delivered':
      return t('dashboard.orderModal.statuses.delivered');
    case 'invoiced':
      return t('dashboard.orderModal.statuses.invoiced');
    case 'cancelled':
      return t('dashboard.orderModal.statuses.cancelled');
    default:
      return status || '';
  }
}
