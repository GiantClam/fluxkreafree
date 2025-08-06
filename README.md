# 🎨 FluxKreaFree - Free AI Image Generator

![FluxKreaFree](https://img.shields.io/badge/FluxKreaFree-Free%20AI%20Image%20Generator-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-38B2AC)

FluxKreaFree is a completely free, open-source AI image generator powered by Flux Krea models. Experience professional-grade photorealistic image generation without the typical "AI look" - completely free and unlimited.

## ✨ Features

- **🎨 Photorealistic AI Generation**: Powered by Flux Krea - excels in creating professional, cinematic images
- **🌍 Multi-language Support**: Available in 10 languages (EN, ZH, JA, ES, FR, DE, KO, PT, AR, TW)
- **⚡ Lightning Fast**: Optimized for speed without compromising quality
- **🔓 Completely Free**: No subscriptions, no limits, no watermarks
- **🧠 Smart Prompt Generator**: AI-powered prompt enhancement with examples
- **📱 Responsive Design**: Beautiful UI that works on all devices
- **🔒 Privacy First**: No registration required for basic usage

## 🚀 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui
- **AI Models**: Flux Krea (via Replicate API)
- **Internationalization**: next-intl
- **Authentication**: NextAuth.js / Clerk (optional)
- **Database**: Prisma (PostgreSQL/SQLite)
- **Deployment**: Vercel / Cloudflare Pages

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js 18+ 
- npm/pnpm/yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/fluxkreafree.git
cd fluxkreafree
```

2. **Install dependencies**
```bash
npm install
# or
pnpm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
# Minimum required for basic functionality
REPLICATE_API_TOKEN=r8_your-replicate-token
GEMINI_API_KEY=your-gemini-key
DATABASE_URL=file:./dev.db
NEXTAUTH_SECRET=your-secret-key
```

4. **Initialize the database**
```bash
npm run db:push
```

5. **Start the development server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app running!

## 🔧 Configuration

### Required API Keys

1. **Replicate API** (Required)
   - Sign up at [Replicate](https://replicate.com)
   - Get your API token from Account → API tokens

2. **Google Gemini API** (Required for prompt generation)
   - Get your key from [Google AI Studio](https://aistudio.google.com)

### Optional Services

- **Authentication**: NextAuth.js or Clerk
- **Storage**: Cloudflare R2 or AWS S3
- **Analytics**: Google Analytics, Umami
- **Monitoring**: Sentry

See the full configuration guide in our [Environment Setup](./ENVIRONMENT_SETUP.md) documentation.

## 🌍 Internationalization

FluxKreaFree supports 10 languages out of the box:

- 🇺🇸 English
- 🇨🇳 Chinese (Simplified)
- 🇯🇵 Japanese
- 🇪🇸 Spanish
- 🇫🇷 French
- 🇩🇪 German
- 🇰🇷 Korean
- 🇵🇹 Portuguese
- 🇸🇦 Arabic
- 🇹🇼 Chinese (Traditional)

## 📚 Usage

### Basic Image Generation

1. Navigate to the Generate page
2. Enter your prompt or use the prompt generator
3. Click "Generate" to create your image
4. Download or share your creation

### Prompt Generator

Use our AI-powered prompt generator to enhance your ideas:

1. Go to the "Prompt Generator" tab
2. Enter a basic idea
3. Let AI enhance it for better results
4. Use the generated prompt for image creation

### Examples & Inspiration

Browse our curated examples organized by categories:
- 📸 Photorealistic Portraits
- 🌅 Natural Photography  
- 🏘️ Lifestyle & Documentary
- 🏗️ Architectural Photography
- 🎬 Cinematic Realism
- 🎨 Professional Photography

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Cloudflare Pages

1. Build the project: `npm run build`
2. Deploy the `out` folder to Cloudflare Pages
3. Configure environment variables

See our detailed [Deployment Guide](./DEPLOYMENT_GUIDE.md) for more options.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run type checking
pnpm build

# Run linting
pnpm lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE.md) file for details.

## 🙏 Acknowledgments

- [Flux Krea](https://krea.ai) for the amazing AI models
- [Black Forest Labs](https://www.blackforestlabs.ai/) for Flux technology
- [Replicate](https://replicate.com) for model hosting
- [Shadcn/ui](https://ui.shadcn.com) for beautiful components

## 📞 Support

- 📧 Email: support@fluxkreafree.com
- 💬 GitHub Issues: [Create an issue](https://github.com/yourusername/fluxkreafree/issues)
- 📖 Documentation: [Visit our docs](https://fluxkreafree.com/docs)

## 🌟 Star History

If you find this project helpful, please consider giving it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/fluxkreafree&type=Date)](https://star-history.com/#yourusername/fluxkreafree&Date)

---

**Made with ❤️ by the FluxKreaFree team**