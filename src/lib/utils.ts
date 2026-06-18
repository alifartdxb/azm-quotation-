import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount);
}

export function parseDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  
  if (typeof dateVal === 'string') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  
  if (dateVal && typeof dateVal === 'object') {
    if (typeof dateVal.toDate === 'function') {
      try {
        return dateVal.toDate();
      } catch (e) {
        // Fallback if toDate fails
      }
    }
    if (typeof dateVal.seconds === 'number') {
      return new Date(dateVal.seconds * 1000);
    }
  }
  
  return new Date();
}

export function cleanFirestoreData<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj as any;
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined && key !== 'id') {
          cleaned[key] = cleanFirestoreData(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}
