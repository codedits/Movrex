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
- **Related Movies**: Smart recommendations based on current movie

### 📱 Mobile Optimized
- **Touch-Friendly**: Large touch targets for mobile navigation
- **Responsive Grid**: Adaptive movie grid layout
- **Mobile Hero**: Optimized hero section height for mobile devices
- **Horizontal Scroll**: Smooth category navigation on mobile

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **API**: TMDb (The Movie Database)
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
│   └── movrex.svg          # App logo
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── movie/[id]/     # Movie detail pages
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Homepage
│   ├── components/
│   │   └── MovieGallery.tsx # Image gallery component
│   └── hooks/
│       ├── useConnectionQuality.ts # Network quality detection
│       └── useScrollDirection.ts   # Scroll direction detection
├── .env.local              # Environment variables
└── package.json            # Dependencies
```

## 🎯 Key Features Explained

### Hide-on-Scroll Navbar
The navbar automatically hides when scrolling down and reappears when scrolling up, providing more screen space for content while maintaining easy navigation access.

### Adaptive Image Loading
The app detects network connection quality and loads appropriate image sizes:
- **High-speed**: Full quality images
- **Medium-speed**: Balanced quality
- **Low-speed**: Optimized for faster loading

### Interactive Movie Gallery
- Click any image to open a modal gallery
- Navigate with arrow keys or on-screen buttons
- High-quality image display with smooth transitions

## 🔍 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

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
