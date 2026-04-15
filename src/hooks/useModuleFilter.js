import { useState, useMemo, useCallback } from 'react';
import { now, dlReportCSV, dlReportPDF, dlReportWord } from '@/lms-common';

export const useModuleFilter = ({ 
  data, 
  initialTab = 'All', 
  dateKey = 'date', 
  searchFields = [],
  reportId,
  showToast,
  addAudit,
  customFilter,
  initialStartDate,
  initialEndDate
}) => {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(initialTab);

  // Default: Use provided date or 90 days ago
  const defaultStart = useMemo(() => {
    if (initialStartDate) return initialStartDate;
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  }, [initialStartDate]);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(initialEndDate || now());

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return data.filter(item => {
      // 1. Tab/Category Filter
      if (customFilter) {
        if (!customFilter(item, tab)) return false;
      } else if (tab !== 'All' && item.status !== tab) {
        return false;
      }

        // 2. Date Filter (Strict & Live)
        if (dateKey) {
          let val = (typeof dateKey === 'function') ? dateKey(item, tab) : item[dateKey];
          let itemDate = val;
          
          if (itemDate && typeof itemDate === 'string') {
            if (itemDate.includes('T')) itemDate = itemDate.split('T')[0];
            else if (itemDate.includes(' ')) itemDate = itemDate.split(' ')[0];
          } else if (itemDate instanceof Date) {
            itemDate = itemDate.toISOString().split('T')[0];
          }

          if (startDate || endDate) {
            // If we have a date range, usually we hide items with no date.
            // FIX: If the user is SEARCHING, we should allow items with no date to show up
            // if they match the search query, rather than hiding them permanently.
            if (!itemDate) {
              if (lq) { /* continue to search check */ } 
              else return false;
            } else {
              if (startDate && itemDate < startDate) return false;
              if (endDate && itemDate > endDate) return false;
            }
          }
        }

      // 3. Search Filter
      if (lq) {
        const match = searchFields.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(lq);
        });
        if (!match) return false;
      }

      return true;
    });
  }, [data, q, tab, startDate, endDate, dateKey, searchFields, customFilter]);

  const applyFilter = useCallback(() => {
    if (showToast) {
       showToast(`🔍 Applied filter: ${filtered.length} results found in this range`, 'info');
    }
    if (addAudit) {
      addAudit('Filter Applied', reportId, `${startDate} to ${endDate}`);
    }
  }, [filtered.length, startDate, endDate, reportId, addAudit, showToast]);

  const handleExport = useCallback((format, title, cols) => {
    const rData = {
      name: reportId || 'report',
      title,
      hdr: cols.map(c => c.l),
      rows: filtered.map(item => cols.map(c => item[c.k]))
    };

    if (format === 'CSV') dlReportCSV(rData);
    else if (format === 'PDF') dlReportPDF(rData);
    else if (format === 'WORD') dlReportWord(rData);

    if (addAudit) {
      addAudit('Module Export', reportId, `Format: ${format}, Rows: ${filtered.length}, Range: ${startDate} to ${endDate}`);
    }
  }, [filtered, startDate, endDate, reportId, addAudit]);

  return {
    q, setQ,
    tab, setTab,
    startDate, setStartDate,
    endDate, setEndDate,
    applyFilter,
    filtered,
    handleExport
  };
};
