import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque identifier for a root-level page that temporarily replaces the conversation surface. */
export type MainPageId = Branded<'MainPageId'>

/** Owner state supplied to the active main-page occupant. */
export interface MainPageOwnerProps {
  /** Page selected by a sidebar or another root navigation surface. */
  activePage: MainPageId
  /** Return to the current conversation without changing its Session selection. */
  closePage: () => void
}
