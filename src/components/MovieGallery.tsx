"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type GalleryImage = { src: string; alt: string };

type Props = {
  images: GalleryImage[];
  title?: string;
};

export default function MovieGallery({ images, title = "Gallery" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const hasImages = images && images.length > 0;

  // Removed unused quality computation to avoid dead code

  const open = useCallback((i: number) => {
    setIndex(i);
    setIsOpen(true);
    setIsLoading(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  const prev = useCallback(() => {
    if (!images?.length) return;
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images?.length]);

  const next = useCallback(() => {
    if (!images?.length) return;
    setIndex((i) => (i + 1) % images.length);
  }, [images?.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, prev, next]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!hasImages) return null;

  const currentImage = images[index];

  return (
         <section className="mt-10">
       <h2 className="text-white/80 text-lg font-semibold mb-4">{title}</h2>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 w-max">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              onClick={() => open(i)}
              className="group relative focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
              aria-label={`Open image ${i + 1}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={260}
                height={146}
                className="h-36 w-auto rounded-lg border border-white/10 object-cover group-hover:opacity-90 transition-all duration-200"
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-lg" />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-modal
            role="dialog"
          >
            {/* Close button */}
            <button
              aria-label="Close"
              className="absolute right-4 top-4 z-30 rounded-full bg-black/50 backdrop-blur-sm p-3 text-white hover:bg-black/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <X className="size-6" />
            </button>

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  aria-label="Previous"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 backdrop-blur-sm p-3 text-white hover:bg-black/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                >
                  <ChevronLeft className="size-6" />
                </button>

                <button
                  aria-label="Next"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 backdrop-blur-sm p-3 text-white hover:bg-black/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm">
                {index + 1} / {images.length}
              </div>
            )}

            {/* Main image */}
            <div className="flex items-center justify-center h-full p-4">
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="relative max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              >
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                <Image
                  src={currentImage.src}
                  alt={currentImage.alt}
                  width={1920}
                  height={1080}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  priority
                  quality={95}
                  onLoad={() => setIsLoading(false)}
                  onError={() => setIsLoading(false)}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


