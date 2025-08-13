"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Github, Twitter, Linkedin, Mail, Heart } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default memo(function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer 
      className="bg-gradient-to-t from-black/80 to-transparent backdrop-blur-sm border-t border-white/10 mt-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Image src="/movrex.svg" alt="Movrex" width={32} height={32} />
              <h3 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
                Movrex
              </h3>
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              Discover your next favorite movie with our Netflix-inspired platform. 
              Browse trending films, explore detailed information, and get personalized recommendations.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/codedits/Movie-Preview" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Twitter size={20} />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Linkedin size={20} />
              </a>
              <a 
                href="mailto:contact@movrex.com" 
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/?category=trending" className="text-gray-400 hover:text-white transition-colors duration-200">
                  Trending
                </Link>
              </li>
              <li>
                <Link href="/?category=popular" className="text-gray-400 hover:text-white transition-colors duration-200">
                  Popular
                </Link>
              </li>
              <li>
                <Link href="/?category=top_rated" className="text-gray-400 hover:text-white transition-colors duration-200">
                  Top Rated
                </Link>
              </li>
              <li>
                <Link href="/?category=upcoming" className="text-gray-400 hover:text-white transition-colors duration-200">
                  Upcoming
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://www.themoviedb.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  TMDb API
                </a>
              </li>
              <li>
                <a 
                  href="https://nextjs.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Next.js
                </a>
              </li>
              <li>
                <a 
                  href="https://tailwindcss.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Tailwind CSS
                </a>
              </li>
              <li>
                <a 
                  href="https://www.framer.com/motion/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Framer Motion
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/10 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © {currentYear} Movrex. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors duration-200">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors duration-200">
                Terms of Service
              </a>
              <span className="flex items-center">
                Made with <Heart size={14} className="mx-1 text-red-500" /> by Codedits
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Sentinel for IntersectionObserver (chat helper popup) */}
      <div id="footer-sentinel" className="h-[1px] w-full" />
    </motion.footer>
  );
});
