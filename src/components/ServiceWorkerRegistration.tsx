"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported in this browser');
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('Service Worker registered successfully:', registration);

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          try {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                try {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is available
                    console.log('New service worker available');
                    
                    // You can show a notification to the user here
                    if (confirm('A new version is available! Reload to update?')) {
                      window.location.reload();
                    }
                  }
                } catch (error) {
                  console.warn('Error in service worker state change:', error);
                }
              });
            }
          } catch (error) {
            console.warn('Error in service worker update found:', error);
          }
        });

        // Handle service worker errors
        registration.addEventListener('error', (event) => {
          console.error('Service Worker registration failed:', event);
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  // This component doesn't render anything
  return null;
}
