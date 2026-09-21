export type SavedViewEntity = "contacts" | "opportunities";
export type SavedViewState = Record<string, unknown>;

export interface CrmSavedView {
  id: string;
  entityType: SavedViewEntity;
  name: string;
  state: SavedViewState;
  createdAt: string;
  updatedAt: string;
}
