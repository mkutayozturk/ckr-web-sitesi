export const WHATSAPP_NUMBER = '905309781917';

export function openWhatsApp(message) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildMessage(title, fields) {
  const lines = [`*Çanakkale Konut Rehberi - ${title}*`, ''];
  fields.forEach(([label, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(`• ${label}: ${value}`);
    }
  });
  lines.push('', 'Bu talep ÇKR üzerinden iletilmiştir.');
  return lines.join('\n');
}
