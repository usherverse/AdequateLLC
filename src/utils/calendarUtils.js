
/**
 * Kenyan Holidays Utility
 */

const toLDS = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getKenyanHolidays = (year) => {
  // Easter calculation (Oudin's Algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterDate = new Date(year, month - 1, day);
  
  const goodFriday = new Date(easterDate);
  goodFriday.setDate(easterDate.getDate() - 2);
  
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);

  const holidays = [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Good Friday", date: goodFriday },
    { name: "Easter Monday", date: easterMonday },
    { name: "Labour Day", date: new Date(year, 4, 1) },
    { name: "Madaraka Day", date: new Date(year, 5, 1) },
    { name: "Utamaduni Day", date: new Date(year, 9, 10) },
    { name: "Mashujaa Day", date: new Date(year, 9, 20) },
    { name: "Jamhuri Day", date: new Date(year, 11, 12) },
    { name: "Christmas Day", date: new Date(year, 11, 25) },
    { name: "Boxing Day", date: new Date(year, 11, 26) },
    // Id-ul-Fitr and Id-ul-Adha are variable based on the moon. 
    // For 2026 accurately:
    ...(year === 2026 ? [
      { name: "Eid al-Fitr", date: new Date(2026, 2, 20) }, // Approx
      { name: "Eid al-Adha", date: new Date(2026, 4, 27) }, // Approx
    ] : [])
  ];

  // If a holiday falls on a Sunday, the following Monday is a holiday
  const adjustedHolidays = [];
  holidays.forEach(h => {
    adjustedHolidays.push(h);
    if (h.date.getDay() === 0) { // Sunday
      const monday = new Date(h.date);
      monday.setDate(h.date.getDate() + 1);
      adjustedHolidays.push({ name: `${h.name} (Observed)`, date: monday, dateStr: toLDS(monday) });
    }
  });

  // Pre-calculate date strings for fast matching
  return adjustedHolidays.map(h => ({ ...h, dateStr: toLDS(h.date) }));
};

export const isWorkingDay = (date, holidays) => {
  const day = date.getDay();
  if (day === 0) return false; // Sunday is not a working day
  
  const dStr = toLDS(date);
  const isHoliday = (holidays || []).some(h => h.dateStr === dStr);
  
  return !isHoliday;
};

export const getWorkingDaysInMonth = (year, month) => {
  const holidays = getKenyanHolidays(year);
  const d = new Date(year, month, 1);
  const workingDays = [];
  while (d.getMonth() === month) {
    if (isWorkingDay(new Date(d), holidays)) {
      workingDays.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return workingDays;
};
