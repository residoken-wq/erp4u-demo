export function formatWorkingHoursText(workingHours: any): string {
  if (!workingHours || !workingHours.days) return '';
  const days = workingHours.days;
  const dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const labels: Record<string, string> = {
    mon: 'T2',
    tue: 'T3',
    wed: 'T4',
    thu: 'T5',
    fri: 'T6',
    sat: 'T7',
    sun: 'CN',
  };

  // Check if mon-fri are identical and active
  const monToFriActive = ['mon', 'tue', 'wed', 'thu', 'fri'].every(
    (d) => days[d] && !days[d].off && days[d].from && days[d].to,
  );
  const monFrom = days.mon?.from;
  const monTo = days.mon?.to;
  const monToFriSameHours =
    monToFriActive &&
    ['tue', 'wed', 'thu', 'fri'].every(
      (d) => days[d]?.from === monFrom && days[d]?.to === monTo,
    );

  const parts: string[] = [];

  if (monToFriSameHours) {
    parts.push(`T2–T6 ${monFrom}–${monTo}`);
  } else {
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri']) {
      const item = days[d];
      if (item && !item.off && item.from && item.to) {
        parts.push(`${labels[d]} ${item.from}–${item.to}`);
      }
    }
  }

  // Saturday
  if (days.sat && !days.sat.off && days.sat.from && days.sat.to) {
    parts.push(`T7 ${days.sat.from}–${days.sat.to}`);
  }

  // Sunday
  if (days.sun && !days.sun.off && days.sun.from && days.sun.to) {
    parts.push(`CN ${days.sun.from}–${days.sun.to}`);
  }

  return parts.join(', ');
}

export function renderKnowledgeAnswer(template: string, publicView: any): string {
  if (!template) return '';
  const workingHoursText = formatWorkingHoursText(publicView?.working_hours);
  const channels = publicView?.contact_channels || {};

  const vars: Record<string, string> = {
    short_name: publicView?.short_name || '',
    display_name: publicView?.display_name || '',
    hotline: channels.hotline || '',
    email_public: channels.email_public || '',
    zalo_url: channels.zalo_url || '',
    working_hours_text: workingHoursText,
  };

  // Replace placeholders: known variables use their value, unknown/missing use empty string ''
  return template.replace(/{([a-zA-Z0-9_]+)}/g, (_, key) => {
    return vars[key] !== undefined ? vars[key] : '';
  });
}
