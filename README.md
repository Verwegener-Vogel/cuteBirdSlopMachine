# Cute Bird Slop Machine

An AI-powered video generation system that creates adorable bird content featuring Northern German Baltic coastal species.

## Overview

This project generates unique AI videos of local birds using Google's Gemini API, combining realistic and cartoon-like aesthetics. The system runs on Cloudflare Workers, utilizing enterprise features for optimal performance and scalability.

## Features

- Automated bird video generation using Gemini AI
- Intelligent prompt generation with cuteness rating system
- Persistent prompt storage to ensure uniqueness
- Focus on Baltic coastal bird species
- Mixed realistic and cartoon rendering styles
- Built for Cloudflare Workers infrastructure

## Technical Stack

- Runtime: Cloudflare Workers
- AI Model: Google Gemini 2.5 Pro
- Video Generation: Google AI Video API
- Storage: Cloudflare KV/D1 for prompt persistence
- Language: TypeScript/JavaScript

## Project Goals

1. Generate maximum volume of cute bird AI content
2. Focus on Northern German Baltic coastal bird species
3. Maintain prompt uniqueness through persistent storage
4. Rate content for cuteness potential
5. Build expandable prompt generation dataset

## Getting Started

### Prerequisites

- Cloudflare account with Workers access
- Google AI API key with Gemini access
- Node.js 18+ for local development

### Installation

```bash
git clone https://github.com/yourusername/cuteBirdSlopMachine.git
cd cuteBirdSlopMachine
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your Google AI API key
3. Configure Cloudflare credentials

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Development

```bash
npm run dev
```

### Deployment

```bash
npm run deploy
```

## Architecture

The system consists of:

- **Prompt Generator**: Creates unique bird video prompts
- **Cuteness Rater**: Evaluates prompts for alignment and appeal
- **Video Generator**: Interfaces with Gemini AI for video creation
- **Storage Layer**: Persists prompts and prevents duplicates
- **API Endpoints**: RESTful interface for video generation

## API Endpoints

- `POST /generate` - Generate new bird videos
- `GET /prompts` - Retrieve saved prompts
- `GET /videos/:id` - Get specific video
- `POST /rate` - Rate prompts for cuteness

## Contributing

Please ensure all contributions align with the project's goal of maximizing cute bird content generation.

## License

MIT