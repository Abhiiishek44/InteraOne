import { CrmSavedView, CrmSavedViewEntity } from "@shared/models";

interface SavedViewInput {
  entityType: CrmSavedViewEntity;
  name: string;
  state: Record<string, unknown>;
}

const serializeView = (view: any) => ({
  id: view._id.toString(),
  entityType: view.entityType,
  name: view.name,
  state: view.state || {},
  createdAt: view.createdAt.toISOString(),
  updatedAt: view.updatedAt.toISOString(),
});

export class CrmViewsService {
  async list(
    organizationId: string,
    ownerId: string,
    entityType: CrmSavedViewEntity,
  ) {
    const views = await CrmSavedView.find({
      organizationId,
      ownerId,
      entityType,
    })
      .sort({ name: 1 })
      .lean();
    return views.map(serializeView);
  }

  async create(organizationId: string, ownerId: string, input: SavedViewInput) {
    const count = await CrmSavedView.countDocuments({
      organizationId,
      ownerId,
      entityType: input.entityType,
    });
    if (count >= 50) throw new Error("You can save up to 50 views per page");

    const view = await CrmSavedView.create({
      organizationId,
      ownerId,
      entityType: input.entityType,
      name: input.name.trim(),
      state: input.state,
    });
    return serializeView(view);
  }

  async update(
    organizationId: string,
    ownerId: string,
    viewId: string,
    input: Partial<Pick<SavedViewInput, "name" | "state">>,
  ) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.state !== undefined) updates.state = input.state;
    const view = await CrmSavedView.findOneAndUpdate(
      { _id: viewId, organizationId, ownerId },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!view) throw new Error("Saved view not found");
    return serializeView(view);
  }

  async remove(organizationId: string, ownerId: string, viewId: string) {
    const view = await CrmSavedView.findOneAndDelete({
      _id: viewId,
      organizationId,
      ownerId,
    });
    if (!view) throw new Error("Saved view not found");
  }
}
