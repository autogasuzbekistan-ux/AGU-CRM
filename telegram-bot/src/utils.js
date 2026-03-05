exports.formatAmount = (amount) => {
  if (!amount) return '0';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount));
};

exports.formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
