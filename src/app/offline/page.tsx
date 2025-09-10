"use client";

import { motion } from "framer-motion";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-md mx-auto"
      >
        {/* Offline Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto bg-red-600/20 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-red-400" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-2xl font-bold text-white mb-3"
        >
          You&apos;re Offline
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-white/70 mb-8 leading-relaxed"
        >
          It looks like you&apos;ve lost your internet connection. 
          Don&apos;t worry - you can still browse previously viewed movies 
          and cached content while offline.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </motion.button>

          {/* Home Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-medium hover:bg-white/20 transition-colors border border-white/20"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </motion.button>
        </motion.div>

        {/* Offline Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10"
        >
          <h3 className="text-sm font-medium text-white/90 mb-2">
            Available Offline:
          </h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>• Previously viewed movies</li>
            <li>• Cached search results</li>
            <li>• App navigation</li>
            <li>• Basic functionality</li>
          </ul>
        </motion.div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-6 text-xs text-white/40"
        >
          Checking connection...
        </motion.div>
      </motion.div>
    </div>
  );
}
