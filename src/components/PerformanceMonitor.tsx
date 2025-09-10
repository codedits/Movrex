"use client";

import { useEffect } from 'react';

export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if PerformanceObserver is supported
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported in this browser');
      return;
    }

    const observers: PerformanceObserver[] = [];

    try {
      // Monitor Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            // Log performance metrics
            if ('value' in entry) {
              console.log(`${entry.name}:`, entry.value);
              
              // Send to analytics if needed
              if (entry.name === 'LCP') {
                // Largest Contentful Paint
                console.log('LCP:', entry.value, 'ms');
              } else if (entry.name === 'FID') {
                // First Input Delay
                console.log('FID:', entry.value, 'ms');
              } else if (entry.name === 'CLS') {
                // Cumulative Layout Shift
                console.log('CLS:', entry.value);
              } else if (entry.name === 'FCP') {
                // First Contentful Paint
                console.log('FCP:', entry.value, 'ms');
              } else if (entry.name === 'TTFB') {
                // Time to First Byte
                console.log('TTFB:', entry.value, 'ms');
              }
            }
          }
        } catch (error) {
          console.warn('Error in performance observer callback:', error);
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'first-contentful-paint', 'navigation'] });
      observers.push(observer);

      // Monitor long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('Long task detected:', entry.duration, 'ms');
            }
          }
        } catch (error) {
          console.warn('Error in long task observer:', error);
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
      observers.push(longTaskObserver);

      // Monitor memory usage (only in Chrome)
      if ('memory' in performance) {
        try {
          const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
          if (memory) {
            console.log('Memory usage:', {
              used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
              total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
              limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB',
            });
          }
        } catch (error) {
          console.warn('Error accessing memory info:', error);
        }
      }

      // Monitor network requests
      const networkObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              if (resourceEntry.duration > 1000) {
                console.warn('Slow resource load:', resourceEntry.name, resourceEntry.duration, 'ms');
              }
            }
          }
        } catch (error) {
          console.warn('Error in network observer:', error);
        }
      });

      networkObserver.observe({ entryTypes: ['resource'] });
      observers.push(networkObserver);

      // Monitor paint timing
      const paintObserver = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            console.log('Paint:', entry.name, entry.startTime, 'ms');
          }
        } catch (error) {
          console.warn('Error in paint observer:', error);
        }
      });

      paintObserver.observe({ entryTypes: ['paint'] });
      observers.push(paintObserver);

    } catch (error) {
      console.error('Error setting up performance monitoring:', error);
    }

    // Cleanup
    return () => {
      observers.forEach(observer => {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn('Error disconnecting observer:', error);
        }
      });
    };
  }, []);

  // This component doesn't render anything
  return null;
}
