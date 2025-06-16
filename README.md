# Botpress Dashboard

A modern React dashboard for visualizing Botpress bot conversations across multiple language versions.

## Features

- **Multi-Bot Support**: Manage and view conversations for 3 bot versions (FR, DE, ES)
- **Real-time Data**: Fetch and display conversations from Botpress API
- **Modern UI**: Built with React, Vite, TailwindCSS, and shadcn/ui components
- **Persistent Settings**: Your configuration is saved locally
- **Environment Variables Support**: Pre-configure settings for easy sharing
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- A Botpress account with API access

### Environment Variables

The dashboard supports environment variables for pre-configuring Botpress settings. This allows you to share the dashboard without requiring users to enter settings each time.

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Botpress credentials in the `.env` file:
   ```env
   VITE_BOTPRESS_TOKEN=your_token_here
   VITE_BOTPRESS_WORKSPACE_ID=your_workspace_id
   VITE_BOTPRESS_BOT_ID_FR=french_bot_id
   VITE_BOTPRESS_BOT_ID_DE=german_bot_id
   VITE_BOTPRESS_BOT_ID_ES=spanish_bot_id
   ```

3. Users can still override these settings via the Settings tab in the UI if needed.

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Configuration

1. Click on "Configure Settings" on the welcome screen
2. Enter your Botpress credentials:
   - **API Token**: Your Botpress API token
   - **Workspace ID**: Your Botpress workspace ID
   - **Bot IDs**: Configure the Bot IDs for each language version:
     - FR version Bot ID
     - DE version Bot ID
     - ES version Bot ID

3. Save your settings

### Usage

Once configured, you can:
- Switch between different bot versions using the dropdown
- View conversations with details like:
  - Conversation ID
  - Creation and update timestamps
  - Channel and integration information
  - Tags and metadata
- Refresh the conversation list manually
- Access settings to update your configuration

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint

### Technology Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **API Client**: Botpress Client

### Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── ConversationsList.tsx
│   ├── Navigation.tsx
│   └── Settings.tsx
├── contexts/            # React contexts
│   └── SettingsContext.tsx
├── hooks/              # Custom hooks
│   └── useBotpressClient.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── App.tsx             # Main app component
└── main.tsx           # App entry point
```

## API Integration

This dashboard uses the Botpress API to fetch conversation data. The main endpoints used are:

- `listConversations` - Retrieve conversations for a bot
- `getConversation` - Get details for a specific conversation (ready for future use)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for internal use and development purposes.
