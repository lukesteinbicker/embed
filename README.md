# Embed Widget - React/Vite Version

This is a React/Vite remake of the original `embed.js` file, maintaining all the same functionality while using modern React patterns and hooks.

## Features

- **Visitor Management**: Token validation, visitor initialization, and session tracking
- **Real-time Updates**: Server-sent events for live status updates
- **Video Calling**: Daily.co integration for video calls
- **Page Visibility**: Automatic activity tracking based on page visibility
- **Responsive UI**: Modern button and video call interface

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

The embed widget can be included in any website by adding a script tag:

```html
<script src="https://cdn.jsdelivr.net/gh/lukesteinbicker/embed@main/embed.js?token=your_embed_token"></script>
```

Or with a data attribute:

```html
<script src="https://cdn.jsdelivr.net/gh/lukesteinbicker/embed@main/embed.js" data-token="your_embed_token"></script>
```

## API Integration

The widget integrates with the following API endpoints:

- `POST /api/visitors/initialize` - Initialize visitor session
- `GET /api/visitors/status` - Get current visitor status
- `POST /api/visitors/status` - Update visitor status
- `GET /api/visitors/events?visitorId={visitorId}` - Server-sent events stream

## Components

- **EmbedWidget**: Main container component
- **EmbedButton**: Call/cancel button interface
- **VideoCall**: Daily.co video calling interface

## Hooks

- **useVisitorData**: Manages visitor state and API calls
- **usePageVisibility**: Handles page visibility changes and cleanup

## State Management

The widget uses React hooks for state management:

- `currentFields`: Current visitor status (active, joined, dailyRoomId, sessionEndedAt)
- `visitorData`: Visitor information (visitorId, sessionId, companyId, token)
- `isInitialized`: Whether the widget has been initialized

## Build Configuration

The widget is built as an IIFE (Immediately Invoked Function Expression) using Vite, making it compatible with any website without requiring a module bundler.
