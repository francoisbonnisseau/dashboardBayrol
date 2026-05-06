# Design System

## Visual Theme
- Register: Product UI
- Direction: Restrained
- Surface: Neutral layered panels with focused accents for actions and states
- Density: Medium-compact for operational workflows

## Color
- Use existing app tokens and component theme values.
- Primary accent reserved for selected states and main call-to-action buttons.
- Semantic usage:
  - Success: emerald/teal
  - Warning: amber
  - Error: rose/red
  - Info/secondary emphasis: blue

## Typography
- Continue with the current system sans stack.
- Maintain compact product scale:
  - Section titles: semibold, clear but not oversized
  - Control labels and metadata: small, high-contrast where needed
  - Long-form response text: readable with comfortable line-height

## Layout
- Reuse the existing card-based operational layout language from Prompt Management.
- Keep controls in a clear top action bar.
- In compare mode, enforce a balanced two-column response area.
- Maintain responsive behavior by stacking columns vertically on narrower screens.

## Components
- Reuse existing primitives:
  - `Card`, `Button`, `Input`, `Textarea`, `Select`, `Tabs`, `Dialog`, `Badge`, `Alert`, `ScrollArea`
- Required interactive states:
  - disabled while loading/running
  - inline error states near failing controls
  - explicit confirmation dialog for destructive/publishing-adjacent actions

## Motion
- Keep transitions subtle and state-driven only.
- Use spinner indicators for network actions.
- No decorative entrance animations beyond existing app behavior.
