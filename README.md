# 🎬 Movrex - Modern Movie Discovery App

A Netflix-inspired movie recommendation web application built with Next.js 15, featuring a modern UI with smooth animations and comprehensive movie data.

![Movrex App](https://img.shields.io/badge/Next.js-15.4.6-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## ✨ Features

### 🎯 Core Functionality
- **Movie Discovery**: Browse trending, popular, top-rated, and upcoming movies
- **Smart Search**: Real-time search with debounced API calls
- **Interactive Navigation**: Category-based filtering with smooth transitions
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

### 🆕 What’s New (Session Updates)
- **Movie Master Chat (floating widget)**
  - Bottom-right logo button opens a sleek chat powered by the BK9 API
  - Bold movie titles in responses are clickable and trigger an in-app search
  - Shows only after the loading screen; hides during load
  - Footer-triggered helper popup (“finding something? need help?”) appears once per page load
  - Mobile-optimized: safe-area offsets, larger tap targets, keyboard-safe padding
- **Actor Search Suggestion**
  - If your search matches a person, a confirmation popup lets you show that actor’s films
  - Enter key to confirm; actor mode paginates and includes a Clear button
- **Where to Watch (Watch Providers)**
  - Movie detail page shows “Where to watch · REGION” chips from TMDB watch/providers
  - Prioritizes Stream → Rent → Buy; deep-links to platform page
- **Continue Browsing & Trends**
  - Recently viewed row (localStorage, capped 12, 15‑day expiry)
  - Recent searches chips (deduped, capped 10, 15‑day expiry)
  - “Now trending” mini‑carousel on the home page
- **Performance & UX Polish**
  - Preconnect/dns-prefetch for `image.tmdb.org` and `api.bk9.dev`
  - Reduced heavy blur on mobile; smoother header animation (higher threshold, will-change)
  - Content-visibility for heavy sections; thin global scrollbars
  - Lighter hero image settings (removed quality=100)
- **SEO Enhancements**
  - Rich metadata: OpenGraph/Twitter, canonical, keywords, theme-color & viewport
  - JSON‑LD WebSite + SearchAction schema

> Note: The earlier “context‑aware AI” feature was removed by request. Chat does not read the current page context.

### 🎨 Modern UI/UX
- **Hide-on-Scroll Navbar**: Navbar slides up when scrolling down, reappears when scrolling up
- **Hero Banner**: Featured movie showcase with backdrop and call-to-action buttons
- **Glassmorphism Design**: Modern glass-like effects with backdrop blur
- **Smooth Animations**: Framer Motion powered transitions and micro-interactions
- **Skeleton Loaders**: Loading states for better user experience

### 🎬 Movie Details
- **Comprehensive Data**: Release date, genres, runtime, languages, production info
- **Cast & Crew**: Detailed information about actors and filmmakers
- **Image Gallery**: Clickable modal gallery with high-quality posters and backdrops
- **Trailers**: Direct links to movie trailers
- **Ratings**: User ratings with yellow star indicators
- **Related Movies**: Smart recommendations + collection-aware “Similar Movies”
- **Where to Watch**: Streaming/rent/buy providers with platform links

### 📱 Mobile Optimized
- **Touch-Friendly**: Larger tap targets & safe-area awareness
- **Responsive Grid**: Adaptive movie grid layout
- **Mobile Hero**: Optimized hero section height & lighter animations
- **Horizontal Scroll**: Smooth rows with hidden scrollbars

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **API**: TMDb (The Movie Database) + BK9 API (chat)
- **Deployment**: Vercel

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/codedits/Movie-Preview.git
   cd Movie-Preview/movrex
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 API Setup

This app uses the TMDb API. To get your API key:

1. Visit [The Movie Database](https://www.themoviedb.org/)
2. Create an account and go to Settings → API
3. Request an API key for "Developer" use
4. Add the API key to your `.env.local` file

### Chat (BK9 API)
- The chat calls a public endpoint: `https://api.bk9.dev/ai/BK9` (no key required)
- Responses support basic formatting: `**bold**` and line breaks. Bold titles are clickable.

## 🚀 Deployment

### Vercel Deployment

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project"
   - Import your GitHub repository: `codedits/Movie-Preview`

2. **Configure Project Settings**
   - Set **Root Directory** to `movrex`
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_TMDB_API_KEY` = `your_api_key_here`
   - Select Production and Preview scopes

4. **Deploy**
   - Click "Deploy"
   - Your app will be live at `https://your-project.vercel.app`

## 📁 Project Structure

```
movrex/
├── public/
│   └── movrex.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── movie/[id]/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── head.tsx            # Preconnect/dns-prefetch & meta helpers
│   │   └── page.tsx
│   ├── components/
│   │   ├── MovieMasterChat.tsx   # Floating chat widget (BK9 API)
│   │   ├── RecentViewBeacon.tsx  # Records recent views in localStorage (15-day expiry)
│   │   └── MovieGallery.tsx
│   └── hooks/
│       ├── useConnectionQuality.ts
│       └── useScrollDirection.ts
└── package.json
```

## 🎯 Key Features Explained

### Actor Search Suggestion
- If a search matches an actor, a popup asks to show their movies. Confirm with Enter; Clear exits actor mode.

### Continue Browsing & Trends
- Local recent views & searches with 15‑day expiry; lightweight horizontal rows for quick access.

### Where to Watch
- Provider chips for Stream/Rent/Buy with logos and links.

### Chat Tips
- Bold results are clickable; try prompts like:
  - "Movies like Inception"
  - "Best heist films from the 2010s"

## 🔍 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📈 Performance & SEO Notes
- Preconnects for image and chat APIs
- Reduced blur on mobile; higher header scroll threshold; content-visibility on rows
- Rich OG/Twitter meta + JSON‑LD schema

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [TMDb](https://www.themoviedb.org/) for providing the movie data API
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Framer Motion](https://www.framer.com/motion/) for smooth animations

---

Made with ❤️ by [Your Name]
