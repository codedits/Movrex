"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useConnectionQuality from "@/hooks/useConnectionQuality";

export type GalleryImage = { src: string; alt: string };

type Props = {
  images: GalleryImage[];
  title?: string;
};

export default function MovieGallery({ images, title = "Gallery" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const tier = useConnectionQuality("high");

  const hasImages = images && images.length > 0;

  const open = useCallback((i: number) => {
    setIndex(i);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

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

  if (!hasImages) return null;

  return (
    <section className="mt-10">
      <h2 className="text-white/80 text-sm mb-3">{title}</h2>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 w-max">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              onClick={() => open(i)}
              className="group relative"
              aria-label={`Open image ${i + 1}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={260}
                height={146}
                className="h-36 w-auto rounded-lg border border-white/10 object-cover group-hover:opacity-90 transition"
              />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-modal
            role="dialog"
          >
            <button
              aria-label="Close"
              className="absolute right-4 top-4 z-30 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <X className="size-6" />
            </button>

            <button
              aria-label="Previous"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            >
              <ChevronLeft className="size-8" />
            </button>

            <button
              aria-label="Next"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              <ChevronRight className="size-8" />
            </button>

            <div className="absolute inset-0 grid place-items-center px-4 z-10" onClick={(e) => e.stopPropagation()}>
              <div className="relative w-[92vw] max-w-6xl aspect-video">
                <Image
                  src={images[index].src}
                  alt={images[index].alt}
                  fill
                  sizes="100vw"
                  quality={tier === "high" ? 95 : tier === "medium" ? 85 : 75}
                  className="object-contain"
                />
              </div>
              <div className="mt-4 text-white/80 text-sm px-6 text-center max-w-4xl line-clamp-2">
                {images[index].alt}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


