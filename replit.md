# ScoreKeeper - Friends & Games Tracker

## Overview

ScoreKeeper is a web application for tracking game scores and statistics among friends. It supports multiple game types (billiards, golf, and card games) with features for recording matches, viewing player statistics, and displaying leaderboards. The application uses a modern React frontend with an Express backend, backed by PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, with custom hooks for data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Build Tool**: Vite with HMR support for development
- **Charts**: Recharts for data visualization

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ES Modules)
- **API Design**: RESTful endpoints with Zod validation for request/response schemas
- **Shared Contracts**: API routes and types defined in `shared/routes.ts` for type-safe client-server communication

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` for schema synchronization

### Database Schema
Eight main tables:
1. **users** - Game participants (id, name, avatarColor, golfHandicap)
2. **matches** - Game records (id, gameType, playedAt, notes, createdAt)
3. **scores** - Individual scores per match (id, matchId, userId, scoreValue, handicap, isWinner)
4. **rounds** - Saved round evaluations (id, name, createdAt)
5. **roundMatches** - Links rounds to matches (id, roundId, matchId)
6. **userHandicaps** - Year-based golf handicaps (id, userId, year, golfHandicap) with unique index on (userId, year)
7. **posts** - Bulletin board posts (id, authorName, title, content, createdAt)
8. **comments** - Post comments (id, postId, authorName, content, createdAt)

### Setup Page
- The Setup page (/setup) allows managing golf handicaps per year and member registration
- **Golf Handicap Management**: 
  - Year selector allows navigating between years (2020-2100)
  - Handicaps can be set to values between 0-54
  - Each year's handicaps are stored separately and apply to matches in that year
- **Member Management**:
  - Add new members with auto-assigned avatar colors
  - Delete members (only members without game history can be deleted)
  - API: POST /api/users (create), DELETE /api/users/:id (delete)

### Round Evaluation Feature
- Users can select multiple matches and save them as a "round" with a custom name
- Saved rounds can be viewed on the Round Evaluation page (/rounds)
- The Victory Leaderboard on the Dashboard can be filtered by saved rounds
- Rankings use rank-based point system: 1st=1pt, 2nd=2pt, 3rd=3pt, 4th=4pt per match (lower total = better)
- For golf matches, rankings are determined by adjusted scores (score - handicap)

### Game Scoring Rules
- **All games**: Lower score is better (ascending ranking)
- **Golf**: Supports handicap-adjusted scoring. Adjusted score = original score (타수) - handicap. Rankings (1st, 2nd, 3rd, 4th) use adjusted scores.
- **Billiards/Card**: No handicap, rankings use raw scores
- Match details page shows adjusted scores for golf when handicap > 0

### Key Design Patterns
- **Shared Types**: TypeScript types are shared between frontend and backend via the `shared/` directory
- **API Contract Pattern**: Routes defined with Zod schemas in `shared/routes.ts` ensure type safety across the stack
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Component Architecture**: Feature-based component organization with reusable UI primitives

### Bulletin Board Feature
- Open bulletin board where anyone (registered members or guests) can post and comment
- Posts include author name, title, content, and timestamp
- Comments are nested under each post with expandable sections
- Delete functionality for both posts (cascades to comments) and individual comments
- No authentication required - completely open for community use

### Navigation Routes
- `/` - Dashboard with Victory Leaderboard and recent matches
- `/rounds` - Round Evaluation page for viewing saved rounds
- `/bulletin` - Bulletin Board for open discussion and posts
- `/setup` - Setup page for managing golf handicaps
- `/matches/:id` - Match details page

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage (available but may not be actively used)

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **Radix UI**: Accessible, unstyled UI primitives (full suite installed)
- **recharts**: Chart visualization for statistics
- **date-fns**: Date formatting utilities
- **react-hook-form + @hookform/resolvers**: Form handling with Zod validation
- **wouter**: Lightweight routing
- **embla-carousel-react**: Carousel functionality
- **vaul**: Drawer component
- **cmdk**: Command menu component

### Backend Libraries
- **drizzle-orm + drizzle-kit**: Database ORM and migration tools
- **zod + drizzle-zod**: Schema validation
- **express**: HTTP server framework

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Production server bundling
- **@replit/vite-plugin-***: Replit-specific development enhancements