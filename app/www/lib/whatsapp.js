// WhatsApp can't be sent by the app on its own (that needs a paid server API). These links open WhatsApp with the message
// already typed, so sending is one tap per person, or one paste into the platoon group.
export function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('972')) return d;
  return d.startsWith('0') ? '972' + d.slice(1) : d;
}

export const waLink = (phone, text) => {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

export const reminderText = (name, checkName, itemsText) =>
  `שלום ${name}, בדיקת ${checkName} להיום. נא לבדוק שכל הציוד אצלך (${itemsText}) ולהחזיר לסמל אישור.`;

export const groupText = (checkName, names) =>
  `תזכורת: בדיקת ${checkName} להיום. טרם אישרו: ${names.join(', ')}. נא לבדוק ציוד ולאשר לסמל.`;
